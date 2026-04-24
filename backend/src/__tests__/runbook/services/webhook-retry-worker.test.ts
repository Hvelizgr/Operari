process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import type { ExecutionService } from '../../../editor/execution/execution.service';
import type { WebhookService } from '../../../runbook/services/webhook.service';
import { WebhookRetryWorker } from '../../../runbook/services/webhook-retry-worker';

type RowShape = {
  id: string;
  status: string;
  retryAttempts: number;
  nextRetryAt: Date | null;
  webhookId: string;
  tenantId: string;
  body: unknown;
  webhook: {
    id: string;
    workflowId: string;
    tenantId: string;
    source: string;
    workflow: { userId: string };
  };
};

const row = (overrides: Partial<RowShape> = {}): RowShape => ({
  id: 'r-1',
  status: 'error',
  retryAttempts: 0,
  nextRetryAt: new Date('2026-04-01T00:00:00Z'),
  webhookId: 'wh-1',
  tenantId: 't-1',
  body: { ref: 'refs/heads/main' },
  webhook: {
    id: 'wh-1',
    workflowId: 'wf-1',
    tenantId: 't-1',
    source: 'generic',
    workflow: { userId: 'user-1' },
  },
  ...overrides,
});

function buildPrismaStub(rows: RowShape[]) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const prisma = {
    webhookReceipt: {
      findMany: jest.fn(
        async (args: { where: { nextRetryAt: { lte: Date; not: null } }; take: number }) => {
          return rows
            .filter(
              r =>
                r.status === 'error' &&
                r.nextRetryAt !== null &&
                r.nextRetryAt <= args.where.nextRetryAt.lte
            )
            .slice(0, args.take);
        }
      ),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: args.where.id, data: args.data });
        const target = rows.find(r => r.id === args.where.id);
        if (target) Object.assign(target, args.data);
        return target;
      }),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma: prisma as any, updates };
}

function buildWebhookService(): WebhookService {
  return {
    mapPayloadToVariables: jest.fn((_source, _event, body) => ({ ...body, mapped: true })),
  } as unknown as WebhookService;
}

function buildExecutionService(response: 'success' | 'throw'): ExecutionService {
  return {
    execute: jest.fn(async () => {
      if (response === 'throw') throw new Error('runtime down');
      return { id: 'exec-replay-1' };
    }),
  } as unknown as ExecutionService;
}

const ANCHOR = new Date('2026-04-01T00:30:00Z');
const now = () => ANCHOR;

describe('WebhookRetryWorker.runOnce', () => {
  it('replays a due error receipt and flips it to replayed_success', async () => {
    const rows = [row()];
    const { prisma, updates } = buildPrismaStub(rows);
    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: buildWebhookService(),
      executionService: buildExecutionService('success'),
      now,
    });

    const report = await worker.runOnce();
    expect(report.replayed).toBe(1);
    expect(report.retried).toBe(0);
    expect(report.exhausted).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('replayed_success');
    expect(updates[0].data.executionId).toBe('exec-replay-1');
    expect(updates[0].data.nextRetryAt).toBeNull();
  });

  it('reschedules with exponential backoff when execute throws', async () => {
    const rows = [row({ retryAttempts: 1 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: buildWebhookService(),
      executionService: buildExecutionService('throw'),
      now,
      baseDelayMs: 60_000,
      maxDelayMs: 30 * 60_000,
    });

    const report = await worker.runOnce();
    expect(report.retried).toBe(1);
    expect(updates[0].data.retryAttempts).toBe(2);
    // attempts=2 → base * 2^(2-1) = 120_000ms
    expect(updates[0].data.nextRetryAt).toEqual(new Date(ANCHOR.getTime() + 120_000));
    expect(updates[0].data.status).toBeUndefined(); // status left as 'error'
  });

  it('flips to error_exhausted when retryAttempts reaches maxAttempts', async () => {
    const rows = [row({ retryAttempts: 2 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: buildWebhookService(),
      executionService: buildExecutionService('throw'),
      now,
      maxAttempts: 3,
    });

    const report = await worker.runOnce();
    expect(report.exhausted).toBe(1);
    expect(updates[0].data.status).toBe('error_exhausted');
    expect(updates[0].data.retryAttempts).toBe(3);
    expect(updates[0].data.nextRetryAt).toBeNull();
  });

  it('skips rows whose nextRetryAt is in the future', async () => {
    const future = new Date(ANCHOR.getTime() + 60_000);
    const rows = [row({ nextRetryAt: future })];
    const { prisma } = buildPrismaStub(rows);
    const exec = buildExecutionService('success');
    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: buildWebhookService(),
      executionService: exec,
      now,
    });
    const report = await worker.runOnce();
    expect(report.scanned).toBe(0);
    expect(exec.execute).not.toHaveBeenCalled();
  });

  it('skips rows whose nextRetryAt is null (never-retry receipts)', async () => {
    const rows = [row({ nextRetryAt: null })];
    const { prisma } = buildPrismaStub(rows);
    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: buildWebhookService(),
      executionService: buildExecutionService('success'),
      now,
    });
    const report = await worker.runOnce();
    expect(report.scanned).toBe(0);
  });

  it('passes webhook body through mapPayloadToVariables before execute', async () => {
    const wh = buildWebhookService();
    const exec = buildExecutionService('success');
    const rows = [row({ body: { raw: 1 } })];
    const { prisma } = buildPrismaStub(rows);

    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: wh,
      executionService: exec,
      now,
    });
    await worker.runOnce();

    expect(wh.mapPayloadToVariables).toHaveBeenCalledWith('generic', undefined, { raw: 1 });
    expect(exec.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-1',
        userId: 'user-1',
        tenantId: 't-1',
        trigger: 'WEBHOOK',
        input: { raw: 1, mapped: true },
      })
    );
  });

  it('caps backoff at maxDelayMs', async () => {
    const rows = [row({ retryAttempts: 10 })]; // attempts=11 would overflow
    const { prisma, updates } = buildPrismaStub(rows);
    const worker = new WebhookRetryWorker({
      prisma,
      webhookService: buildWebhookService(),
      executionService: buildExecutionService('throw'),
      now,
      baseDelayMs: 1_000,
      maxDelayMs: 5_000,
      maxAttempts: 100, // force retry path, not exhausted
    });
    await worker.runOnce();
    expect(updates[0].data.nextRetryAt).toEqual(new Date(ANCHOR.getTime() + 5_000));
  });
});
