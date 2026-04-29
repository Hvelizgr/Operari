import { Response, Router } from 'express';
import { z } from 'zod';

import { ApiKeyRequest, requireApiKey } from '../../middleware/api-key.middleware';
import { WebhookService } from '../../runbook/services/webhook.service';
import { prisma } from '../../server';

const router = Router();

let _service: WebhookService | null = null;
function getService() {
  if (!_service) _service = new WebhookService(prisma);
  return _service;
}

const createSchema = z.object({
  runbookId: z.string().uuid(),
  source: z.enum(['sentry', 'datadog', 'github', 'custom']).default('custom'),
  useSecret: z.boolean().default(true),
});

router.get('/', requireApiKey('webhooks:read'), async (req: ApiKeyRequest, res: Response) => {
  const webhooks = await getService().list(req.apiContext!.tenantId);
  res.json({
    data: webhooks.map(w => ({
      id: w.id,
      source: w.source,
      url: w.url,
      secret: w.secret, // included so the user can copy it once
      isActive: w.isActive,
      triggerCount: w.triggerCount,
      lastTriggeredAt: w.lastTriggeredAt,
      createdAt: w.createdAt,
      runbook: w.runbook,
    })),
  });
});

router.post('/', requireApiKey('webhooks:write'), async (req: ApiKeyRequest, res: Response) => {
  try {
    const { runbookId, source, useSecret } = createSchema.parse(req.body);
    const { tenantId } = req.apiContext!;

    // Verify the runbook exists and belongs to this tenant
    const runbook = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId },
    });
    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    const webhook = await getService().create(tenantId, runbookId, source, useSecret);

    res.status(201).json({
      id: webhook.id,
      source: webhook.source,
      url: webhook.url,
      secret: webhook.secret,
      warning: webhook.secret ? 'Save the secret now — store it securely.' : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

router.delete(
  '/:id',
  requireApiKey('webhooks:write'),
  async (req: ApiKeyRequest, res: Response) => {
    const ok = await getService().delete(req.apiContext!.tenantId, String(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ deleted: true });
  }
);

export default router;
