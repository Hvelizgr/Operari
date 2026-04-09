import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { ExecutionService } from '../editor/execution/execution.service';
import { WebhookService } from '../runbook/services/webhook.service';
import { EventAgentService } from '../agent/services/event-agent.service';
import { logger } from '../config/logger.config';

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

let _eventAgentService: EventAgentService | null = null;
function getEventAgentService() {
    if (!_eventAgentService) _eventAgentService = new EventAgentService(prisma);
    return _eventAgentService;
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

    // HMAC validation if a secret is configured.
    //
    // CRITICAL: pass the EXACT bytes the sender signed via req.rawBody.
    // Re-serializing req.body via JSON.stringify() does not preserve
    // those bytes (key ordering, whitespace, number precision, escape
    // sequences can all differ) and HMAC verification will fail
    // randomly. The raw body is captured by the express.json verify
    // hook in server.ts.
    if (webhook.secret) {
        const sigHeader =
            (req.headers['x-hub-signature-256'] as string) ??
            (req.headers['x-webhook-signature'] as string);
        const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

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

    // Fan out to EventAgents bound to this webhook. Additive: the
    // webhook's own bound runbook always fires (legacy single-mapping
    // semantics); agents add a parallel "this payload also matches X,
    // trigger Y" branch. Non-blocking — the webhook responds to the
    // sender as soon as the primary trigger lands.
    const execService = getExecutionService();
    const tenantId = webhook.tenantId;
    const userId = webhook.workflow.userId;
    getEventAgentService()
        .processWebhookEvent(webhook.id, req.body || {}, async (workflowId, vars) => {
            const run = await execService.execute({
                workflowId,
                userId,
                trigger: 'WEBHOOK',
                input: vars,
                tenantId,
            });
            return { id: run.id };
        })
        .catch((err) => {
            // Never let a misbehaving agent take down the webhook receiver.
            // The error is already logged inside the service; the parent
            // request has already been answered by the time this resolves.
            logger.error({ err, webhookId: webhook.id }, 'EventAgent fan-out failed');
        });

    res.status(202).json({
        runId: execution.id,
        runbook: { id: webhook.workflow.id, name: webhook.workflow.name },
        triggered: true,
    });
}

router.post('/:token', handleWebhook);
router.post('/:token/:event', handleWebhook);

export default router;
