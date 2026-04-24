import { Response, Router } from 'express';

import { anonymousFallback, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

// Anonymous fallback gated by NANORUN_ANONYMOUS_MODE=true.
router.use(anonymousFallback);

/**
 * GET /api/runs
 * Same query params and response shape as GET /api/v1/runs.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;

  const statusParam = (req.query.status as string | undefined)?.toUpperCase();
  const allowedStatuses = ['RUNNING', 'SUCCESS', 'FAILED', 'PAUSED', 'CANCELLED'] as const;
  let statusFilter: { in: (typeof allowedStatuses)[number][] } | undefined;
  if (!statusParam || statusParam === '' || statusParam === 'ALL') {
    statusFilter = undefined;
  } else if ((allowedStatuses as readonly string[]).includes(statusParam)) {
    statusFilter = { in: [statusParam as (typeof allowedStatuses)[number]] };
  } else {
    return res.status(400).json({
      error: `Invalid status: ${statusParam}. Must be one of RUNNING|SUCCESS|FAILED|PAUSED|CANCELLED|all.`,
      code: 'invalid_status',
    });
  }

  const runbookParam = req.query.runbook as string | undefined;
  const limitRaw = parseInt((req.query.limit as string) ?? '50', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  const cursor = req.query.cursor as string | undefined;

  const runs = await prisma.execution.findMany({
    where: {
      workflow: {
        tenantId,
        ...(runbookParam ? { OR: [{ id: runbookParam }, { slug: runbookParam }] } : {}),
      },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      workflow: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;

  // ETA: average duration of the last 20 SUCCESS runs per workflow.
  // Computed in one groupBy so the route stays cheap even when the
  // page contains runs from many different runbooks. Returned only
  // for runs that are still RUNNING — finished runs already have a
  // real duration.
  const workflowIds = Array.from(new Set(page.map(r => r.workflowId)));
  const etaMap = await computeEtas(tenantId, workflowIds);

  res.json({
    data: page.map(r => ({
      id: r.id,
      runbook: r.workflow,
      status: r.status,
      trigger: r.trigger,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      duration: r.duration,
      error: r.error,
      etaMs: r.status === 'RUNNING' ? (etaMap.get(r.workflowId) ?? null) : null,
      dryRun: r.dryRun,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

async function computeEtas(tenantId: string, workflowIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (workflowIds.length === 0) return map;
  // Per-workflow average over the last 20 successful runs. We do
  // one query per workflow because Prisma's groupBy doesn't support
  // a "top N per group" aggregate, and the page size is bounded so
  // the fan-out is at most ~50 small queries — fine for v0.1.
  await Promise.all(
    workflowIds.map(async workflowId => {
      const recent = await prisma.execution.findMany({
        where: {
          workflowId,
          status: 'SUCCESS',
          duration: { not: null },
          workflow: { tenantId },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: { duration: true },
      });
      if (recent.length === 0) return;
      const total = recent.reduce((sum, r) => sum + (r.duration ?? 0), 0);
      map.set(workflowId, Math.round(total / recent.length));
    })
  );
  return map;
}

/**
 * GET /api/runs/:id/events — durable execution event log for one run.
 *
 * Serves the rows the engine wrote to ExecutionEvent (seq-ordered,
 * typed, with JSON payload). Consumers: the run-detail UI (Temporal-
 * style numbered event list, expandable payload), debug replays, and
 * future tooling that diffs two runs event-by-event.
 *
 * Query params:
 *   type=<csv>     — filter by one or more event types (step.failed,
 *                    run.completed, …). Omitted = all types.
 *   afterSeq=<n>   — tail mode: return only events with seq > n,
 *                    so the client can poll incrementally.
 *   limit=<n>      — page size, max 1000, default 200.
 *
 * Route ordering note: this must be declared BEFORE `/:id` so Express
 * doesn't route "/abc/events" into the detail handler as id="abc" and
 * then hit an unknown path.
 */
router.get('/:id/events', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const runId = String(req.params.id);

  // Preserve 404 semantics by verifying the run is in-tenant before
  // touching the event table. Event rows also carry tenantId so the
  // actual read is double-scoped.
  const run = await prisma.execution.findFirst({
    where: { id: runId, workflow: { tenantId } },
    select: { id: true },
  });
  if (!run) {
    return res.status(404).json({ error: 'Run not found', code: 'run_not_found' });
  }

  const typeParam = req.query.type as string | undefined;
  const typeFilter = typeParam
    ? typeParam
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : undefined;

  const limitRaw = parseInt((req.query.limit as string) ?? '200', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 200;

  const afterSeqRaw = req.query.afterSeq as string | undefined;
  let afterSeq: bigint | undefined;
  if (afterSeqRaw !== undefined && afterSeqRaw !== '') {
    try {
      afterSeq = BigInt(afterSeqRaw);
    } catch {
      return res
        .status(400)
        .json({ error: 'afterSeq must be a numeric string', code: 'invalid_after_seq' });
    }
  }

  const events = await prisma.executionEvent.findMany({
    where: {
      executionId: runId,
      tenantId,
      ...(typeFilter && typeFilter.length > 0 ? { type: { in: typeFilter } } : {}),
      ...(afterSeq !== undefined ? { seq: { gt: afterSeq } } : {}),
    },
    orderBy: { seq: 'asc' },
    take: limit,
  });

  res.json({
    data: events.map(e => ({
      // BigInt doesn't round-trip through JSON.stringify, so stringify
      // here. Clients compare as strings or BigInt, not numbers.
      seq: e.seq.toString(),
      type: e.type,
      nodeId: e.nodeId,
      payload: e.payload,
      createdAt: e.createdAt,
    })),
    nextAfterSeq: events.length === limit ? events[events.length - 1].seq.toString() : null,
  });
});

/**
 * GET /api/runs/:id — run detail with step logs.
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const runId = String(req.params.id);

  const run = await prisma.execution.findFirst({
    where: {
      id: runId,
      workflow: { tenantId },
    },
    include: {
      nodeLogs: { orderBy: { startedAt: 'asc' } },
      workflow: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!run) {
    return res.status(404).json({ error: 'Run not found', code: 'run_not_found' });
  }

  res.json({
    id: run.id,
    runbook: run.workflow,
    status: run.status,
    trigger: run.trigger,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    duration: run.duration,
    error: run.error,
    dryRun: run.dryRun,
    steps: run.nodeLogs.map(log => ({
      id: log.id,
      stepId: log.nodeId,
      name: log.nodeName,
      type: log.nodeType,
      status: log.status,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      duration: log.duration,
      output: log.output,
      error: log.error,
    })),
  });
});

export default router;
