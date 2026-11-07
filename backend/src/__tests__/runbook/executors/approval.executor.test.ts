import type { PrismaClient } from '@prisma/client';

import { AuditService } from '../../../audit/audit.service';
import { ApprovalExecutor } from '../../../runbook/executors/approval.executor';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

class FakeAudit {
  public events: Array<{ type: string; tenantId: string; payload: Record<string, unknown> }> = [];
  async record(input: { type: string; tenantId: string; payload: Record<string, unknown> }) {
    this.events.push(input);
    return { id: 'evt-1', hash: 'x'.repeat(64), seq: BigInt(this.events.length) };
  }
}

const buildPrisma = (executionRow: { runbookId: string; userId: string } | null) =>
  ({
    execution: {
      findUnique: jest.fn().mockResolvedValue(executionRow),
    },
    approval: {
      create: jest.fn().mockResolvedValue({ id: 'approval-1' }),
    },
  }) as unknown as PrismaClient;

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  tenantId: 'tenant-1',
  variables: {},
  previousOutputs: {},
  ...over,
});

describe('ApprovalExecutor', () => {
  it('creates an Approval row, returns paused=true, and emits approval.requested', async () => {
    const prisma = buildPrisma({ runbookId: 'wf-1', userId: 'user-1' });
    const audit = new FakeAudit();
    const executor = new ApprovalExecutor(prisma, {
      audit: audit as unknown as AuditService,
    });

    const result = await executor.execute(
      { message: 'Approve deploy?', approvers: ['eng-lead@x.io'], timeoutSeconds: 1800 },
      ctx()
    );

    expect(result.success).toBe(true);
    expect(result.paused).toBe(true);
    expect((result.output as { approvalId: string }).approvalId).toBe('approval-1');

    expect(prisma.approval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runbookId: 'wf-1',
        executionId: 'run-1',
        stepId: 'step-1',
        status: 'PENDING',
        message: 'Approve deploy?',
        requestedBy: 'user-1',
      }),
    });

    expect(audit.events).toHaveLength(1);
    const event = audit.events[0];
    expect(event.type).toBe('approval.requested');
    expect(event.tenantId).toBe('tenant-1');
    expect(event.payload).toMatchObject({
      executionId: 'run-1',
      runbookId: 'wf-1',
      stepId: 'step-1',
      approvalId: 'approval-1',
      message: 'Approve deploy?',
      approvers: ['eng-lead@x.io'],
      timeoutSeconds: 1800,
    });
  });

  it('skips audit when tenantId is missing', async () => {
    const prisma = buildPrisma({ runbookId: 'wf-1', userId: 'user-1' });
    const audit = new FakeAudit();
    const executor = new ApprovalExecutor(prisma, {
      audit: audit as unknown as AuditService,
    });

    await executor.execute({ message: 'Approve?' }, ctx({ tenantId: '' }));

    expect(audit.events).toHaveLength(0);
  });

  it('does not call audit when audit is explicitly null', async () => {
    const prisma = buildPrisma({ runbookId: 'wf-1', userId: 'user-1' });
    const executor = new ApprovalExecutor(prisma, { audit: null });

    const result = await executor.execute({ message: 'Approve?' }, ctx());

    expect(result.paused).toBe(true);
  });

  it('returns failure when execution lookup is empty', async () => {
    const prisma = buildPrisma(null);
    const audit = new FakeAudit();
    const executor = new ApprovalExecutor(prisma, {
      audit: audit as unknown as AuditService,
    });

    const result = await executor.execute({ message: 'Approve?' }, ctx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(audit.events).toHaveLength(0);
  });

  it('does not throw when audit.record itself fails', async () => {
    const prisma = buildPrisma({ runbookId: 'wf-1', userId: 'user-1' });
    const brokenAudit = {
      record: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as AuditService;

    const executor = new ApprovalExecutor(prisma, { audit: brokenAudit });

    await expect(executor.execute({ message: 'Approve?' }, ctx())).resolves.toMatchObject({
      success: true,
      paused: true,
    });
  });

  it('resolves message templates against context.variables', async () => {
    const prisma = buildPrisma({ runbookId: 'wf-1', userId: 'user-1' });
    const audit = new FakeAudit();
    const executor = new ApprovalExecutor(prisma, {
      audit: audit as unknown as AuditService,
    });

    await executor.execute(
      { message: 'Deploy {{vars.service}} to {{vars.env}}?' },
      ctx({ variables: { service: 'api', env: 'production' } })
    );

    expect(prisma.approval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ message: 'Deploy api to production?' }),
    });
    expect(audit.events[0].payload.message).toBe('Deploy api to production?');
  });
});

describe('ApprovalExecutor notifications', () => {
  const context = {
    runId: 'run-1',
    stepId: 'step-1',
    tenantId: 't1',
    variables: { lead: 'Lead@x.io' },
    previousOutputs: {},
    secrets: { hook: 'https://hooks.slack.com/x' },
  } as never;

  function build() {
    const prisma = {
      execution: {
        findUnique: jest.fn().mockResolvedValue({
          runbookId: 'r1',
          userId: 'u1',
          runbook: { name: 'Restart' },
        }),
      },
      approval: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };
    const notifier = { send: jest.fn().mockResolvedValue({ slack: 'sent' }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const executor = new ApprovalExecutor(prisma as never, {
      audit: audit as never,
      notifier: notifier as never,
    });
    return { executor, prisma, notifier, audit };
  }

  it('stores who may approve and notifies without holding the step', async () => {
    const { executor, prisma, notifier } = build();
    let release: (value: unknown) => void = () => undefined;
    notifier.send.mockReturnValue(new Promise(resolve => (release = resolve)));

    const result = await executor.execute(
      {
        message: 'Restart?',
        approvers: 'oncall@x.io, {{vars.lead}}',
        slackWebhookUrl: '{{secrets.hook}}',
      },
      context
    );

    expect(result.paused).toBe(true);
    expect(prisma.approval.create.mock.calls[0][0].data.approvers).toEqual([
      'oncall@x.io',
      'lead@x.io',
    ]);
    expect(prisma.approval.create.mock.calls[0][0].data.notifyTargets).toBeUndefined();
    expect(notifier.send).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: 'a1', runbookName: 'Restart', escalated: false }),
      { emails: ['oncall@x.io', 'lead@x.io'], slackWebhookUrl: 'https://hooks.slack.com/x' }
    );
    release({});
  });

  it('turns deadlines into dates, with a one minute floor', async () => {
    const { executor, prisma } = build();
    const before = Date.now();
    await executor.execute(
      { message: 'x', timeoutSeconds: 5, escalateAfterSeconds: 300, escalateTo: 'boss@x.io' },
      context
    );
    const data = prisma.approval.create.mock.calls[0][0].data;
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(data.escalateAt.getTime()).toBeGreaterThanOrEqual(before + 300_000);
    expect(data.escalateTo).toEqual(['boss@x.io']);
  });

  it('never puts a webhook or token in the audit trail', async () => {
    const { executor, audit } = build();
    await executor.execute({ message: 'x', slackWebhookUrl: '{{secrets.hook}}' }, context);
    await new Promise(resolve => setImmediate(resolve));
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('hooks.slack.com');
  });

  it('stays quiet in a dry run', async () => {
    const { executor, notifier } = build();
    await executor.execute({ message: 'x', approvers: 'a@x.io' }, {
      ...(context as object),
      dryRun: true,
    } as never);
    expect(notifier.send).not.toHaveBeenCalled();
  });
});
