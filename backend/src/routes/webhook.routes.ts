import { Request, Response, Router } from 'express';

import { EventAgentService } from '../agent/services/event-agent.service';
import { logger } from '../config/logger.config';
import { ExecutionService } from '../editor/execution/execution.service';
import { GitHubStatusService } from '../runbook/services/github-status.service';
import { WebhookService } from '../runbook/services/webhook.service';
import { WebhookReceiptService } from '../runbook/services/webhook-receipt.service';
import { prisma } from '../server';
import { recordWebhookEvent, verifyWebhookTimestamp } from '../utils/webhook-dedup';

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

let _githubStatusService: GitHubStatusService | null = null;
function getGitHubStatusService() {
  if (!_githubStatusService) _githubStatusService = new GitHubStatusService(prisma);
  return _githubStatusService;
}

let _receiptService: WebhookReceiptService | null = null;
function getReceiptService() {
  if (!_receiptService) _receiptService = new WebhookReceiptService(prisma);
  return _receiptService;
}

function sourceIpOf(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
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
  const receipts = getReceiptService();
  const headers = req.headers as Record<string, unknown>;
  const body = req.body ?? {};
  const sourceIp = sourceIpOf(req);

  const webhook = await service.findByToken(String(token));
  if (!webhook || !webhook.isActive) {
    // Inactive/unknown webhook — still debug-worthy if a tenant
    // just deactivated one and wonders why the trigger stopped.
    // We can only record if we actually found it; a truly unknown
    // token has no webhookId FK to anchor the receipt against.
    if (webhook) {
      await receipts.record({
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        status: 'rejected_inactive',
        statusCode: 404,
        reason: 'Webhook inactive',
        headers,
        body,
        sourceIp,
      });
    }
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

    const valid = service.verifySignature(webhook.secret, rawBody, sigHeader, webhook.source);

    if (!valid) {
      await receipts.record({
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        status: 'rejected_signature',
        statusCode: 401,
        reason: 'HMAC signature mismatch',
        headers,
        body,
        sourceIp,
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Replay protection. HMAC alone authenticates the payload but
    // does not prove it is fresh — an attacker who captures a valid
    // delivery off the wire can re-POST it forever. Senders that
    // include a timestamp header opt into a 5-minute window; silent
    // absence stays permissive so GitHub et al. (which don't send
    // one) keep working.
    const timestampHeader =
      (req.headers['x-webhook-timestamp'] as string | undefined) ??
      (req.headers['x-hub-timestamp'] as string | undefined);
    const tsFail = verifyWebhookTimestamp({ header: timestampHeader });
    if (tsFail) {
      await receipts.record({
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        status: 'rejected_signature',
        statusCode: 401,
        reason: `Timestamp replay guard: ${tsFail}`,
        headers,
        body,
        sourceIp,
      });
      return res.status(401).json({ error: 'Invalid webhook timestamp' });
    }
  }

  // Dedup. Providers that expose a delivery-scoped id header let us
  // short-circuit retries: GitHub sends X-GitHub-Delivery (UUID per
  // delivery attempt); generic senders can set X-Webhook-Delivery.
  // When no header is present we skip dedup (the provider doesn't
  // give us a stable id to key on) — HMAC + timestamp remain the
  // replay defense there.
  const deliveryId =
    (req.headers['x-github-delivery'] as string | undefined) ??
    (req.headers['x-webhook-delivery'] as string | undefined);
  if (deliveryId) {
    try {
      const dedup = await recordWebhookEvent(prisma, {
        source: webhook.source,
        eventId: deliveryId,
        tenantId: webhook.tenantId,
      });
      if (dedup.duplicate) {
        await receipts.record({
          webhookId: webhook.id,
          tenantId: webhook.tenantId,
          status: 'rejected_inactive',
          statusCode: 200,
          reason: 'Duplicate delivery short-circuited',
          headers,
          body,
          sourceIp,
        });
        return res.status(200).json({ received: true, duplicate: true });
      }
    } catch (err) {
      // Dedup write failed (DB transient). Log but continue — the
      // alternative is rejecting a live delivery the sender will
      // retry anyway. HMAC + timestamp remain in place.
      logger.warn(
        { err, webhookId: webhook.id, deliveryId },
        'webhook dedup write failed, proceeding without dedup'
      );
    }
  }

  // Map payload → variables
  const variables = service.mapPayloadToVariables(
    webhook.source,
    event ? String(event) : undefined,
    req.body || {}
  );

  // Trigger the bound runbook
  let execution;
  try {
    execution = await getExecutionService().execute({
      workflowId: webhook.workflowId,
      userId: webhook.workflow.userId,
      trigger: 'WEBHOOK',
      input: variables,
      tenantId: webhook.tenantId,
    });
  } catch (err) {
    await receipts.record({
      webhookId: webhook.id,
      tenantId: webhook.tenantId,
      status: 'error',
      statusCode: 500,
      reason: err instanceof Error ? err.message : 'execution failed',
      headers,
      body,
      sourceIp,
    });
    throw err;
  }

  // Record the accepted receipt now that we know the execution id.
  // Fire-and-forget — the receipt write must never delay the 202.
  receipts
    .record({
      webhookId: webhook.id,
      tenantId: webhook.tenantId,
      status: 'accepted',
      statusCode: 202,
      headers,
      body,
      sourceIp,
      executionId: execution.id,
    })
    .catch(() => {
      /* already swallowed inside the service */
    });

  // Update webhook stats async
  service.recordTrigger(webhook.id).catch(() => {
    /* ignore */
  });

  // GitHub: post "pending" commit status and store metadata for the
  // completion hook in execution.service.
  if (webhook.source === 'github' && variables.head_sha && variables.owner && variables.repo) {
    const githubMeta = {
      owner: variables.owner as string,
      repo: variables.repo as string,
      sha: variables.head_sha as string,
      runbookName: webhook.workflow.name,
    };

    // Store on execution so the completion hook can find it.
    prisma.execution
      .update({
        where: { id: execution.id },
        data: { metadata: { github: githubMeta } },
      })
      .catch(() => {
        /* best-effort */
      });

    // Post "pending" status to GitHub.
    getGitHubStatusService()
      .reportRunStart(webhook.tenantId, {
        ...githubMeta,
        runId: execution.id,
      })
      .catch(err => {
        logger.warn({ err, executionId: execution.id }, 'GitHub pending status failed');
      });
  }

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
    .catch(err => {
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
