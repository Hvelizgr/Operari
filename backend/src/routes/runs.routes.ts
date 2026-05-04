import { Response, Router } from 'express';

import { anonymousFallback, AuthRequest } from '../middleware/auth.middleware';
import { sseConcurrencyGuard, sseStreamRateLimiter } from '../middleware/ratelimit.middleware';
import { getEventStream } from '../observability/event-stream.service';
import { prisma } from '../server';

const router = Router();

// Anonymous fallback gated by OPERARI_ANONYMOUS_MODE=true.
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

  // Tag filter — `?tag=env:prod` repeats are AND'ed via Postgres's
  // array `&&` (overlap) operator. A single value covers the
  // common case ("show me everything tagged user:42"); multi-tag
  // is supported for narrowing further.
  const rawTagParam = req.query.tag;
  const tagFilter = Array.isArray(rawTagParam)
    ? rawTagParam.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : typeof rawTagParam === 'string' && rawTagParam.length > 0
      ? [rawTagParam]
      : [];

  const runs = await prisma.execution.findMany({
    where: {
      runbook: {
        tenantId,
        ...(runbookParam ? { OR: [{ id: runbookParam }, { slug: runbookParam }] } : {}),
      },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(tagFilter.length > 0 ? { tags: { hasEvery: tagFilter } } : {}),
    },
    include: {
      runbook: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;

  // ETA: average duration of the last 20 SUCCESS runs per runbook.
  // Computed in one groupBy so the route stays cheap even when the
  // page contains runs from many different runbooks. Returned only
  // for runs that are still RUNNING — finished runs already have a
  // real duration.
  const workflowIds = Array.from(new Set(page.map(r => r.runbookId)));
  const etaMap = await computeEtas(tenantId, workflowIds);

  res.json({
    data: page.map(r => ({
      id: r.id,
      runbook: r.runbook,
      status: r.status,
      trigger: r.trigger,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      duration: r.duration,
      error: r.error,
      etaMs: r.status === 'RUNNING' ? (etaMap.get(r.runbookId) ?? null) : null,
      dryRun: r.dryRun,
      tags: r.tags ?? [],
      expiresAt: r.expiresAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

async function computeEtas(tenantId: string, workflowIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (workflowIds.length === 0) return map;
  // Per-runbook average over the last 20 successful runs. We do
  // one query per runbook because Prisma's groupBy doesn't support
  // a "top N per group" aggregate, and the page size is bounded so
  // the fan-out is at most ~50 small queries — fine for v0.1.
  await Promise.all(
    workflowIds.map(async runbookId => {
      const recent = await prisma.execution.findMany({
        where: {
          runbookId,
          status: 'SUCCESS',
          duration: { not: null },
          runbook: { tenantId },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: { duration: true },
      });
      if (recent.length === 0) return;
      const total = recent.reduce((sum, r) => sum + (r.duration ?? 0), 0);
      map.set(runbookId, Math.round(total / recent.length));
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
/**
 * POST /api/runs/:id/tags  body: { tags: string[] }
 *
 * Append tags to an in-flight or terminated run. Tags merge with
 * existing ones — duplicates collapse via a Set, so calling this
 * twice with overlapping arrays is idempotent. Capped at 16 unique
 * tags per run to keep payload + GIN index entries bounded.
 *
 * Each tag is normalised to a slug (lowercase, max 64 chars). Empty
 * strings, whitespace-only, and overlong tags are dropped silently
 * — operators that paste a CSV with stray spaces don't have to
 * pre-clean.
 *
 * Tenant-scoped: a tag attempt against another tenant's run 404s
 * before reaching the update.
 */
const TAG_LIMIT = 16;
const TAG_MAX_LEN = 64;
const TAG_SHAPE = /^[a-z0-9][a-z0-9_:.\-/]{0,63}$/;

function normaliseTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim().toLowerCase();
    if (!t || t.length > TAG_MAX_LEN) continue;
    if (!TAG_SHAPE.test(t)) continue;
    out.add(t);
  }
  return Array.from(out);
}

router.post('/:id/tags', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const runId = String(req.params.id);
  const incoming = normaliseTags((req.body as { tags?: unknown } | undefined)?.tags);
  if (incoming.length === 0) {
    return res.status(400).json({ error: 'No valid tags supplied', code: 'invalid_tags' });
  }

  const existing = await prisma.execution.findFirst({
    where: { id: runId, tenantId },
    select: { tags: true },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Run not found', code: 'not_found' });
  }

  const merged = Array.from(new Set([...existing.tags, ...incoming])).slice(0, TAG_LIMIT);

  await prisma.execution.update({
    where: { id: runId },
    data: { tags: merged },
  });

  return res.json({ data: { tags: merged } });
});

router.get('/:id/events', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const runId = String(req.params.id);

  // Preserve 404 semantics by verifying the run is in-tenant before
  // touching the event table. Event rows also carry tenantId so the
  // actual read is double-scoped.
  const run = await prisma.execution.findFirst({
    where: { id: runId, runbook: { tenantId } },
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
 * GET /api/runs/:id/events/stream — SSE live tail for execution events.
 *
 * Complements the polling endpoint above with a push channel so the
 * run-detail event log reflects engine transitions in ~10ms instead
 * of waiting the next 2s poll. Mirrors the G.2 /executions/:id/logs
 * SSE protocol exactly so the frontend helper can be symmetric.
 *
 * Protocol
 *   - Response is text/event-stream
 *   - Each entry is written as:
 *        id: <redis-stream-id>
 *        data: {"seq":"…","type":"…","nodeId":null|"…","payload":{…},"createdAt":"…"}
 *        (blank line)
 *   - Client should set Last-Event-ID on reconnect to resume from the
 *     next row after the id it last saw.
 *
 * Backlog-then-tail: we first replay from the provided Last-Event-ID
 * (or fromId query param) via XRANGE, then subscribe from the last id
 * with XREAD BLOCK. A fresh connection without a cursor starts at the
 * live edge ("$" sentinel) so existing history is fetched through the
 * polling /events endpoint — that's the contract the frontend already
 * assumes.
 *
 * Route ordering note: declared before /:id so express does not route
 * "abc/events/stream" into the detail handler.
 */
router.get(
  '/:id/events/stream',
  sseStreamRateLimiter,
  sseConcurrencyGuard,
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const runId = String(req.params.id);

    // Same tenant gate as the polling endpoint — preserve 404 vs 403
    // semantics regardless of how the client is consuming events.
    const run = await prisma.execution.findFirst({
      where: { id: runId, runbook: { tenantId } },
      select: { id: true },
    });
    if (!run) {
      return res.status(404).json({ error: 'Run not found', code: 'run_not_found' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx: don't buffer SSE
    res.flushHeaders?.();

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    // Last-Event-ID header is the SSE-spec way clients signal a resume
    // cursor on reconnect. Fall back to a query param for clients that
    // can't set it (e.g. EventSource in some browsers doesn't expose it
    // before the first event).
    const fromId =
      (req.headers['last-event-id'] as string | undefined) ??
      (req.query.fromId as string | undefined);

    const eventStream = getEventStream();

    try {
      // Replay from the cursor (if any) then tail. When fromId is
      // omitted we start the subscribe at the live edge — the history
      // route already covers backfill.
      if (fromId) {
        const backlog = await eventStream.fetch(runId, { fromId, count: 10_000 });
        for (const entry of backlog) {
          if (controller.signal.aborted) break;
          res.write(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
        }
        const tailCursor = backlog.length > 0 ? backlog[backlog.length - 1].id : fromId;
        for await (const entry of eventStream.subscribe(runId, {
          fromId: tailCursor,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break;
          res.write(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
        }
      } else {
        for await (const entry of eventStream.subscribe(runId, {
          fromId: '$',
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break;
          res.write(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
        }
      }
    } catch (err) {
      req.log.error({ err, runId }, 'SSE events stream failed');
    }
    res.end();
  }
);

/**
 * GET /api/runs/:id — run detail with step logs.
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const runId = String(req.params.id);

  const run = await prisma.execution.findFirst({
    where: {
      id: runId,
      runbook: { tenantId },
    },
    include: {
      nodeLogs: { orderBy: { startedAt: 'asc' } },
      runbook: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!run) {
    return res.status(404).json({ error: 'Run not found', code: 'run_not_found' });
  }

  // Per-step retry counts feed Tier C edge visuals (`data.retries` chip).
  // One ExecutionError row is written per failed attempt with a non-null
  // nodeLogId; counting them gives the number of retries the step
  // burned during this run. Skipping the lookup when there are no
  // failures keeps the happy path free of an extra query.
  const retriesByNodeLogId = new Map<string, number>();
  if (run.nodeLogs.some(l => l.status === 'FAILED' || l.status === 'SUCCESS')) {
    const errors = await prisma.executionError.findMany({
      where: { executionId: run.id, tenantId, nodeLogId: { not: null } },
      select: { nodeLogId: true },
    });
    for (const err of errors) {
      if (!err.nodeLogId) continue;
      retriesByNodeLogId.set(err.nodeLogId, (retriesByNodeLogId.get(err.nodeLogId) ?? 0) + 1);
    }
  }

  res.json({
    id: run.id,
    runbook: run.runbook,
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
      // Surface the per-step input alongside output so the editor's
      // "Replay from here" affordance can show operators what data the
      // node received during the prior run before they confirm. The
      // engine already persists this in NodeLog; we were just hiding
      // it from the API response.
      input: log.input,
      output: log.output,
      error: log.error,
      retries: retriesByNodeLogId.get(log.id) ?? 0,
    })),
  });
});

export default router;
