import { Router, Response } from 'express';
import { prisma } from '../../server';
import { requireApiKey, ApiKeyRequest } from '../../middleware/api-key.middleware';

const router = Router();

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
