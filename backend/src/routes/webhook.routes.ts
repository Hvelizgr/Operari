import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { ExecutionService } from '../editor/execution/execution.service';
import { WebhookService } from '../runbook/services/webhook.service';

const router = Router();

let _executionService: ExecutionService | null = null;
function getExecutionService() {
    if (!_executionService) _executionService = new ExecutionService(prisma);
    return _executionService;
}

let _webhookService: WebhookService | null = null;
function getWebhookService() {
    if (!_webhookService) _webhookService = new WebhookService(prisma);
    return _webhookService;
}

/**
 * NanoRun-style webhook receiver.
 *
 * URL pattern:
 *   POST /webhook/:token            (no event)
 *   POST /webhook/:token/:event     (with event subroute)
 *
 * The token is generated when the webhook is created and is unique
 * across all tenants. Optionally, the request must include an HMAC
 * signature header (configured per webhook):
 *   - GitHub:  X-Hub-Signature-256: sha256=<hex>
 *   - Generic: X-Webhook-Signature: <hex>
 *
 * The payload is normalized into runbook variables and the bound
 * runbook is triggered immediately.
 */
async function handleWebhook(req: Request, res: Response) {
    const { token, event } = req.params;
    const service = getWebhookService();

    const webhook = await service.findByToken(String(token));
    if (!webhook || !webhook.isActive) {
        return res.status(404).json({ error: 'Webhook not found' });
    }

    // HMAC validation if a secret is configured
    if (webhook.secret) {
        const sigHeader =
            (req.headers['x-hub-signature-256'] as string) ??
            (req.headers['x-webhook-signature'] as string);
        const rawBody = JSON.stringify(req.body);

        const valid = service.verifySignature(
            webhook.secret,
            rawBody,
            sigHeader,
            webhook.source,
        );

        if (!valid) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
    }

    // Map payload → variables
    const variables = service.mapPayloadToVariables(
        webhook.source,
        event ? String(event) : undefined,
        req.body || {},
    );

    // Trigger the bound runbook
    const execution = await getExecutionService().execute({
        workflowId: webhook.workflowId,
        userId: webhook.workflow.userId,
        trigger: 'WEBHOOK',
        input: variables,
        tenantId: webhook.tenantId,
    });

    // Update webhook stats async
    service.recordTrigger(webhook.id).catch(() => { /* ignore */ });

    res.status(202).json({
        runId: execution.id,
        runbook: { id: webhook.workflow.id, name: webhook.workflow.name },
        triggered: true,
    });
}

router.post('/:token', handleWebhook);
router.post('/:token/:event', handleWebhook);

export default router;
