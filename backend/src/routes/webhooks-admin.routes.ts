import { Response, Router } from 'express';
import { z } from 'zod';

import { ExecutionService } from '../editor/execution/execution.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { WebhookService } from '../runbook/services/webhook.service';
import { prisma } from '../server';

const router = Router();

let service: WebhookService | null = null;
function getService(): WebhookService {
  if (!service) service = new WebhookService(prisma);
  return service;
}

let _executionService: ExecutionService | null = null;
function getExecutionService(): ExecutionService {
  if (!_executionService) _executionService = new ExecutionService(prisma);
  return _executionService;
}

// Anonymous fallback consistent with the rest of the editor surfaces.
// The runtime webhook receiver lives at /webhook/:token and validates
// HMAC; this admin surface only manages the registration metadata.
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

const createSchema = z.object({
  runbookId: z.string().min(1),
  source: z.enum(['sentry', 'datadog', 'github', 'custom']).default('custom'),
  useSecret: z.boolean().optional().default(true),
});

/**
 * GET /api/webhooks?runbookId=...
 * Lists trigger registrations for the current tenant. The editor's
 * Triggers panel uses this to show what's already wired up to a
 * runbook so users can copy URLs/secrets.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const runbookId = req.query.runbookId as string | undefined;
    const all = await getService().list(tenantId);
    const filtered = runbookId ? all.filter(w => w.runbookId === runbookId) : all;
    res.json({
      data: filtered.map(w => ({
        id: w.id,
        runbookId: w.runbookId,
        runbook: w.runbook,
        source: w.source,
        url: w.url,
        secret: w.secret,
        isActive: w.isActive,
        triggerCount: w.triggerCount,
        lastTriggeredAt: w.lastTriggeredAt,
        createdAt: w.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, 'List webhooks error');
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

/**
 * POST /api/webhooks { runbookId, source, useSecret? }
 * Creates a new trigger registration. Returns the URL and secret —
 * the secret is shown only once at creation time.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { runbookId, source, useSecret } = createSchema.parse(req.body ?? {});

    // Tenant scoping: refuse to attach a webhook to a runbook the
    // current tenant does not own. Without this check the editor
    // could mint webhooks for arbitrary workflows.
    const runbook = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId },
      select: { id: true },
    });
    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found', code: 'runbook_not_found' });
    }

    const webhook = await getService().create(tenantId, runbookId, source, useSecret);
    res.status(201).json({
      id: webhook.id,
      runbookId: webhook.runbookId,
      source: webhook.source,
      url: webhook.url,
      secret: webhook.secret,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', details: err.errors });
    }
    req.log.error({ err }, 'Create webhook error');
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * GET /api/webhooks/:id/receipts
 * Debugger view: recent calls this webhook received (accepted and
 * rejected). Ordered most-recent-first so the UI can render a timeline
 * without re-sorting. Tenant-scoped — a webhook id that belongs to
 * another tenant returns 404.
 *
 * Query params (all optional):
 *   - status: filter by receipt status. Accepts a single status or a
 *     comma-separated list. Useful for debugging: `?status=rejected_signature`
 *     surfaces only HMAC failures in a flood of accepted calls.
 *   - limit: page size (default 50, max 200). Raised ceiling so an
 *     operator debugging a chatty webhook can pull a fuller window in
 *     one request.
 *   - cursor: ISO-8601 receivedAt timestamp. Returns receipts strictly
 *     older than the cursor. Combined with the descending order this
 *     yields backwards paging. The previous page's last receivedAt is
 *     the next cursor. Clients that don't pass cursor get the newest
 *     page; those that ignore nextCursor continue to work with the
 *     single-page behavior we had before.
 */
const receiptsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform(v => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(200).optional()),
  cursor: z.string().datetime().optional(),
});

