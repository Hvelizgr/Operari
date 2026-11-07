import type { PrismaClient } from '@prisma/client';

import { CallWorkflowExecutor } from '../../../runbook/executors/call-workflow.executor';
import { WorkflowCallbackService } from '../../../runbook/services/workflow-callback.service';

jest.mock('../../../security/ssrf-guard', () => ({
  guardedFetch: (fetchFn: typeof fetch, url: string, init: RequestInit) => fetchFn(url, init),
}));

const row = {
  id: 'c1',
  tenantId: 't1',
  executionId: 'e1',
  stepId: 's1',
  status: 'RECEIVED',
  payload: { ok: true },
};

function build(executionStatus = 'PAUSED') {
  const prisma = {
    workflowCallback: {
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([]),
    },
    execution: {
      findUnique: jest.fn().mockResolvedValue({ status: executionStatus, userId: 'u1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    nodeLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const resume = jest.fn().mockResolvedValue(undefined);
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new WorkflowCallbackService(
    prisma as unknown as PrismaClient,
    resume,
    audit as never
  );
  return { prisma, resume, audit, service };
}

describe('WorkflowCallbackService', () => {
  it('stores only a hash of the token it hands out', async () => {
    const { service, prisma } = build();
    const { url } = await service.issue({
      tenantId: 't1',
      executionId: 'e1',
      stepId: 's1',
      expiresAt: new Date(),
    });
    const token = url.split('/').pop()!;
    expect(prisma.workflowCallback.create.mock.calls[0][0].data.tokenHash).not.toBe(token);
    expect(JSON.stringify(prisma.workflowCallback.create.mock.calls)).not.toContain(token);
  });

  it('resumes a paused run with the answer', async () => {
    const { service, resume } = build();
    await expect(service.receive('token', { ok: true })).resolves.toBe(true);
    expect(resume).toHaveBeenCalledWith({
      executionId: 'e1',
      userId: 'u1',
      tenantId: 't1',
      input: { callback: { ok: true } },
    });
  });

  it('refuses an unknown or used token without resuming', async () => {
    const { service, prisma, resume } = build();
    prisma.workflowCallback.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.receive('token', {})).resolves.toBe(false);
    expect(resume).not.toHaveBeenCalled();
  });

  it('keeps an answer that beats the pause, for the sweep to deliver', async () => {
    const { service, prisma, resume } = build('RUNNING');
    await service.receive('token', {});
    expect(resume).not.toHaveBeenCalled();

    prisma.execution.findUnique.mockResolvedValue({ status: 'PAUSED', userId: 'u1' });
    prisma.workflowCallback.findMany.mockResolvedValueOnce([{ id: 'c1' }]);
    await service.sweep();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('does not touch a run someone cancelled meanwhile', async () => {
    const { service, resume } = build('CANCELLED');
    await service.receive('token', {});
    expect(resume).not.toHaveBeenCalled();
  });

  it('puts the answer back if resuming fails', async () => {
    const { service, prisma, resume } = build();
    resume.mockRejectedValue(new Error('db'));
    await service.receive('token', {});
    expect(prisma.workflowCallback.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'RECEIVED' },
    });
  });

  it('fails the run when the deadline passes', async () => {
    const { service, prisma, audit } = build();
    prisma.workflowCallback.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...row, status: 'WAITING' }]);
    await service.sweep();
    expect(prisma.execution.updateMany.mock.calls[0][0].data.status).toBe('FAILED');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow.timed_out' })
    );
  });
});

describe('CallWorkflowExecutor', () => {
  const context = {
    runId: 'e1',
    stepId: 's1',
    tenantId: 't1',
    variables: { host: 'web-1' },
    previousOutputs: {},
    secrets: { key: 'abc' },
  } as never;
  const callbacks = {
    issue: jest.fn().mockResolvedValue({ id: 'c1', url: 'https://ops.io/webhook/x/SECRET' }),
    revoke: jest.fn().mockResolvedValue(undefined),
  };
  const executor = (fetchFn: jest.Mock) =>
    new CallWorkflowExecutor(() => callbacks as never, fetchFn as unknown as typeof fetch);

  beforeEach(() => jest.clearAllMocks());

  it('posts the body with callbackUrl and pauses, keeping the token out of the output', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true });
    const result = await executor(fetchFn).execute(
      {
        url: 'https://n8n.io/hook',
        body: '{"host":"{{vars.host}}"}',
        headers: { Authorization: 'Bearer {{secrets.key}}' },
      },
      context
    );

    const init = fetchFn.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({
      host: 'web-1',
      callbackUrl: 'https://ops.io/webhook/x/SECRET',
    });
    expect(init.headers.Authorization).toBe('Bearer abc');
    expect(result.paused).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it.each([
    ['an error status', jest.fn().mockResolvedValue({ ok: false, status: 500 })],
    ['a network failure', jest.fn().mockRejectedValue(new Error('refused'))],
  ])('fails without pausing on %s, and drops the address', async (_name, fetchFn) => {
    const result = await executor(fetchFn).execute({ url: 'https://n8n.io/hook' }, context);
    expect(result.success).toBe(false);
    expect(result.paused).toBeUndefined();
    expect(callbacks.revoke).toHaveBeenCalledWith('c1');
  });

  it('rejects a body that is not a JSON object before calling anything', async () => {
    const fetchFn = jest.fn();
    const result = await executor(fetchFn).execute(
      { url: 'https://n8n.io/hook', body: '[1,2]' },
      context
    );
    expect(result.success).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(callbacks.issue).not.toHaveBeenCalled();
  });

  it('calls nothing in a dry run', async () => {
    const fetchFn = jest.fn();
    const result = await executor(fetchFn).execute({ url: 'https://n8n.io/hook' }, {
      ...(context as object),
      dryRun: true,
    } as never);
    expect(result.success).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('caps the wait at seven days and floors it at a minute', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true });
    const low = await executor(fetchFn).execute({ url: 'https://x.io', timeoutSeconds: 1 }, context);
    const high = await executor(fetchFn).execute(
      { url: 'https://x.io', timeoutSeconds: 999999999 },
      context
    );
    expect(low.output).toMatchObject({ timeoutSeconds: 60 });
    expect(high.output).toMatchObject({ timeoutSeconds: 604800 });
  });
});
