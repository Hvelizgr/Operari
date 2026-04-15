import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../server';
import { requireApiKey, ApiKeyRequest } from '../../middleware/api-key.middleware';
import { ExecutionService } from '../../editor/execution/execution.service';
import { logger } from '../../config/logger.config';

const router = Router();

let _executionService: ExecutionService | null = null;
function getExecutionService() {
    if (!_executionService) _executionService = new ExecutionService(prisma);
    return _executionService;
}

const triggerSchema = z.object({
    variables: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/runbooks
 * List all runbooks for the authenticated tenant.
 */
router.get('/', requireApiKey('runbooks:read'), async (req: ApiKeyRequest, res: Response) => {
    const tenantId = req.apiContext!.tenantId;
    const runbooks = await prisma.runbook.findMany({
        where: { tenantId },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            category: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
    });
    res.json({ data: runbooks });
});

/**
 * POST /api/v1/runbooks/:slug/trigger
 * Trigger a runbook by slug. Returns the run record (async by default).
 *
 * Body: { variables?: Record<string, unknown> }
 *
 * Auth: requires scope "runbooks:trigger"
 */
router.post(
    '/:slug/trigger',
    requireApiKey('runbooks:trigger'),
    async (req: ApiKeyRequest, res: Response) => {
        try {
            const { slug } = req.params;
            const { variables } = triggerSchema.parse(req.body || {});
            const { tenantId } = req.apiContext!;

            // Look up runbook by slug OR id (slug preferred, fallback to UUID)
            let runbook = await prisma.runbook.findFirst({
                where: { tenantId, slug: String(slug) },
            });

            if (!runbook) {
                runbook = await prisma.runbook.findFirst({
                    where: { id: String(slug), tenantId },
                });
            }

            if (!runbook) {
                return res.status(404).json({
                    error: `Runbook not found: ${slug}`,
                    code: 'runbook_not_found',
                });
            }

            // Trigger via the existing ExecutionService — same engine the UI uses
            const execution = await getExecutionService().execute({
                workflowId: runbook.id,
                userId: runbook.userId,
                trigger: 'API',
                input: variables ?? {},
                tenantId,
            });

            res.status(202).json({
                id: execution.id,
                runbook: { id: runbook.id, slug: runbook.slug, name: runbook.name },
                status: execution.status,
                triggeredAt: execution.startedAt,
                url: `${process.env.APP_URL || 'http://localhost:3000'}/en/editor?runId=${execution.id}`,
            });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid body', details: err.errors });
            }
            logger.error({ err }, 'Trigger runbook error');
            res.status(500).json({ error: 'Failed to trigger runbook' });
        }
    },
);

export default router;
