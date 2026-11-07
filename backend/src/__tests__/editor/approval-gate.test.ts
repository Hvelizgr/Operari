import { PrismaClient } from '@prisma/client';

import { ExecutionService } from '../../editor/execution/execution.service';
import { NodeExecutor } from '../../editor/node-executor.service';

jest.mock('../../services/error-notification.service');
jest.mock('../../utils/error-persistence');
jest.mock('../../editor/execution/socket.service', () => ({
  socketService: {
    emitLog: jest.fn(),
    emitExecutionStatus: jest.fn(),
    emitNodeStatus: jest.fn(),
    initialize: jest.fn(),
  },
}));

const node = (id: string, type: string, config: Record<string, unknown>) => ({
  id,
  type,
  title: id,
  position: { x: 0, y: 0 },
  config,
});

const runbook = {
  id: 'rb',
  name: 'Restart',
  nodes: [
    node('gate', 'approval', { message: 'Restart?' }),
    node('after', 'wait', { durationMs: 1 }),
  ],
  connections: [{ id: 'c', source: 'gate', target: 'after' }],
};

/** The real dispatcher and executors, on a store that remembers logs. */
function build() {
  const logs: Array<Record<string, unknown>> = [];
  const execution = {
    id: 'run-1',
    runbookId: 'rb',
    userId: 'u1',
    status: 'RUNNING',
    resumeState: null as unknown,
    runbook,
  };
  const prisma = {
    execution: {
      findUnique: jest.fn().mockResolvedValue({ ...execution, runbook: { name: 'Restart' } }),
      findFirst: jest.fn(async () => execution),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(execution, data);
        return execution;
      }),
    },
    approval: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    nodeLog: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const log = { id: `log-${logs.length}`, startedAt: new Date(), ...data };
        logs.push(log);
        return log;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const log = logs.find(l => l.id === where.id)!;
          return Object.assign(log, data);
        }
      ),
      findFirst: jest.fn(async ({ where }: { where: { nodeId: string; status: string } }) =>
        logs.find(l => l.nodeId === where.nodeId && l.status === where.status)
      ),
    },
    tenant: { findUnique: jest.fn().mockResolvedValue({ plan: 'BUSINESS' }) },
  } as unknown as PrismaClient;

  const options = { audit: null, tracer: null, eventStore: null, meter: null };
  const service = new ExecutionService(prisma, options);
  const run = (service as unknown as { runWorkflow: (...args: unknown[]) => Promise<void> })
    .runWorkflow;
  const ctx = { executionId: 'run-1', runbookId: 'rb', userId: 'u1', tenantId: 't1' };
  return {
    execution,
    logs,
    service,
    start: () => run.call(service, 'run-1', runbook, {}, ctx, 't1'),
  };
}

const settled = () => new Promise(resolve => setTimeout(resolve, 200));

describe('approval gate through the real dispatcher', () => {
  it('surfaces a paused step to the engine', async () => {
    const prisma = {
      execution: {
        findUnique: jest.fn().mockResolvedValue({ runbookId: 'rb', userId: 'u1' }),
      },
      approval: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    } as unknown as PrismaClient;
    const result = await new NodeExecutor(prisma).execute(
      node('gate', 'approval', { message: 'Restart?' }) as never,
      { runId: 'run-1', tenantId: 't1' } as never
    );
    expect(result).toMatchObject({ isSuspended: true, approvalId: 'a1' });
  });

  it('stops the run before the next step', async () => {
    const { start, execution, logs } = build();
    await start();
    expect(execution.status).toBe('PAUSED');
    expect(logs.map(l => l.nodeId)).toEqual(['gate']);
    expect(logs[0].status).toBe('RUNNING');
  });

  it('runs the next step only after resuming, and closes the gate step', async () => {
    const { start, service, execution, logs } = build();
    await start();

    await service.resumeExecution({ executionId: 'run-1', userId: 'u1', tenantId: 't1' });
    await settled();

    expect(execution.status).toBe('SUCCESS');
    expect(logs.map(l => [l.nodeId, l.status])).toEqual([
      ['gate', 'SUCCESS'],
      ['after', 'SUCCESS'],
    ]);
  });

  it('hands resume input to the paused step, not to the one before it', async () => {
    const { start, service, execution } = build();
    await start();
    await service.resumeExecution({
      executionId: 'run-1',
      userId: 'u1',
      tenantId: 't1',
      input: { callback: { ok: true } },
    });
    await settled();
    expect(execution.status).toBe('SUCCESS');
    const state = execution.resumeState as { nodeOutputs: Record<string, unknown> };
    expect(state.nodeOutputs.gate).toMatchObject({ callback: { ok: true } });
  });
});
