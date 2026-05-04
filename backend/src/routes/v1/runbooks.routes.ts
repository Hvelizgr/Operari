import { Response, Router } from 'express';
import { z } from 'zod';

import { logger } from '../../config/logger.config';
import { ExecutionService } from '../../editor/execution/execution.service';
import { ApiKeyRequest, requireApiKey } from '../../middleware/api-key.middleware';
import { parseInputDefs } from '../../runbook/inputs/parse-input-defs';
import { validateRunInputs } from '../../runbook/inputs/validate-run-inputs';
import { loadTenantComputeDefaults } from '../../runbook/services/tenant-compute-defaults';
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
   *
   * Optional, no default — falls back to the tenant's
   * computeDefaults.dryRun and finally to false. We removed
   * `.default(false)` so an unset field doesn't override the
   * workspace default with `false` at parse time.
   */
  dryRun: z.boolean().optional(),
  /**
   * Idempotency key (trigger.dev parity). Two triggers with the
   * same key on the same runbook within the same tenant return
   * the original Execution row instead of spawning a duplicate.
   * Useful when the upstream is a flaky webhook or an SDK call
   * that retries on network failures. Pair with the SDK's
   * `idempotencyKeys.create(...)` helper to scope keys per-run /
   * per-attempt without colliding across runs.
   */
  idempotencyKey: z.string().min(1).max(256).optional(),
  /**
   * TTL in seconds (trigger.dev parity). When set, the run is
   * abandoned with TTL_EXCEEDED if it does not start within the
   * window — useful for "only do this if the work is still
   * relevant" use cases. The frontend's deriveDisplayStatus
   * helper renders these rows as EXPIRED.
   */
  ttlSeconds: z.number().int().positive().max(86_400).optional(),
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
      const { variables, dryRun, idempotencyKey, ttlSeconds } = triggerSchema.parse(req.body || {});
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

      // Idempotency short-circuit. The (tenantId, runbookId,
      // idempotencyKey) tuple is unique via a partial index, so
      // looking it up before the create is cheap. We return the
      // existing Execution row verbatim — the caller sees the
      // same id + status it would have seen on the original
      // trigger, which lets them poll `runs.retrieve()` without
      // distinguishing "I created this" from "I rediscovered it".
      if (idempotencyKey) {
        const existing = await prisma.execution.findFirst({
          where: { tenantId, runbookId: runbook.id, idempotencyKey },
        });
        if (existing) {
          return res.status(200).json({
            id: existing.id,
            runbook: { id: runbook.id, slug: runbook.slug, name: runbook.name },
            status: existing.status,
            triggeredAt: existing.startedAt,
            url: `${process.env.APP_URL || 'http://localhost:3000'}/en/editor?runId=${existing.id}`,
            idempotent: true,
          });
        }
      }

      // Resolve workspace defaults for fields the trigger payload
      // didn't supply. Sub-runs and other internal callers go
      // straight to execute() without this layer — only public
      // entry points pick up tenant defaults so an explicit value
      // anywhere in the parent chain wins.
      const tenantDefaults = await loadTenantComputeDefaults(prisma, tenantId);
      const effectiveDryRun = dryRun ?? tenantDefaults.dryRun ?? false;
      const effectiveTtlSeconds = ttlSeconds ?? tenantDefaults.ttlSeconds ?? undefined;

      // Trigger via the existing ExecutionService — same engine the UI uses
      const execution = await getExecutionService().execute({
        runbookId: runbook.id,
        userId: runbook.userId,
        trigger: 'API',
        input: validated.values,
        tenantId,
        dryRun: effectiveDryRun,
        ttlSeconds: effectiveTtlSeconds ?? undefined,
        idempotencyKey,
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
      // CONCURRENCY_LIMIT comes from the engine's per-runbook gate.
      // Map it to 429 with a Retry-After hint so SDK consumers can
      // back off without parsing the error body. The hint is a
      // soft guess (5s) — the real time-to-availability depends on
      // the in-flight runs finishing, which we don't know.
      const isWf = typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
      if (isWf && (err as { code: string }).code === 'ERR_2005') {
        const ctx = (err as { context?: { current?: number; limit?: number } }).context ?? {};
        res.setHeader('Retry-After', '5');
        return res.status(429).json({
          error: (err as { message: string }).message,
          code: 'concurrency_limit',
          current: ctx.current ?? null,
          limit: ctx.limit ?? null,
        });
      }
      logger.error({ err }, 'Trigger runbook error');
      res.status(500).json({ error: 'Failed to trigger runbook' });
    }
  }
);

export default router;
