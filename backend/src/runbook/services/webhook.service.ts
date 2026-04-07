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
     * Validate HMAC SHA-256 signature for incoming webhook request.
     * Different sources use different header names and formats:
     *   - GitHub:   X-Hub-Signature-256: sha256=<hex>
     *   - Stripe:   Stripe-Signature: t=...,v1=<hex>
     *   - Generic:  X-Webhook-Signature: <hex>
     */
    verifySignature(
        secret: string,
        rawBody: string,
        signatureHeader: string | undefined,
        source: string,
    ): boolean {
        if (!signatureHeader) return false;

        const expected = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        let provided = signatureHeader.trim();

        // GitHub format: "sha256=<hex>"
        if (source === 'github' && provided.startsWith('sha256=')) {
            provided = provided.substring(7);
        }

        // Constant-time comparison to prevent timing attacks
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
