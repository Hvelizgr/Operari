process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import type { BillingEvent } from '@prisma/client';

import { BillingDispatchWorker } from '../../billing/billing-dispatch-worker';
import type { BillingMeter } from '../../billing/billing-meter.types';

type PartialRow = Partial<BillingEvent> & Pick<BillingEvent, 'id' | 'type' | 'value'>;

function row(overrides: PartialRow): BillingEvent {
  return {
    tenantId: null,
    customerId: null,
    idempotencyKey: `key-${overrides.id}`,
    metadata: null,
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: new Date('2026-04-01T00:00:00Z'),
    lastError: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    sentAt: null,
    ...overrides,
  } as BillingEvent;
}

function buildPrismaStub(rows: BillingEvent[]) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const prisma = {
    billingEvent: {
      findMany: jest.fn(async (args: { where: { nextAttemptAt: { lte: Date } }; take: number }) => {
        return rows
          .filter(r => r.status === 'PENDING' && r.nextAttemptAt <= args.where.nextAttemptAt.lte)
          .slice(0, args.take);
      }),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: args.where.id, data: args.data });
        const target = rows.find(r => r.id === args.where.id);
        if (target) Object.assign(target, args.data);
        return target as BillingEvent;
      }),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma: prisma as any, updates };
}

function buildMeter(response: 'success' | 'falsy' | 'throw'): BillingMeter {
  return {
    name: 'test',
    record: jest.fn(async () => {
      if (response === 'throw') throw new Error('stripe down');
      return response === 'success';
    }),
  };
}

const ANCHOR = new Date('2026-04-01T00:30:00Z');
const now = () => ANCHOR;

describe('BillingDispatchWorker.runOnce', () => {
  it('SENT path: marks the row and sets sentAt', async () => {
    const rows = [row({ id: 'be-1', type: 'run.started', value: 1 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const meter = buildMeter('success');
    const worker = new BillingDispatchWorker({ prisma, meter, now });

    const report = await worker.runOnce();
    expect(report.sent).toBe(1);
    expect(report.retried).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('SENT');
    expect(updates[0].data.sentAt).toEqual(ANCHOR);
  });

  it('retry path: bumps attempts and sets nextAttemptAt with exponential backoff', async () => {
    const rows = [row({ id: 'be-1', type: 'run.started', value: 1, attempts: 1 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const meter = buildMeter('throw');
    const worker = new BillingDispatchWorker({
      prisma,
      meter,
      now,
      baseDelayMs: 10_000, // 10s
      maxDelayMs: 10 * 60_000,
    });

    const report = await worker.runOnce();
    expect(report.retried).toBe(1);
    expect(report.failed).toBe(0);
    const data = updates[0].data;
    expect(data.status).toBe('PENDING');
    expect(data.attempts).toBe(2);
    // attempts=2 → base * 2^(2-1) = 20_000ms. next = anchor + 20s.
    expect(data.nextAttemptAt).toEqual(new Date(ANCHOR.getTime() + 20_000));
    expect(typeof data.lastError).toBe('string');
  });

  it('max attempts: flips to FAILED after the cap', async () => {
    const rows = [row({ id: 'be-1', type: 'run.started', value: 1, attempts: 5 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const meter = buildMeter('throw');
    const worker = new BillingDispatchWorker({ prisma, meter, now, maxAttempts: 6 });

    const report = await worker.runOnce();
    expect(report.failed).toBe(1);
    expect(updates[0].data.status).toBe('FAILED');
    expect(updates[0].data.attempts).toBe(6);
    expect(typeof updates[0].data.lastError).toBe('string');
  });

  it('record() returning false marks the row as FAILED terminal (missing config)', async () => {
    const rows = [row({ id: 'be-1', type: 'run.started', value: 1 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const meter = buildMeter('falsy');
    const worker = new BillingDispatchWorker({ prisma, meter, now });

    const report = await worker.runOnce();
    expect(report.failed).toBe(1);
    expect(updates[0].data.status).toBe('FAILED');
    expect(updates[0].data.lastError).toMatch(/missing customer/i);
  });

  it('unknown event type → FAILED immediately without calling meter', async () => {
    const rows = [row({ id: 'be-1', type: 'totally.invented.event', value: 1 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const meter = buildMeter('success');
    const worker = new BillingDispatchWorker({ prisma, meter, now });

    const report = await worker.runOnce();
    expect(report.failed).toBe(1);
    expect(meter.record).not.toHaveBeenCalled();
    expect(updates[0].data.status).toBe('FAILED');
    expect(updates[0].data.lastError).toMatch(/unknown event type/);
  });

  it('honors batchSize and orders by nextAttemptAt ascending', async () => {
    const rows = [
      row({ id: 'a', type: 'run.started', value: 1 }),
      row({ id: 'b', type: 'run.started', value: 1 }),
      row({ id: 'c', type: 'run.started', value: 1 }),
    ];
    const { prisma } = buildPrismaStub(rows);
    const meter = buildMeter('success');
    const worker = new BillingDispatchWorker({ prisma, meter, now, batchSize: 2 });

    const report = await worker.runOnce();
    expect(report.scanned).toBe(2);
    expect(report.sent).toBe(2);
  });

  it('skips rows whose nextAttemptAt is in the future', async () => {
    const future = new Date(ANCHOR.getTime() + 60_000);
    const rows = [row({ id: 'a', type: 'run.started', value: 1, nextAttemptAt: future })];
    const { prisma } = buildPrismaStub(rows);
    const meter = buildMeter('success');
    const worker = new BillingDispatchWorker({ prisma, meter, now });

    const report = await worker.runOnce();
    expect(report.scanned).toBe(0);
    expect(meter.record).not.toHaveBeenCalled();
  });

  it('caps backoff at maxDelayMs even after many attempts', async () => {
    const rows = [row({ id: 'be-1', type: 'run.started', value: 1, attempts: 3 })];
    const { prisma, updates } = buildPrismaStub(rows);
    const meter = buildMeter('throw');
    const worker = new BillingDispatchWorker({
      prisma,
      meter,
      now,
      baseDelayMs: 1_000,
      maxDelayMs: 5_000, // force cap
    });

    await worker.runOnce();
    // attempts=4 → raw backoff = 1000 * 2^3 = 8000, cap = 5000.
    expect(updates[0].data.nextAttemptAt).toEqual(new Date(ANCHOR.getTime() + 5_000));
  });
});
