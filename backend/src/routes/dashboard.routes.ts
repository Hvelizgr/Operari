import { Router, Response } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Anonymous fallback for dev/single-tenant self-host. Same pattern as
// /api/runs and /api/approvals — the in-app pages call this without an
// API key; the v1 surface (when added) will require `dashboard:read`.
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@nanorun.local',
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

  const tenantWorkflowFilter = { workflow: { tenantId } };

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
      where: { workflow: { tenantId }, status: 'PENDING' },
    }),
    prisma.approval.findMany({
      where: { workflow: { tenantId }, status: 'PENDING' },
      include: { workflow: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.execution.findMany({
      where: {
        ...tenantWorkflowFilter,
        status: 'RUNNING',
        startedAt: { lt: stuckThreshold },
      },
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: 'asc' },
      take: 5,
    }),
    prisma.execution.findMany({
      where: {
        ...tenantWorkflowFilter,
        status: 'FAILED',
        completedAt: { gte: since2h },
      },
      include: { workflow: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
    prisma.execution.findMany({
      where: { ...tenantWorkflowFilter, status: 'RUNNING' },
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.execution.findMany({
      where: tenantWorkflowFilter,
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.execution.findMany({
      where: { ...tenantWorkflowFilter, startedAt: { gte: since7d } },
      select: { startedAt: true, status: true },
    }),
    prisma.execution.groupBy({
      by: ['workflowId'],
      where: { ...tenantWorkflowFilter, startedAt: { gte: since7d } },
      _count: { _all: true },
      orderBy: { _count: { workflowId: 'desc' } },
      take: 5,
    }),
    prisma.webhook.aggregate({
      where: { tenantId, isActive: true },
      _count: { _all: true },
      _max: { lastTriggeredAt: true },
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
  const topWorkflowIds = topRunbooksRaw.map(r => r.workflowId);
  const topRunbooks: Array<{
    slug: string | null;
    name: string;
    runs: number;
    successRate: number | null;
    avgDurationMs: number | null;
  }> = [];
  if (topWorkflowIds.length > 0) {
    const [workflows, perWorkflowExecs] = await Promise.all([
      prisma.runbook.findMany({
        where: { id: { in: topWorkflowIds } },
        select: { id: true, slug: true, name: true },
      }),
      prisma.execution.findMany({
        where: {
          workflowId: { in: topWorkflowIds },
          startedAt: { gte: since7d },
        },
        select: { workflowId: true, status: true, duration: true },
      }),
    ]);
    const byId = new Map(workflows.map(w => [w.id, w]));
    for (const row of topRunbooksRaw) {
      const wf = byId.get(row.workflowId);
      if (!wf) continue;
      const execs = perWorkflowExecs.filter(e => e.workflowId === row.workflowId);
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
        runbookName: a.workflow.name,
        requestedBy: a.requestedBy,
        createdAt: a.createdAt,
      })),
      stuckRuns: stuckRuns.map(r => ({
        id: r.id,
        runbookName: r.workflow.name,
        startedAt: r.startedAt,
      })),
      recentFailures: recentFailures.map(r => ({
        id: r.id,
        runbookName: r.workflow.name,
        error: r.error,
        completedAt: r.completedAt,
      })),
    },
    liveRuns: liveRuns.map(r => ({
      id: r.id,
      runbookName: r.workflow.name,
      trigger: r.trigger,
      startedAt: r.startedAt,
    })),
    recentRuns: recentRuns.map(r => ({
      id: r.id,
      runbookName: r.workflow.name,
      status: r.status,
      startedAt: r.startedAt,
      duration: r.duration,
    })),
    trend7d,
    topRunbooks,
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
