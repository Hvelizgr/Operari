// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. QueuedBillingMeter imports env via logger;
// set compliant values up front.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import { Prisma } from '@prisma/client';

import { QueuedBillingMeter } from '../../billing/queued-billing-meter';

function buildPrismaStub(createImpl: jest.Mock): any {
  return { billingEvent: { create: createImpl } };
}

describe('QueuedBillingMeter', () => {
  it('enqueues a row and returns true on success', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'be-1' });
    const meter = new QueuedBillingMeter({ prisma: buildPrismaStub(create) });

    const result = await meter.record({
      type: 'run.started',
      customerId: 'cus_acme',
      value: 1,
      idempotencyKey: 'run.started:exec-1',
      metadata: { tenantId: 'tenant-1', executionId: 'exec-1' },
    });

    expect(result).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'run.started',
        customerId: 'cus_acme',
        value: 1,
        idempotencyKey: 'run.started:exec-1',
        tenantId: 'tenant-1',
      }),
    });
  });

  it('collapses a duplicate idempotencyKey (P2002) to true without throwing', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const create = jest.fn().mockRejectedValue(p2002);
    const meter = new QueuedBillingMeter({ prisma: buildPrismaStub(create) });

    const result = await meter.record({
      type: 'run.started',
      value: 1,
      idempotencyKey: 'run.started:exec-1',
    });

    expect(result).toBe(true);
  });

  it('refuses to enqueue without an idempotencyKey', async () => {
    const create = jest.fn();
    const meter = new QueuedBillingMeter({ prisma: buildPrismaStub(create) });

    const result = await meter.record({
      type: 'run.started',
      value: 1,
      // no idempotencyKey
    });
    expect(result).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns false on non-dedup Prisma failures, never throws', async () => {
    const otherErr = new Prisma.PrismaClientKnownRequestError('Connection terminated', {
      code: 'P2024',
      clientVersion: '5.22.0',
    });
    const create = jest.fn().mockRejectedValue(otherErr);
    const meter = new QueuedBillingMeter({ prisma: buildPrismaStub(create) });

    const result = await meter.record({
      type: 'run.started',
      value: 1,
      idempotencyKey: 'run.started:exec-1',
    });
    expect(result).toBe(false);
  });

  it('sets tenantId=null when metadata.tenantId is missing', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'be-1' });
    const meter = new QueuedBillingMeter({ prisma: buildPrismaStub(create) });

    await meter.record({
      type: 'run.completed',
      value: 1,
      idempotencyKey: 'run.completed:exec-1',
      metadata: { executionId: 'exec-1' }, // no tenantId
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: null }),
    });
  });
});
