import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { WebhookService } from '../runbook/services/webhook.service';
import { ExecutionService } from '../editor/execution/execution.service';

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
      email: 'anonymous@nanorun.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

const createSchema = z.object({
  workflowId: z.string().min(1),
  source: z.enum(['sentry', 'datadog', 'github', 'custom']).default('custom'),
  useSecret: z.boolean().optional().default(true),
});

/**
 * GET /api/webhooks?workflowId=...
 * Lists trigger registrations for the current tenant. The editor's
 * Triggers panel uses this to show what's already wired up to a
 * runbook so users can copy URLs/secrets.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const workflowId = req.query.workflowId as string | undefined;
    const all = await getService().list(tenantId);
    const filtered = workflowId ? all.filter(w => w.workflowId === workflowId) : all;
    res.json({
      data: filtered.map(w => ({
        id: w.id,
        workflowId: w.workflowId,
        workflow: w.workflow,
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
 * POST /api/webhooks { workflowId, source, useSecret? }
 * Creates a new trigger registration. Returns the URL and secret —
 * the secret is shown only once at creation time.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { workflowId, source, useSecret } = createSchema.parse(req.body ?? {});

    // Tenant scoping: refuse to attach a webhook to a workflow the
    // current tenant does not own. Without this check the editor
    // could mint webhooks for arbitrary workflows.
    const workflow = await prisma.runbook.findFirst({
      where: { id: workflowId, tenantId },
      select: { id: true },
    });
    if (!workflow) {
      return res.status(404).json({ error: 'Runbook not found', code: 'runbook_not_found' });
    }

    const webhook = await getService().create(tenantId, workflowId, source, useSecret);
    res.status(201).json({
      id: webhook.id,
      workflowId: webhook.workflowId,
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
 * Debugger view: the last 50 calls this webhook received (accepted
 * and rejected). Ordered most-recent-first so the UI can render a
 * timeline without re-sorting. Tenant-scoped — a webhook id that
 * belongs to another tenant returns 404.
 */
router.get('/:id/receipts', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const webhook = await prisma.webhook.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const receipts = await prisma.webhookReceipt.findMany({
      where: { webhookId: id },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });

    res.json({ data: receipts });
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
      include: { workflow: { select: { id: true, userId: true, name: true } } },
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
      workflowId: webhook.workflowId,
      userId: webhook.workflow.userId,
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
      runbook: { id: webhook.workflow.id, name: webhook.workflow.name },
      replayedFrom: receipt.id,
    });
  } catch (err) {
    req.log.error({ err }, 'Replay webhook receipt error');
    res.status(500).json({ error: 'Failed to replay webhook receipt' });
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
