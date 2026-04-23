import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../config/logger.config';

/**
 * Safety net that rejects queries against tenant-scoped tables
 * (Execution, NodeLog, ExecutionError) when they forget to filter by
 * tenantId.
 *
 * Background: every tenant-scope leak we have seen in this codebase
 * came from a query like `prisma.execution.findMany({ where: { status } })`
 * that shipped without a tenantId filter. This middleware makes that
 * class of bug throw at development/test time and log loudly in
 * production so it surfaces in Sentry before it surfaces as a support
 * ticket.
 *
 * Accepted "scoped" shapes:
 *   - `where.tenantId` directly (the normal pattern now that the
 *     column exists).
 *   - A relation filter that carries tenantId (e.g.
 *     `where.workflow.tenantId`, `where.execution.tenantId`). This
 *     keeps pre-C4 callers working while they migrate.
 *   - `where.id` equality — `findUnique({ where: { id } })` is a
 *     primary-key lookup and already returns at most one row. The
 *     caller is still responsible for asserting the row belongs to
 *     their tenant before returning it to a user; the guard cannot
 *     assert that here.
 *
 * Cross-tenant queries (admin analytics, cron sweeps over all runs)
 * opt out by setting `NANORUN_ALLOW_CROSS_TENANT_QUERY: true` on the
 * query args — a deliberate, grep-able flag that reviewers can spot.
 * The flag is stripped before the query reaches Prisma.
 *
 * Implementation notes:
 *   - We use the deprecated `$use` middleware rather than `$extends`
 *     because the extended client type drops `$on`/`$use` from its
 *     public surface, which ripples through dozens of call sites that
 *     pass the client around as `PrismaClient`. `$use` keeps the type
 *     intact. Prisma has committed to supporting `$use` through at
 *     least v7 (see prisma/prisma#10188).
 */

export class TenantScopeViolationError extends Error {
  constructor(model: string, action: string) {
    super(
      `Tenant-scope guard: ${model}.${action}() called without a tenantId ` +
        `filter. Every query to ${model} must include where.tenantId (or a ` +
        `relation filter that carries tenantId). Cross-tenant queries must ` +
        `opt in via NANORUN_ALLOW_CROSS_TENANT_QUERY.`
    );
    this.name = 'TenantScopeViolationError';
  }
}

const GUARDED_MODELS: ReadonlySet<string> = new Set(['Execution', 'NodeLog', 'ExecutionError']);

/**
 * Prisma actions that don't accept a `where` clause (create paths)
 * or that are irrelevant to tenant scoping. `upsert` is handled
 * specially below because it carries both `where` and `create`.
 */
const UNGUARDED_ACTIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'executeRaw',
  'queryRaw',
  'runCommandRaw',
]);

type MaybeWhere = {
  where?: unknown;
  NANORUN_ALLOW_CROSS_TENANT_QUERY?: boolean;
};

function hasTenantFilter(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  const w = where as Record<string, unknown>;

  if ('tenantId' in w && w.tenantId !== undefined) return true;
  if ('id' in w && typeof w.id === 'string') return true;

  // Accept a relation filter that carries tenantId at any depth-1
  // level — e.g. { workflow: { tenantId } }, { execution: { tenantId } }.
  for (const key of Object.keys(w)) {
    const val = w[key];
    if (val && typeof val === 'object' && 'tenantId' in (val as object)) {
      return true;
    }
  }

  // AND: one scoped branch is enough — the intersection with any
  // additional filter is still a subset of the tenant.
  if (Array.isArray(w.AND) && w.AND.some(hasTenantFilter)) return true;
  // OR: every branch must carry a tenantId, otherwise the union
  // leaks the non-scoped branch across tenants.
  if (Array.isArray(w.OR) && w.OR.length > 0 && w.OR.every(hasTenantFilter)) return true;

  return false;
}

function reportViolation(model: string, action: string): void {
  const err = new TenantScopeViolationError(model, action);
  if (process.env.NODE_ENV === 'production') {
    // Don't tank live traffic on a safety-net violation — log loudly
    // so Sentry picks it up, then let the underlying query run. The
    // Execution / NodeLog / ExecutionError rows still carry tenantId
    // at the DB level, so a reviewer can trace the leak via logs.
    logger.error({ err, model, action }, 'Tenant-scope guard violation (prod soft-fail)');
    return;
  }
  throw err;
}

/**
 * Install the guard on a PrismaClient. Call once, early in bootstrap.
 * Idempotent in practice — Prisma dedupes identical `$use` handlers
 * only at the reference level, so don't reinstall it, but a second
 * call is not fatal either.
 */
export function installTenantScopeGuard(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    const { model, action, args } = params;
    if (model && GUARDED_MODELS.has(model) && !UNGUARDED_ACTIONS.has(action)) {
      const guardArgs = (args ?? {}) as MaybeWhere;
      if (guardArgs.NANORUN_ALLOW_CROSS_TENANT_QUERY === true) {
        // Strip the flag before the query reaches Prisma — passing
        // an unknown top-level key would otherwise fail validation.
        delete guardArgs.NANORUN_ALLOW_CROSS_TENANT_QUERY;
      } else {
        const whereSource = action === 'upsert' ? (guardArgs.where ?? {}) : guardArgs.where;
        if (!hasTenantFilter(whereSource)) {
          reportViolation(model, action);
        }
      }
    }
    return next(params);
  });
}

// Re-export Prisma namespace so callers can type query arg shapes
// without a separate import. Not strictly required, but trims the
// import surface for routes that only touch the guard + Prisma.
export { Prisma };
