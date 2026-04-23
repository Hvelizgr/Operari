import type { Plan, PrismaClient } from '@prisma/client';

/**
 * Plan-scoped quotas.
 *
 * FREE gets real limits so the paid tiers on the landing are not a
 * lie. TEAM, BUSINESS and ENTERPRISE get `Infinity` — paid plans
 * don't have product-imposed caps in this iteration; rate limiting
 * and pricing-page fair-use are separate concerns.
 *
 * Every default is overridable via env vars so the operator can
 * tune the funnel without a code change. An env override of `0`
 * explicitly means "unlimited" (matches the sentinel our check
 * functions use internally).
 */

export interface PlanQuotas {
  activeRunbooks: number;
  /**
   * Maximum number of Execution rows allowed for this tenant within
   * the current calendar month (UTC). Measured on the START of the
   * execution — once an execution is spawned it counts even if it
   * later fails or gets cancelled. FREE caps this so "unlimited runs"
   * on paid tiers is the real upgrade trigger.
   */
  runsPerMonth: number;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

function envLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed === 0 ? UNLIMITED : parsed;
}

export function quotasFor(plan: Plan): PlanQuotas {
  switch (plan) {
    case 'FREE':
      return {
        activeRunbooks: envLimit('NANORUN_QUOTA_FREE_RUNBOOKS', 3),
        runsPerMonth: envLimit('NANORUN_QUOTA_FREE_RUNS', 100),
      };
    case 'TEAM':
      return {
        activeRunbooks: envLimit('NANORUN_QUOTA_TEAM_RUNBOOKS', UNLIMITED),
        runsPerMonth: envLimit('NANORUN_QUOTA_TEAM_RUNS', UNLIMITED),
      };
    case 'BUSINESS':
    case 'ENTERPRISE':
    case 'PRO':
      return { activeRunbooks: UNLIMITED, runsPerMonth: UNLIMITED };
  }
}

export type QuotaResource = 'activeRunbooks' | 'runsPerMonth';

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    readonly resource: QuotaResource,
    readonly current: number,
    readonly limit: number
  ) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

interface QuotaCheckOptions {
  /** Allows self-host deployments to opt out entirely. */
  anonymousMode?: boolean;
}

function isAnonymous(options: QuotaCheckOptions): boolean {
  return options.anonymousMode ?? process.env.NANORUN_ANONYMOUS_MODE === 'true';
}

/**
 * Start of the current UTC calendar month. Using UTC (not the
 * operator's local time) means the quota resets at the same absolute
 * instant regardless of which region the DB or the caller sits in —
 * important for any self-host deployment that spans timezones.
 */
export function startOfUtcMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Count + limit check for runbook creation. Counts runbooks per
 * tenant regardless of `isActive` state — the operator cannot dodge
 * the quota by flipping isActive back and forth on existing rows.
 */
export async function assertRunbookQuota(
  prisma: PrismaClient,
  tenantId: string,
  options: QuotaCheckOptions = {}
): Promise<void> {
  if (isAnonymous(options)) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) return; // The caller will surface the missing-tenant error upstream.

  const limits = quotasFor(tenant.plan);
  if (!Number.isFinite(limits.activeRunbooks)) return;

  const current = await prisma.runbook.count({ where: { tenantId } });
  if (current >= limits.activeRunbooks) {
    throw new QuotaExceededError(
      `Plan ${tenant.plan} allows ${limits.activeRunbooks} runbook(s). Upgrade to create more.`,
      'activeRunbooks',
      current,
      limits.activeRunbooks
    );
  }
}

/**
 * Monthly runs quota. Counts Execution rows whose `startedAt` falls
 * in the current UTC month, scoped to the caller's tenant via the
 * workflow→runbook→tenant chain. We count STARTED runs (not just
 * successful) because the limit applies to "work offered to the
 * platform", not "work that succeeded" — otherwise a tenant could
 * thrash the runner with infinitely-failing runs for free.
 */
export async function assertRunsQuota(
  prisma: PrismaClient,
  tenantId: string,
  options: QuotaCheckOptions = {}
): Promise<void> {
  if (isAnonymous(options)) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) return;

  const limits = quotasFor(tenant.plan);
  if (!Number.isFinite(limits.runsPerMonth)) return;

  const monthStart = startOfUtcMonth();
  const current = await prisma.execution.count({
    where: {
      workflow: { tenantId },
      startedAt: { gte: monthStart },
    },
  });
  if (current >= limits.runsPerMonth) {
    throw new QuotaExceededError(
      `Plan ${tenant.plan} allows ${limits.runsPerMonth} runs per month. Upgrade for more.`,
      'runsPerMonth',
      current,
      limits.runsPerMonth
    );
  }
}

export interface TenantUsage {
  plan: Plan;
  runbooks: { current: number; limit: number | null };
  runs: { current: number; limit: number | null; periodStart: string };
}

/**
 * Summary for the settings "Plan & billing" usage bar. `limit: null`
 * means unlimited on this tier (we serialize Infinity as null so the
 * JSON response stays standards-compliant).
 */
export async function getTenantUsage(
  prisma: PrismaClient,
  tenantId: string
): Promise<TenantUsage | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) return null;
  const limits = quotasFor(tenant.plan);

  const monthStart = startOfUtcMonth();
  const [runbooks, runs] = await Promise.all([
    prisma.runbook.count({ where: { tenantId } }),
    prisma.execution.count({
      where: { workflow: { tenantId }, startedAt: { gte: monthStart } },
    }),
  ]);

  return {
    plan: tenant.plan,
    runbooks: {
      current: runbooks,
      limit: Number.isFinite(limits.activeRunbooks) ? limits.activeRunbooks : null,
    },
    runs: {
      current: runs,
      limit: Number.isFinite(limits.runsPerMonth) ? limits.runsPerMonth : null,
      periodStart: monthStart.toISOString(),
    },
  };
}