router.get('/:id/receipts', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const parsed = receiptsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
    }

    const webhook = await prisma.webhook.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const limit = parsed.data.limit ?? 50;
    const statusFilter = parsed.data.status
      ? parsed.data.status
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
      : null;
    const cursor = parsed.data.cursor ? new Date(parsed.data.cursor) : null;

    const receipts = await prisma.webhookReceipt.findMany({
      where: {
        webhookId: id,
        ...(statusFilter && statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
        ...(cursor ? { receivedAt: { lt: cursor } } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    // nextCursor is the oldest receivedAt in the current page — iff
    // we hit the page size. Returning null signals "no more pages".
    const nextCursor =
      receipts.length === limit ? receipts[receipts.length - 1]!.receivedAt.toISOString() : null;

    res.json({ data: receipts, nextCursor });
  } catch (err) {
    req.log.error({ err }, 'List webhook receipts error');
    res.status(500).json({ error: 'Failed to list webhook receipts' });
  }
});

/**
 * POST /api/webhooks/:id/receipts/:receiptId/replay
 * Re-fire the bound runbook with the captured payload. Uses the
 * same variable mapping as the live path so a replay is
 * byte-indistinguishable from the original trigger as far as the
 * runbook is concerned. Writes a fresh "accepted" receipt flagged
 * with a `replay_of` marker so the debugger can show the chain.
 */
router.post('/:id/receipts/:receiptId/replay', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id, receiptId } = req.params as { id: string; receiptId: string };

    const webhook = await prisma.webhook.findFirst({
      where: { id, tenantId },
      include: { runbook: { select: { id: true, userId: true, name: true } } },
    });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const receipt = await prisma.webhookReceipt.findFirst({
      where: { id: receiptId, webhookId: id },
    });
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Reuse WebhookService.mapPayloadToVariables so replayed
    // payloads see the same variable shape as the live call.
    const variables = getService().mapPayloadToVariables(
      webhook.source,
      undefined,
      (receipt.body as Record<string, unknown>) ?? {}
    );

    const execution = await getExecutionService().execute({
      runbookId: webhook.runbookId,
      userId: webhook.runbook.userId,
      trigger: 'WEBHOOK',
      input: variables,
      tenantId: webhook.tenantId,
    });

    // Stamp the replay receipt. Include a `replay_of` marker on
    // the reason field so the UI can render "replay of <id>" in
    // the timeline without needing a separate column.
    await prisma.webhookReceipt.create({
      data: {
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        status: 'accepted',
        statusCode: 202,
        reason: `replay_of:${receipt.id}`,
        headers: receipt.headers ?? {},
        body: receipt.body ?? {},
        sourceIp: null,
        executionId: execution.id,
      },
    });

    res.status(202).json({
      runId: execution.id,
      runbook: { id: webhook.runbook.id, name: webhook.runbook.name },
      replayedFrom: receipt.id,
    });
  } catch (err) {
    req.log.error({ err }, 'Replay webhook receipt error');
    res.status(500).json({ error: 'Failed to replay webhook receipt' });
  }
});

/**
 * POST /api/webhooks/:id/rotate-secret
 *
 * Generates a new HMAC secret for an existing webhook and returns it
 * in the response — once. The URL/token does not change, so existing
 * receivers keep delivering until they fail signature verification,
 * at which point the operator updates the secret in the provider's
 * UI. Tenant-scoped; cross-tenant ids return 404.
 *
 * Use case: the operator pasted the secret into a chat by accident,
 * or routinely rotates secrets every quarter for compliance.
 */
router.post('/:id/rotate-secret', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);
    const result = await getService().rotateSecret(tenantId, id);
    if (!result) return res.status(404).json({ error: 'Webhook not found' });
    return res.json({ id, secret: result.secret });
  } catch (err) {
    req.log.error({ err }, 'Rotate webhook secret error');
    return res.status(500).json({ error: 'Failed to rotate webhook secret' });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Deletes a trigger registration. Tenant-scoped.
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);
    const ok = await getService().delete(tenantId, id);
    if (!ok) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ id });
  } catch (err) {
    req.log.error({ err }, 'Delete webhook error');
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

export default router;
