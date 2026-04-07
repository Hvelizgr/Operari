import { Router, Response } from 'express';
import { prisma } from '../../server';
import { requireApiKey, ApiKeyRequest } from '../../middleware/api-key.middleware';

const router = Router();

/**
 * GET /api/v1/runs
 *
 * List recent runs for the authenticated tenant. Filter by:
 *   ?status=RUNNING|SUCCESS|FAILED|PAUSED|CANCELLED|all  (default: all)
 *   ?runbook=<workflow id or slug>                       (optional)
 *   ?limit=N&cursor=<runId>                              (default 50, max 200)
 *
 * Used by the Run History page in the frontend. Lighter response than
 * GET /runs/:id — does NOT include nodeLogs (the per-run detail page
 * fetches those separately).
 *
 * Requires scope: `runs:read`.
 */
router.get('/', requireApiKey('runs:read'), async (req: ApiKeyRequest, res: Response) => {
    const { tenantId } = req.apiContext!;

    const statusParam = (req.query.status as string | undefined)?.toUpperCase();
    const allowedStatuses = ['RUNNING', 'SUCCESS', 'FAILED', 'PAUSED', 'CANCELLED'] as const;
    let statusFilter: { in: typeof allowedStatuses[number][] } | undefined;
    if (!statusParam || statusParam === '' || statusParam === 'ALL') {
        statusFilter = undefined;
    } else if ((allowedStatuses as readonly string[]).includes(statusParam)) {
        statusFilter = { in: [statusParam as typeof allowedStatuses[number]] };
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
                ...(runbookParam
                    ? { OR: [{ id: runbookParam }, { slug: runbookParam }] }
                    : {}),
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

    res.json({
        data: page.map((r) => ({
            id: r.id,
            runbook: r.workflow,
            status: r.status,
            trigger: r.trigger,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
            duration: r.duration,
            error: r.error,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
    });
});

/**
 * GET /api/v1/runs/:id
 * Get the current state of a run, including step logs.
 */
router.get('/:id', requireApiKey('runs:read'), async (req: ApiKeyRequest, res: Response) => {
    const { tenantId } = req.apiContext!;
    const runId = String(req.params.id);

    const run = await prisma.execution.findFirst({
        where: {
            id: runId,
            workflow: { tenantId },
        },
        include: {
            nodeLogs: {
                orderBy: { startedAt: 'asc' },
            },
            workflow: {
                select: { id: true, slug: true, name: true },
            },
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
        steps: run.nodeLogs.map((log) => ({
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
