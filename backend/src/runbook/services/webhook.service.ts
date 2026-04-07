import { PrismaClient, Webhook } from '@prisma/client';
import crypto from 'crypto';

export interface CreatedWebhook extends Webhook {
    /** Full webhook URL — include in instructions to the user */
    url: string;
}

/**
 * Manages inbound webhooks. Each webhook is bound to a runbook + tenant
 * and has a unique URL token. External services (Sentry, Datadog, GitHub,
 * custom apps) POST to that URL to trigger the runbook.
 *
 * Optionally each webhook has a shared secret used for HMAC SHA-256
 * signature validation (recommended for production).
 */
export class WebhookService {
    constructor(private prisma: PrismaClient) { }

    async create(
        tenantId: string,
        workflowId: string,
        source: string,
        useSecret = true,
    ): Promise<CreatedWebhook> {
        const token = crypto.randomBytes(24).toString('base64url');
        const secret = useSecret ? crypto.randomBytes(32).toString('base64url') : null;

        const webhook = await this.prisma.webhook.create({
            data: {
                tenantId,
                workflowId,
                source,
                token,
                secret,
                isActive: true,
            },
        });

        const baseUrl = process.env.APP_URL || 'http://localhost:4000';
        return {
            ...webhook,
            url: `${baseUrl}/api/webhooks/${token}`,
        };
    }

    async findByToken(token: string) {
        return this.prisma.webhook.findUnique({
            where: { token },
            include: { workflow: true },
        });
    }

    async list(tenantId: string) {
        const baseUrl = process.env.APP_URL || 'http://localhost:4000';
        const webhooks = await this.prisma.webhook.findMany({
            where: { tenantId },
            include: { workflow: { select: { id: true, name: true, slug: true } } },
            orderBy: { createdAt: 'desc' },
        });
        return webhooks.map((w) => ({ ...w, url: `${baseUrl}/api/webhooks/${w.token}` }));
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        const result = await this.prisma.webhook.deleteMany({
            where: { id, tenantId },
        });
        return result.count > 0;
    }

    async recordTrigger(id: string) {
        return this.prisma.webhook.update({
            where: { id },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 },
            },
        });
    }

    /**
     * Validate HMAC SHA-256 signature for an incoming webhook request.
     *
     * **CRITICAL**: `rawBody` MUST be the exact bytes the sender signed.
     * `JSON.stringify(req.body)` is the wrong input — Express parses
     * the JSON before the route runs, and re-serializing produces
     * bytes that may differ from the original (key ordering, whitespace,
     * number precision, escaped characters). The canonical webhook
     * security bug. Capture the raw body via
     * `express.json({ verify: (req, _res, buf) => req.rawBody = buf })`
     * and pass `req.rawBody` here.
     *
     * Source-specific header formats:
     *   - GitHub:   X-Hub-Signature-256: sha256=<hex>
     *   - Generic:  X-Webhook-Signature: <hex>
     *
     * Stripe's `Stripe-Signature: t=...,v1=<hex>` is NOT handled here
     * because Stripe also requires a timestamp tolerance check against
     * replay attacks; that lives in a dedicated StripeSignatureVerifier
     * (deferred — when the billing integration ships).
     *
     * Returns false on missing header, missing source/secret, hex
     * decode failure, or signature mismatch. The boolean result is the
     * only signal — the caller logs and rejects the request.
     */
    verifySignature(
        secret: string,
        rawBody: Buffer | string | undefined,
        signatureHeader: string | undefined,
        source: string,
    ): boolean {
        if (!signatureHeader) return false;
        if (rawBody === undefined || rawBody === null) return false;

        const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

        const expected = crypto
            .createHmac('sha256', secret)
            .update(bodyBuffer)
            .digest('hex');

        let provided = signatureHeader.trim();

        // GitHub format: "sha256=<hex>". Strip the prefix before
        // comparing. The check is intentionally case-insensitive on
        // the prefix because GitHub's docs show lowercase but some
        // legacy senders capitalize it.
        if (provided.toLowerCase().startsWith('sha256=')) {
            provided = provided.substring(7);
        }

        // Both buffers must be the same length for timingSafeEqual to
        // run; otherwise it throws (which leaks length info via the
        // exception path). Pre-check the hex length and return false
        // on mismatch.
        if (expected.length !== provided.length) return false;

        try {
            return crypto.timingSafeEqual(
                Buffer.from(expected, 'hex'),
                Buffer.from(provided, 'hex'),
            );
        } catch {
            return false;
        }
    }

    /**
     * Map an incoming webhook payload to runbook variables.
     * Different sources have different shapes — we normalize them.
     */
    mapPayloadToVariables(
        source: string,
        event: string | undefined,
        payload: Record<string, unknown>,
    ): Record<string, unknown> {
        switch (source) {
            case 'sentry':
                return {
                    source: 'sentry',
                    event: event ?? 'issue.alert',
                    error_message: payload.message ?? (payload.event as Record<string, unknown>)?.title,
                    error_level: payload.level ?? 'error',
                    project: payload.project,
                    project_slug: payload.project_slug,
                    issue_url: payload.url,
                    raw: payload,
                };

            case 'github':
                return {
                    source: 'github',
                    event: event ?? 'unknown',
                    repository: (payload.repository as Record<string, unknown>)?.full_name,
                    ref: payload.ref,
                    pusher: (payload.pusher as Record<string, unknown>)?.name,
                    commit: (payload.head_commit as Record<string, unknown>)?.id,
                    raw: payload,
                };

            case 'datadog':
                return {
                    source: 'datadog',
                    event: event ?? 'alert',
                    alert_title: payload.alert_title ?? payload.title,
                    alert_status: payload.alert_status,
                    priority: payload.priority,
                    message: payload.body ?? payload.text,
                    raw: payload,
                };

            default:
                return {
                    source,
                    event,
                    payload,
                };
        }
    }
}
