import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { cachePresets } from '../middleware/cache.middleware';
import { ReportingService } from '../services/reporting.service';
import { parseDays } from '../utils/validation';

const router = Router();
const reportingService = new ReportingService();

router.get('/', (_req: Request, res: Response) => {
    res.json({
        summary: {
            totalWorkflows: 12,
            activeWorkflows: 8,
            totalExecutions: 1247,
            successfulExecutions: 1198,
            failedExecutions: 49,
            successRate: 96,
        },
        recentExecutions: [
            { id: 'exec-1', status: 'SUCCESS', startedAt: new Date().toISOString(), duration: 234, workflow: { id: 'wf-1', name: 'Order Processing' } },
            { id: 'exec-2', status: 'SUCCESS', startedAt: new Date(Date.now() - 3600000).toISOString(), duration: 156, workflow: { id: 'wf-2', name: 'Email Notifications' } },
            { id: 'exec-3', status: 'FAILED', startedAt: new Date(Date.now() - 7200000).toISOString(), duration: 89, workflow: { id: 'wf-3', name: 'Data Sync' } },
        ],
        executionsByDay: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            count: Math.floor(Math.random() * 100) + 50,
            status: 'SUCCESS'
        })).reverse(),
        topWorkflows: [
            { workflowId: 'wf-1', _count: 423, _avg: { duration: 234 } },
            { workflowId: 'wf-2', _count: 312, _avg: { duration: 156 } },
            { workflowId: 'wf-3', _count: 198, _avg: { duration: 89 } },
        ],
        nodeMetrics: []
    });
});

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
 *         content:
 *           application/json:
 *             example:
 *               summary:
 *                 totalWorkflows: 15
 *                 activeWorkflows: 8
 *                 totalExecutions: 1250
 *                 successfulExecutions: 1200
 *                 failedExecutions: 50
 *                 successRate: 96
 *               recentExecutions:
 *                 - id: "exec-1"
 *                   status: "SUCCESS"
 *                   startedAt: "2024-03-22T10:00:00Z"
 *               executionsByDay:
 *                 - date: "2024-03-22"
 *                   count: 150
 *                   status: "SUCCESS"
 *               topWorkflows:
 *                 - workflowId: "wf-1"
 *                   _count: 500
 *                   _avg: { duration: 120 }
 */
router.get('/dashboard', cachePresets.short, async (req: AuthRequest, res) => {
    try {
        const daysParam = parseDays(req.query.days as string | undefined, 30);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysParam);

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
 *         content:
 *           application/json:
 *             example:
 *               workflow:
 *                 id: "wf-123"
 *                 name: "Order Processing"
 *               stats:
 *                 totalExecutions: 500
 *                 successCount: 480
 *                 failedCount: 20
 *                 successRate: 96
 *                 avgDuration: 250
 *               executionHistory:
 *                 - id: "exec-1"
 *                   status: "SUCCESS"
 *                   duration: 245
 *       404:
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Workflow not found"
 */
router.get('/workflows/:id/stats', cachePresets.short, async (req: AuthRequest, res) => {
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
 *         content:
 *           application/json:
 *             example:
 *               plan: "PRO"
 *               usage:
 *                 workflows: 8
 *                 users: 3
 *                 executions: 1250
 *               limits:
 *                 workflows: 50
 *                 executions: 5000
 *                 users: 10
 */
router.get('/usage', cachePresets.medium, async (req: AuthRequest, res) => {
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
            GROWTH: { workflows: 100, executions: 100000, users: 25 },
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

/**
 * Get advanced reports
 */
router.get('/advanced/stats', cachePresets.short, async (req: AuthRequest, res) => {
  try {
    const { days } = req.query;
    const stats = await reportingService.getExecutionStats(
      req.user!.tenantId,
      days ? parseInt(days as string) : 7
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/advanced/sla-summary', cachePresets.short, async (req: AuthRequest, res) => {
  try {
    const { days } = req.query;
    const summary = await reportingService.getSLASummary(
      req.user!.tenantId,
      days ? parseInt(days as string) : 7
    );
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get SLA summary' });
  }
});

router.get('/advanced/duration-trends', cachePresets.short, async (req: AuthRequest, res) => {
  try {
    const { days } = req.query;
    const trends = await reportingService.getDurationTrends(
      req.user!.tenantId,
      days ? parseInt(days as string) : 7
    );
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get duration trends' });
  }
});

router.get('/advanced/top-workflows', cachePresets.short, async (req: AuthRequest, res) => {
  try {
    const { days, limit } = req.query;
    const top = await reportingService.getTopWorkflows(
      req.user!.tenantId,
      days ? parseInt(days as string) : 7,
      limit ? parseInt(limit as string) : 5
    );
    res.json(top);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get top workflows' });
  }
});

router.get('/advanced/recent-breaches', cachePresets.short, async (req: AuthRequest, res) => {
  try {
    const { limit } = req.query;
    const breaches = await reportingService.getRecentBreaches(
      req.user!.tenantId,
      limit ? parseInt(limit as string) : 10
    );
    res.json(breaches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recent breaches' });
  }
});

export default router;
