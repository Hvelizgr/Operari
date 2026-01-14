import { Router } from 'express';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', async (req: AuthRequest, res) => {
    try {
        const { days = '30' } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days as string));

        const [
            totalWorkflows,
            activeWorkflows,
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            recentExecutions,
            executionsByDay,
            topWorkflows,
            nodeMetrics,
        ] = await Promise.all([
            prisma.workflow.count({
                where: { tenantId: req.user!.tenantId },
            }),
            prisma.workflow.count({
                where: { tenantId: req.user!.tenantId, isActive: true },
            }),
            prisma.execution.count({
                where: {
                    workflow: { tenantId: req.user!.tenantId },
                    startedAt: { gte: startDate },
                },
            }),
            prisma.execution.count({
                where: {
                    workflow: { tenantId: req.user!.tenantId },
                    status: 'SUCCESS',
                    startedAt: { gte: startDate },
                },
            }),
            prisma.execution.count({
                where: {
                    workflow: { tenantId: req.user!.tenantId },
                    status: 'FAILED',
                    startedAt: { gte: startDate },
                },
            }),
            prisma.execution.findMany({
                where: {
                    workflow: { tenantId: req.user!.tenantId },
                },
                take: 10,
                orderBy: { startedAt: 'desc' },
                include: {
                    workflow: { select: { id: true, name: true } },
                },
            }),
            prisma.$queryRaw`
        SELECT DATE(started_at) as date, COUNT(*) as count, status
        FROM "Execution" e
        JOIN "Workflow" w ON e.workflow_id = w.id
        WHERE w.tenant_id = ${req.user!.tenantId}
        AND e.started_at >= ${startDate}
        GROUP BY DATE(started_at), status
        ORDER BY date DESC
      `,
            prisma.execution.groupBy({
                by: ['workflowId'],
                where: {
                    workflow: { tenantId: req.user!.tenantId },
                    startedAt: { gte: startDate },
                },
                _count: true,
                _avg: { duration: true },
                orderBy: { _count: { workflowId: 'desc' } },
                take: 5,
            }),
            prisma.nodeLog.groupBy({
                by: ['nodeType', 'status'],
                where: {
                    execution: {
                        workflow: { tenantId: req.user!.tenantId },
                    },
                    startedAt: { gte: startDate },
                },
                _count: true,
                _avg: { duration: true },
            }),
        ]);

        const successRate = totalExecutions > 0
            ? Math.round((successfulExecutions / totalExecutions) * 100)
            : 0;

        res.json({
            summary: {
                totalWorkflows,
                activeWorkflows,
                totalExecutions,
                successfulExecutions,
                failedExecutions,
                successRate,
            },
            recentExecutions,
            executionsByDay,
            topWorkflows,
            nodeMetrics,
        });
    } catch (error) {
        req.log.error({ error }, 'Get dashboard error');
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

/**
 * @swagger
 * /analytics/workflows/{id}/stats:
 *   get:
 *     summary: Get specific workflow statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Workflow statistics
 *       404:
 *         description: Workflow not found
 */
router.get('/workflows/:id/stats', async (req: AuthRequest, res) => {
    try {
        const { days = '30' } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days as string));

        const workflowId = req.params.id as string;
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const [
            totalExecutions,
            successCount,
            failedCount,
            avgDuration,
            executionHistory,
            nodeStats,
        ] = await Promise.all([
            prisma.execution.count({
                where: { workflowId, startedAt: { gte: startDate } },
            }),
            prisma.execution.count({
                where: { workflowId, status: 'SUCCESS', startedAt: { gte: startDate } },
            }),
            prisma.execution.count({
                where: { workflowId, status: 'FAILED', startedAt: { gte: startDate } },
            }),
            prisma.execution.aggregate({
                where: { workflowId, startedAt: { gte: startDate } },
                _avg: { duration: true },
            }),
            prisma.execution.findMany({
                where: { workflowId, startedAt: { gte: startDate } },
                select: {
                    id: true,
                    status: true,
                    duration: true,
                    startedAt: true,
                },
                orderBy: { startedAt: 'desc' },
                take: 100,
            }),
            prisma.nodeLog.groupBy({
                by: ['nodeId', 'nodeName', 'nodeType', 'status'],
                where: {
                    execution: { workflowId },
                    startedAt: { gte: startDate },
                },
                _count: true,
                _avg: { duration: true },
            }),
        ]);

        res.json({
            workflow: {
                id: workflow.id,
                name: workflow.name,
            },
            stats: {
                totalExecutions,
                successCount,
                failedCount,
                successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0,
                avgDuration: avgDuration._avg?.duration ?? 0,
            },
            executionHistory,
            nodeStats,
        });
    } catch (error) {
        req.log.error({ error }, 'Get workflow stats error');
        res.status(500).json({ error: 'Failed to get workflow stats' });
    }
});

/**
 * @swagger
 * /analytics/usage:
 *   get:
 *     summary: Get tenant usage statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Usage statistics
 */
router.get('/usage', async (req: AuthRequest, res) => {
    try {
        const { days = '30' } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days as string));

        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user!.tenantId },
            include: {
                _count: {
                    select: {
                        users: true,
                        workflows: true,
                    },
                },
            },
        });

        const executions = await prisma.execution.count({
            where: {
                workflow: { tenantId: req.user!.tenantId },
                startedAt: { gte: startDate },
            },
        });

        const limits = {
            FREE: { workflows: 5, executions: 100, users: 1 },
            PRO: { workflows: 50, executions: 5000, users: 10 },
            ENTERPRISE: { workflows: -1, executions: -1, users: -1 },
        };

        const currentLimits = limits[tenant!.plan];

        res.json({
            plan: tenant!.plan,
            usage: {
                workflows: tenant!._count.workflows,
                users: tenant!._count.users,
                executions,
            },
            limits: currentLimits,
        });
    } catch (error) {
        req.log.error({ error }, 'Get usage error');
        res.status(500).json({ error: 'Failed to get usage data' });
    }
});

export default router;
