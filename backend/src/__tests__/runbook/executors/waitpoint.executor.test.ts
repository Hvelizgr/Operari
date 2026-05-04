import type { PrismaClient } from '@prisma/client';

import { WaitpointExecutor } from '../../../runbook/executors/waitpoint.executor';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

interface WaitpointRow {
  id: string;
  tenantId: string;
  executionId: string | null;
  status: 'PENDING' | 'COMPLETED' | 'TIMED_OUT' | 'CANCELLED';
  expiresAt: Date | null;
  tags: string[];
  completedValue: unknown;
  completedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const buildPrisma = () => {
  const rows: WaitpointRow[] = [];
  const prisma = {
    waitpoint: {
      create: jest.fn(async (args: { data: Partial<WaitpointRow> }) => {
        const row: WaitpointRow = {
          id: args.data.id!,
          tenantId: args.data.tenantId!,
          executionId: args.data.executionId ?? null,
          status: 'PENDING',
          expiresAt: args.data.expiresAt ?? null,
          tags: args.data.tags ?? [],
          completedValue: null,
          completedBy: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
    },
  } as unknown as PrismaClient;
  return { prisma, rows };
};

const ctx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'exec-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't1',
  ...overrides,
});

describe('WaitpointExecutor', () => {
  it('returns paused with the public URL + waitpointId', async () => {
    const { prisma, rows } = buildPrisma();
    const executor = new WaitpointExecutor(prisma);
    const result = await executor.execute({}, ctx());

    expect(result.success).toBe(true);
    expect(result.paused).toBe(true);
    expect(result.output).toMatchObject({
      status: 'PENDING',
      waitpointId: expect.stringMatching(/^wpt_[0-9a-f]{32}$/),
      url: expect.stringMatching(/\/api\/waitpoints\/wpt_[0-9a-f]{32}\/complete$/),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].executionId).toBe('exec-1');
    expect(rows[0].tenantId).toBe('t1');
  });

  it('persists timeoutSeconds as expiresAt in the future', async () => {
    const { prisma, rows } = buildPrisma();
    const executor = new WaitpointExecutor(prisma);
    const before = Date.now();
    await executor.execute({ timeoutSeconds: 60 }, ctx());
    expect(rows[0].expiresAt).not.toBeNull();
    expect(rows[0].expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 60_000 - 5);
  });

  it('passes tags through', async () => {
    const { prisma, rows } = buildPrisma();
    const executor = new WaitpointExecutor(prisma);
    await executor.execute({ tags: ['deploy', 'prod'] }, ctx());
    expect(rows[0].tags).toEqual(['deploy', 'prod']);
  });

  it('skips DB work in dry-run and returns AUTO_COMPLETED', async () => {
    const { prisma, rows } = buildPrisma();
    const executor = new WaitpointExecutor(prisma);
    const events: Array<{ type: string; text: string }> = [];
    const result = await executor.execute(
      { message: 'awaiting deploy approval' },
      ctx({
        dryRun: true,
        emit: e => events.push({ type: e.type, text: e.text }),
      })
    );

    expect(result.paused).toBeUndefined();
    expect(result.output).toMatchObject({ dryRun: true, status: 'AUTO_COMPLETED' });
    expect(rows).toHaveLength(0);
    expect(events.some(e => e.text.includes('[dry-run]'))).toBe(true);
  });

  it('resolves template message', async () => {
    const { prisma } = buildPrisma();
    const executor = new WaitpointExecutor(prisma);
    const events: Array<{ type: string; text: string }> = [];
    await executor.execute(
      { message: 'pending {{vars.env}}' },
      ctx({
        variables: { env: 'production' },
        emit: e => events.push({ type: e.type, text: e.text }),
      })
    );
    expect(events.some(e => e.text.includes('pending production'))).toBe(true);
  });
});
