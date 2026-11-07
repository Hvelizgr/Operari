import type { PrismaClient } from '@prisma/client';

import { ApprovalService, ApprovalServiceError } from '../../../runbook/services/approval.service';
import type { ApprovalNotifier } from '../../../runbook/services/approval-notifier';
import { ApprovalSweeper, sealTargets } from '../../../runbook/services/approval-sweeper';

const NOW = new Date('2026-11-07T12:00:00Z');
const row = {
  id: 'a1',
  executionId: 'e1',
  message: 'Restart?',
  notifyTargets: null as string | null,
  escalateTo: ['boss@x.io'],
  runbook: { name: 'Restart', tenantId: 't1' },
};

function build(overrides: Record<string, jest.Mock> = {}) {
  const approval = {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    ...overrides,
  };
  const approvals = { expire: jest.fn().mockResolvedValue(true) };
  const notifier = { send: jest.fn().mockResolvedValue({}) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const sweeper = new ApprovalSweeper(
    { approval } as unknown as PrismaClient,
    approvals as unknown as ApprovalService,
    notifier as unknown as ApprovalNotifier,
    audit as never
  );
  return { sweeper, approval, approvals, notifier, audit };
}

describe('ApprovalSweeper', () => {
  beforeAll(() => {
    process.env.OPERARI_SECRET_KEY = 'a'.repeat(64);
  });
  afterAll(() => {
    delete process.env.OPERARI_SECRET_KEY;
  });

  it('expires what passed its deadline', async () => {
    const { sweeper, approval, approvals } = build();
    approval.findMany.mockResolvedValueOnce([{ id: 'a1' }]).mockResolvedValueOnce([]);
    await sweeper.runOnce(NOW);
    expect(approvals.expire).toHaveBeenCalledWith('a1');
  });

  it('keeps sweeping when one expiry fails', async () => {
    const { sweeper, approval, approvals } = build();
    approval.findMany.mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]).mockResolvedValueOnce([]);
    approvals.expire.mockRejectedValueOnce(new Error('db'));
    await sweeper.runOnce(NOW);
    expect(approvals.expire).toHaveBeenCalledWith('a2');
  });

  it('escalates once to the stored targets plus escalateTo', async () => {
    const { sweeper, approval, notifier, audit } = build();
    const notifyTargets = sealTargets(
      { emails: ['oncall@x.io'], slackWebhookUrl: 'https://hooks.slack.com/x' },
      't1'
    );
    approval.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...row, notifyTargets }]);

    await sweeper.runOnce(NOW);

    expect(notifier.send).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: 'a1', escalated: true }),
      {
        emails: ['oncall@x.io', 'boss@x.io'],
        slackWebhookUrl: 'https://hooks.slack.com/x',
      }
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'approval.escalated' })
    );
  });

  it('skips a row another backend already claimed', async () => {
    const { sweeper, approval, notifier } = build();
    approval.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
    approval.updateMany.mockResolvedValue({ count: 0 });
    await sweeper.runOnce(NOW);
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it('still emails escalateTo if the stored targets cannot be read', async () => {
    const { sweeper, approval, notifier } = build();
    approval.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...row, notifyTargets: 'v2:garbage' }]);
    await sweeper.runOnce(NOW);
    expect(notifier.send.mock.calls[0][1]).toEqual({ emails: ['boss@x.io'] });
  });
});

describe('ApprovalService deadlines and approvers', () => {
  const pending = {
    id: 'a1',
    runbookId: 'r1',
    executionId: 'e1',
    stepId: 's1',
    approvers: ['oncall@x.io'],
    escalateTo: ['boss@x.io'],
    escalatedAt: null as Date | null,
    expiresAt: null as Date | null,
    runbook: { tenantId: 't1' },
  };

  function service(row: typeof pending) {
    const tx = {
      approval: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...row, status: 'APPROVED' }),
      },
      execution: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      nodeLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      approval: { findUnique: jest.fn().mockResolvedValue(row) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      tx,
      audit,
      svc: new ApprovalService(prisma as unknown as PrismaClient, { audit: audit as never }),
    };
  }
  const grant = (actorEmail?: string) => ({
    approvalId: 'a1',
    tenantId: 't1',
    action: 'grant' as const,
    actorId: actorEmail ? 'user:u1' : 'apikey:k1',
    actorEmail,
  });

  it('rejects someone off the list, and API keys, before claiming', async () => {
    const { svc, tx } = service(pending);
    await expect(svc.resolve(grant('intruder@x.io'))).rejects.toMatchObject({
      code: 'approval_forbidden',
    });
    await expect(svc.resolve(grant())).rejects.toBeInstanceOf(ApprovalServiceError);
    expect(tx.approval.updateMany).not.toHaveBeenCalled();
  });

  it('matches the list ignoring case', async () => {
    const { svc } = service(pending);
    await expect(svc.resolve(grant('OnCall@X.io'))).resolves.toMatchObject({ id: 'a1' });
  });

  it('lets escalateTo approve only after escalation', async () => {
    await expect(service(pending).svc.resolve(grant('boss@x.io'))).rejects.toMatchObject({
      code: 'approval_forbidden',
    });
    const escalated = { ...pending, escalatedAt: new Date() };
    await expect(service(escalated).svc.resolve(grant('boss@x.io'))).resolves.toMatchObject({
      id: 'a1',
    });
  });

  it('refuses an answer after the deadline even if the sweeper has not run', async () => {
    const late = { ...pending, expiresAt: new Date(Date.now() - 1000) };
    await expect(service(late).svc.resolve(grant('oncall@x.io'))).rejects.toMatchObject({
      code: 'approval_not_pending',
    });
  });

  it('expires by cancelling the paused run, and audits it as the system', async () => {
    const { svc, tx, audit } = service(pending);
    await expect(svc.expire('a1')).resolves.toBe(true);
    expect(tx.approval.updateMany.mock.calls[0][0].data).toEqual({ status: 'EXPIRED' });
    expect(tx.execution.updateMany.mock.calls[0][0].data.status).toBe('CANCELLED');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'approval.expired', actorType: 'system' })
    );
  });

  it('does nothing if someone resolved it first', async () => {
    const { svc, tx, audit } = service(pending);
    tx.approval.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.expire('a1')).resolves.toBe(false);
    expect(tx.execution.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
