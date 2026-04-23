import type { PrismaClient } from '@prisma/client';
import {
  QuotaExceededError,
  assertRunbookQuota,
  assertRunsQuota,
  getTenantUsage,
  quotasFor,
  startOfUtcMonth,
} from '../../billing/quotas';

/**
 * Unit tests for the quota helpers. We do not hit the real DB — a
 * hand-rolled prisma stub keeps the tests fast and the control flow
 * obvious. The happy-path + limit-trip cases are the ones that
 * matter, so we park those front and center.
 */

function stubPrisma(state: {
  plan: string;
  runbookCount: number;
  tenantExists?: boolean;
  executionCount?: number;
}) {
  return {
    tenant: {
      findUnique: jest.fn(async () => (state.tenantExists === false ? null : { plan: state.plan })),
    },
    runbook: {
      count: jest.fn(async () => state.runbookCount),
    },
    execution: {
      count: jest.fn(async () => state.executionCount ?? 0),
    },
  } as unknown as PrismaClient;
}

describe('quotasFor', () => {
  it('defaults FREE to 3 runbooks', () => {
    delete process.env.NANORUN_QUOTA_FREE_RUNBOOKS;
    expect(quotasFor('FREE').activeRunbooks).toBe(3);
  });

  it('honours NANORUN_QUOTA_FREE_RUNBOOKS env override', () => {
    process.env.NANORUN_QUOTA_FREE_RUNBOOKS = '10';
    expect(quotasFor('FREE').activeRunbooks).toBe(10);
    delete process.env.NANORUN_QUOTA_FREE_RUNBOOKS;
  });

  it('treats env override `0` as unlimited', () => {
    process.env.NANORUN_QUOTA_FREE_RUNBOOKS = '0';
    expect(quotasFor('FREE').activeRunbooks).toBe(Number.POSITIVE_INFINITY);
    delete process.env.NANORUN_QUOTA_FREE_RUNBOOKS;
  });

  it('returns unlimited for BUSINESS and ENTERPRISE regardless of env', () => {
    process.env.NANORUN_QUOTA_FREE_RUNBOOKS = '1';
    expect(quotasFor('BUSINESS').activeRunbooks).toBe(Number.POSITIVE_INFINITY);
    expect(quotasFor('ENTERPRISE').activeRunbooks).toBe(Number.POSITIVE_INFINITY);
    delete process.env.NANORUN_QUOTA_FREE_RUNBOOKS;
  });
});

describe('assertRunbookQuota', () => {
  afterEach(() => {
    delete process.env.NANORUN_ANONYMOUS_MODE;
    delete process.env.NANORUN_QUOTA_FREE_RUNBOOKS;
  });

  it('bypasses the gate under anonymous mode', async () => {
    process.env.NANORUN_ANONYMOUS_MODE = 'true';
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 50 });
    await expect(assertRunbookQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('passes for FREE below the cap', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 2 });
    await expect(assertRunbookQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('throws QuotaExceededError for FREE exactly at the cap', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 3 });
    await expect(assertRunbookQuota(prisma, 't-1')).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('throws QuotaExceededError for FREE above the cap', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 99 });
    await expect(assertRunbookQuota(prisma, 't-1')).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('passes for TEAM regardless of count', async () => {
    const prisma = stubPrisma({ plan: 'TEAM', runbookCount: 10_000 });
    await expect(assertRunbookQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('passes for BUSINESS regardless of count', async () => {
    const prisma = stubPrisma({ plan: 'BUSINESS', runbookCount: 10_000 });
    await expect(assertRunbookQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('is a no-op when the tenant row is missing', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 100, tenantExists: false });
    await expect(assertRunbookQuota(prisma, 't-missing')).resolves.toBeUndefined();
  });

  it('includes current + limit on the thrown error for UX rendering', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 5 });
    try {
      await assertRunbookQuota(prisma, 't-1');
      fail('should have thrown');
    } catch (err) {
      const e = err as QuotaExceededError;
      expect(e.current).toBe(5);
      expect(e.limit).toBe(3);
      expect(e.resource).toBe('activeRunbooks');
    }
  });
});

describe('getTenantUsage', () => {
  it('serializes Infinity as null for unlimited tiers', async () => {
    const prisma = stubPrisma({ plan: 'BUSINESS', runbookCount: 7, executionCount: 9999 });
    const usage = await getTenantUsage(prisma, 't-1');
    expect(usage?.runbooks.limit).toBeNull();
    expect(usage?.runbooks.current).toBe(7);
    expect(usage?.runs.limit).toBeNull();
    expect(usage?.runs.current).toBe(9999);
    expect(usage?.plan).toBe('BUSINESS');
  });

  it('returns numeric limits for FREE (runbooks + runs)', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 2, executionCount: 15 });
    const usage = await getTenantUsage(prisma, 't-1');
    expect(usage?.runbooks.limit).toBe(3);
    expect(usage?.runbooks.current).toBe(2);
    expect(usage?.runs.limit).toBe(100);
    expect(usage?.runs.current).toBe(15);
  });

  it('emits an ISO periodStart matching start-of-UTC-month', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, executionCount: 0 });
    const usage = await getTenantUsage(prisma, 't-1');
    expect(usage?.runs.periodStart).toBe(startOfUtcMonth().toISOString());
  });

  it('returns null when tenant is missing', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, tenantExists: false });
    const usage = await getTenantUsage(prisma, 't-missing');
    expect(usage).toBeNull();
  });
});

describe('assertRunsQuota', () => {
  afterEach(() => {
    delete process.env.NANORUN_ANONYMOUS_MODE;
    delete process.env.NANORUN_QUOTA_FREE_RUNS;
  });

  it('bypasses the gate in anonymous mode', async () => {
    process.env.NANORUN_ANONYMOUS_MODE = 'true';
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, executionCount: 10_000 });
    await expect(assertRunsQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('passes for FREE below the 100-cap default', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, executionCount: 42 });
    await expect(assertRunsQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('throws for FREE at the cap', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, executionCount: 100 });
    await expect(assertRunsQuota(prisma, 't-1')).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('honours NANORUN_QUOTA_FREE_RUNS override', async () => {
    process.env.NANORUN_QUOTA_FREE_RUNS = '5';
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, executionCount: 5 });
    await expect(assertRunsQuota(prisma, 't-1')).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('passes for TEAM regardless of count', async () => {
    const prisma = stubPrisma({ plan: 'TEAM', runbookCount: 0, executionCount: 999_999 });
    await expect(assertRunsQuota(prisma, 't-1')).resolves.toBeUndefined();
  });

  it('includes runsPerMonth resource on the thrown error', async () => {
    const prisma = stubPrisma({ plan: 'FREE', runbookCount: 0, executionCount: 150 });
    try {
      await assertRunsQuota(prisma, 't-1');
      fail('should have thrown');
    } catch (err) {
      const e = err as QuotaExceededError;
      expect(e.resource).toBe('runsPerMonth');
      expect(e.current).toBe(150);
      expect(e.limit).toBe(100);
    }
  });
});

describe('startOfUtcMonth', () => {
  it('returns the first day of the month at 00:00:00 UTC', () => {
    const mid = new Date(Date.UTC(2026, 3, 17, 15, 30, 0));
    const start = startOfUtcMonth(mid);
    expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('handles January correctly (no negative-month edge)', () => {
    const mid = new Date(Date.UTC(2026, 0, 15));
    expect(startOfUtcMonth(mid).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
