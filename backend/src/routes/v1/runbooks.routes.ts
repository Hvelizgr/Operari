import { Response, Router } from 'express';
import { z } from 'zod';

import { logger } from '../../config/logger.config';
import { ExecutionService } from '../../editor/execution/execution.service';
import { ApiKeyRequest, requireApiKey } from '../../middleware/api-key.middleware';
import { parseInputDefs } from '../../runbook/inputs/parse-input-defs';
import { validateRunInputs } from '../../runbook/inputs/validate-run-inputs';
import { prisma } from '../../server';

const router = Router();

let _executionService: ExecutionService | null = null;
function getExecutionService() {
  if (!_executionService) _executionService = new ExecutionService(prisma);
  return _executionService;
}

const triggerSchema = z.object({
  variables: z.record(z.unknown()).optional(),
  /**
   * Dry-run: the runbook engine logs every step's intent without
   * performing any side effect. Opt-in per trigger so clients
   * cannot accidentally trigger a dry run instead of a real one.
   */
  dryRun: z.boolean().optional().default(false),
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
      const { variables, dryRun } = triggerSchema.parse(req.body || {});
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

      // Validate against declared typed inputs. Same behavior as the
      // UI's run endpoint: runbooks without declared inputs pass the
      // payload through untouched so existing SDK consumers that send
      // free-form variables stay compatible.
      const inputDefs = parseInputDefs(runbook.inputs);
      const validated = validateRunInputs(inputDefs, variables);
      if (!validated.ok) {
        return res.status(400).json({
          error: 'Invalid run inputs',
          code: 'invalid_run_inputs',
          issues: validated.issues,
        });
      }

      // Trigger via the existing ExecutionService — same engine the UI uses
      const execution = await getExecutionService().execute({
        runbookId: runbook.id,
        userId: runbook.userId,
        trigger: 'API',
        input: validated.values,
        tenantId,
        dryRun,
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
  }
);

export default router;
