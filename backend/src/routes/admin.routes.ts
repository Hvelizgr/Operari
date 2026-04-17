import { Router, Response } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

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

/**
 * GET /api/admin/overview
 *
 * Read-only snapshot for the Admin page: tenant info + plan, user list,
 * custom roles, and counts of the major resources. Mutations
 * (invite user, change plan, edit role) are intentionally NOT here in
 * v0.1 — the page is a "what do I have" view, not a control surface.
 * The control surface lives in the existing /api/auth, /api/v1/keys, etc.
 */
router.get('/overview', async (req: AuthRequest, res: Response) => {
    const tenantId = req.user!.tenantId;

    const [tenant, users, customRoles, counts] = await Promise.all([
        prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                createdAt: true,
                workosOrganizationId: true,
                stripeCustomerId: true,
            },
        }),
        prisma.user.findMany({
            where: { tenantId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.customRole.findMany({
            where: { tenantId },
            select: {
                id: true,
                name: true,
                description: true,
                permissions: true,
                createdAt: true,
            },
        }),
        Promise.all([
            prisma.runbook.count({ where: { tenantId } }),
            prisma.execution.count({ where: { workflow: { tenantId } } }),
            prisma.apiKey.count({ where: { tenantId } }),
            prisma.webhook.count({ where: { tenantId } }),
            prisma.scheduledJob.count({ where: { workflow: { tenantId } } }),
            prisma.eventAgent.count({ where: { tenantId } }),
            prisma.monitor.count({ where: { tenantId } }),
            prisma.auditEvent.count({ where: { tenantId } }),
        ]),
    ]);

    res.json({
        tenant,
        users,
        customRoles,
        counts: {
            runbooks: counts[0],
            runs: counts[1],
            apiKeys: counts[2],
            webhooks: counts[3],
            schedules: counts[4],
            agents: counts[5],
            monitors: counts[6],
            auditEvents: counts[7],
        },
    });
});

export default router;
