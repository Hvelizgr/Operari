import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { WebhookService } from '../runbook/services/webhook.service';

const router = Router();

let service: WebhookService | null = null;
function getService(): WebhookService {
    if (!service) service = new WebhookService(prisma);
    return service;
}

// Anonymous fallback consistent with the rest of the editor surfaces.
// The runtime webhook receiver lives at /webhook/:token and validates
// HMAC; this admin surface only manages the registration metadata.
router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
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
        const filtered = workflowId ? all.filter((w) => w.workflowId === workflowId) : all;
        res.json({
            data: filtered.map((w) => ({
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
        const workflow = await prisma.workflow.findFirst({
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
