import { Response, Router } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

// Anonymous fallback for dev/single-tenant self-host. Same pattern as
// /api/runs and /api/approvals — the in-app pages call this without an
// API key; the v1 surface (when added) will require `dashboard:read`.
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

/**
 * GET /api/dashboard/overview
 *
 * Single aggregated payload that powers the Dashboard page. Designed to
 * replace ~6 separate fetches the page would otherwise need (pulse KPIs,
 * attention items, live runs, recent runs, 7-day trend, top runbooks,
 * health). One round-trip, ~30s server-friendly cache window.
 */
router.get('/overview', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stuckThreshold = new Date(now.getTime() - 5 * 60 * 1000);
  const since2h = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  // Delta window for the "what changed in 24h" card. Prior-24h is
  // the slice between 48h ago and 24h ago so we can compute a
  // this-period-vs-previous-period comparison.
  const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Execution now carries tenantId directly (post-C4), so filter
  // against the denormalized column — eliminates the join to Runbook
  // and lets Postgres serve these queries from the composite index
  // (tenantId, status, startedAt DESC).
  const tenantWorkflowFilter = { tenantId };

  const [
    runs24hCount,
    runs24hSuccess,
    runs24hFinished,
    pendingApprovalsCount,
    pendingApprovalsList,
    stuckRuns,
    recentFailures,
    liveRuns,
    recentRuns,
    runs7d,
    topRunbooksRaw,
    webhookStats,
    // "What changed in 24h" aggregates. Each is a single count — the
    // card shows absolute numbers + a delta against the prior window.
    newRunbooks24h,
    priorRuns24h,
    newApprovals24h,
    firedMonitors24h,
  ] = await Promise.all([
    prisma.execution.count({
      where: { ...tenantWorkflowFilter, startedAt: { gte: since24h } },
    }),
    prisma.execution.count({
      where: {
        ...tenantWorkflowFilter,
        startedAt: { gte: since24h },
        status: 'SUCCESS',
      },
    }),
    prisma.execution.findMany({
      where: {
        ...tenantWorkflowFilter,
        startedAt: { gte: since24h },
        duration: { not: null },
        status: { in: ['SUCCESS', 'FAILED'] },
      },
      select: { duration: true },
    }),
    prisma.approval.count({
      where: { runbook: { tenantId }, status: 'PENDING' },
    }),
    prisma.approval.findMany({
      where: { runbook: { tenantId }, status: 'PENDING' },
      include: { runbook: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.execution.findMany({
      where: {
        ...tenantWorkflowFilter,
        status: 'RUNNING',
        startedAt: { lt: stuckThreshold },
      },
      include: { runbook: { select: { name: true } } },
      orderBy: { startedAt: 'asc' },
      take: 5,
    }),
    prisma.execution.findMany({
      where: {
        ...tenantWorkflowFilter,
        status: 'FAILED',
        completedAt: { gte: since2h },
      },
      include: { runbook: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
    prisma.execution.findMany({
      where: { ...tenantWorkflowFilter, status: 'RUNNING' },
      include: { runbook: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.execution.findMany({
      where: tenantWorkflowFilter,
      include: { runbook: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.execution.findMany({
      where: { ...tenantWorkflowFilter, startedAt: { gte: since7d } },
      select: { startedAt: true, status: true },
    }),
    prisma.execution.groupBy({
      by: ['runbookId'],
      where: { ...tenantWorkflowFilter, startedAt: { gte: since7d } },
      _count: { _all: true },
      orderBy: { _count: { runbookId: 'desc' } },
      take: 5,
    }),
    prisma.webhook.aggregate({
      where: { tenantId, isActive: true },
      _count: { _all: true },
      _max: { lastTriggeredAt: true },
    }),
    prisma.runbook.count({
      where: { tenantId, createdAt: { gte: since24h } },
    }),
    prisma.execution.count({
      where: {
        ...tenantWorkflowFilter,
        startedAt: { gte: since48h, lt: since24h },
      },
    }),
    prisma.approval.count({
      where: { runbook: { tenantId }, createdAt: { gte: since24h } },
    }),
    prisma.monitor.count({
      where: { tenantId, lastFiredAt: { gte: since24h } },
    }),
  ]);

  const successRate24h = runs24hCount > 0 ? runs24hSuccess / runs24hCount : null;
  const avgDurationMs24h =
    runs24hFinished.length > 0
      ? Math.round(
          runs24hFinished.reduce((sum, r) => sum + (r.duration ?? 0), 0) / runs24hFinished.length
        )
      : null;

  // 7-day trend, bucketed by UTC day
  const trendBuckets = new Map<string, { success: number; failed: number; cancelled: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    trendBuckets.set(key, { success: 0, failed: 0, cancelled: 0 });
  }
  for (const r of runs7d) {
    const key = r.startedAt.toISOString().slice(0, 10);
    const bucket = trendBuckets.get(key);
    if (!bucket) continue;
    if (r.status === 'SUCCESS') bucket.success += 1;
    else if (r.status === 'FAILED') bucket.failed += 1;
    else if (r.status === 'CANCELLED') bucket.cancelled += 1;
  }
  const trend7d = Array.from(trendBuckets.entries()).map(([date, b]) => ({
    date,
    success: b.success,
    failed: b.failed,
    cancelled: b.cancelled,
  }));

  // Top runbooks: hydrate names + success rate + avg duration in one extra query
  const topWorkflowIds = topRunbooksRaw.map(r => r.runbookId);
  const topRunbooks: Array<{
    slug: string | null;
    name: string;
    runs: number;
    successRate: number | null;
    avgDurationMs: number | null;
    /**
     * Last up to 20 executions for this runbook, chronological order
     * (oldest first, newest last) so the UI can render a left-to-right
     * sparkline. Not scoped to since7d like the aggregates above — a
     * runbook that hasn't fired in 10 days still deserves a sparkline.
     */
    recentStatuses: string[];
  }> = [];
  if (topWorkflowIds.length > 0) {
    const [workflows, perWorkflowExecs, recentPerWorkflow] = await Promise.all([
      prisma.runbook.findMany({
        where: { id: { in: topWorkflowIds } },
        select: { id: true, slug: true, name: true },
      }),
      // `topWorkflowIds` came from a tenant-scoped groupBy above, so
      // joining executions by id is already tenant-isolated by
      // construction. The explicit `tenantId` here is for the runtime
      // tenant-scope guard (middleware/tenant-scope-guard.ts) which
      // refuses any Execution query without a tenant filter — without
      // it the guard throws inside Prisma's `$use` chain, the unhandled
      // rejection drains the request, and the connection pool stays
      // poisoned. Same workaround as runbook.routes.ts:230.
      prisma.execution.findMany({
        where: {
          tenantId,
          runbookId: { in: topWorkflowIds },
          startedAt: { gte: since7d },
        },
        select: { runbookId: true, status: true, duration: true },
      }),
      // Per-runbook last-20 fan-out. Prisma doesn't express "top N
      // per group" so we issue one small query per runbook; topN is
      // capped at ~10 upstream so the fan-out is bounded. Same pattern
      // as computeEtas in runs.routes.ts. Each fan-out query also
      // explicitly carries tenantId for the guard.
      Promise.all(
        topWorkflowIds.map(async runbookId => {
          const rows = await prisma.execution.findMany({
            where: { tenantId, runbookId },
            orderBy: { startedAt: 'desc' },
            take: 20,
            select: { status: true },
          });
          // Reverse so oldest is first — sparklines read left→right.
          return { runbookId, statuses: rows.map(r => r.status).reverse() };
        })
      ),
    ]);
    const byId = new Map(workflows.map(w => [w.id, w]));
    const recentById = new Map(recentPerWorkflow.map(r => [r.runbookId, r.statuses]));
    for (const row of topRunbooksRaw) {
      const wf = byId.get(row.runbookId);
      if (!wf) continue;
      const execs = perWorkflowExecs.filter(e => e.runbookId === row.runbookId);
      const success = execs.filter(e => e.status === 'SUCCESS').length;
      const finished = execs.filter(e => e.duration != null);
      topRunbooks.push({
        slug: wf.slug,
        name: wf.name,
        runs: row._count._all,
        successRate: execs.length > 0 ? success / execs.length : null,
        avgDurationMs:
          finished.length > 0
            ? Math.round(finished.reduce((s, e) => s + (e.duration ?? 0), 0) / finished.length)
            : null,
        recentStatuses: recentById.get(row.runbookId) ?? [],
      });
    }
  }

  res.json({
    pulse: {
      runs24h: runs24hCount,
      successRate24h,
      avgDurationMs24h,
      pendingApprovals: pendingApprovalsCount,
    },
    attention: {
      pendingApprovals: pendingApprovalsList.map(a => ({
        id: a.id,
        runbookName: a.runbook.name,
        requestedBy: a.requestedBy,
        createdAt: a.createdAt,
      })),
      stuckRuns: stuckRuns.map(r => ({
        id: r.id,
        runbookName: r.runbook.name,
        startedAt: r.startedAt,
      })),
      recentFailures: recentFailures.map(r => ({
        id: r.id,
        runbookName: r.runbook.name,
        error: r.error,
        completedAt: r.completedAt,
      })),
    },
    liveRuns: liveRuns.map(r => ({
      id: r.id,
      runbookName: r.runbook.name,
      trigger: r.trigger,
      startedAt: r.startedAt,
    })),
    recentRuns: recentRuns.map(r => ({
      id: r.id,
      runbookName: r.runbook.name,
      status: r.status,
      startedAt: r.startedAt,
      duration: r.duration,
    })),
    trend7d,
    topRunbooks,
    changes24h: {
      newRunbooks: newRunbooks24h,
      newApprovals: newApprovals24h,
      newlyFiredMonitors: firedMonitors24h,
      runsDelta: {
        current: runs24hCount,
        prior: priorRuns24h,
        // Signed delta — positive = more runs this window, negative
        // = fewer. Clients render a +/− prefix accordingly.
        change: runs24hCount - priorRuns24h,
      },
    },
    health: {
      // Audit chain verification is intentionally NOT run here — it can
      // be expensive on large logs. The dashboard surfaces "unknown"
      // until the user (or a cron) triggers /api/v1/audit/verify.
      auditChainIntact: null,
      webhooksActive: webhookStats._count._all,
      webhooksLastFiredAt: webhookStats._max.lastTriggeredAt,
    },
  });
});

export default router;
