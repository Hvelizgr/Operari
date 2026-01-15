import { Router } from 'express';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { ExecutionService } from '../services/execution.service';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /executions:
 *   get:
 *     summary: List executions
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: workflowId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [RUNNING, COMPLETED, FAILED, CANCELLED] }
 *     responses:
 *       200:
 *         description: List of executions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 executions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       status: { type: string }
 *                       startedAt: { type: string }
 *                       duration: { type: number }
 *                 pagination:
 *                   type: object
 *             example:
 *               executions:
 *                 - id: "exec-1"
 *                   workflowId: "wf-1"
 *                   status: "COMPLETED"
 *                   startedAt: "2024-03-20T10:00:00Z"
 *                   duration: 1500
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 50
 *                 pages: 3
 */
router.get('/', async (req: AuthRequest, res) => {
    try {
        const { page = '1', limit = '20', workflowId, status } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where = {
            workflow: { tenantId: req.user!.tenantId },
            ...(workflowId && { workflowId: workflowId as string }),
            ...(status && { status: status as any }),
        };

        const [executions, total] = await Promise.all([
            prisma.execution.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                orderBy: { startedAt: 'desc' },
                include: {
                    workflow: { select: { id: true, name: true } },
                    user: { select: { id: true, name: true, email: true } },
                    _count: { select: { nodeLogs: true } },
                },
            }),
            prisma.execution.count({ where }),
        ]);

        res.json({
            executions,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        req.log.error({ error }, 'Get executions error');
        res.status(500).json({ error: 'Failed to get executions' });
    }
});

/**
 * @swagger
 * /executions/{id}:
 *   get:
 *     summary: Get execution details
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Execution details
 *         content:
 *           application/json:
 *             example:
 *               id: "exec-1"
 *               workflowId: "wf-1"
 *               status: "FAILED"
 *               error: "HTTP 500"
 *               startedAt: "2024-03-20T10:00:00Z"
 *               completedAt: "2024-03-20T10:00:02Z"
 *               nodeLogs:
 *                 - nodeId: "node-1"
 *                   status: "SUCCESS"
 *                   duration: 200
 *                 - nodeId: "node-2"
 *                   status: "ERROR"
 *                   duration: 50
 *                   error: "Connection timeout"
 *       404:
 *         description: Execution not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Execution not found"
 */
router.get('/:id', async (req: AuthRequest, res) => {
    try {
        const executionId = req.params.id as string;
        const execution = await prisma.execution.findFirst({
            where: {
                id: executionId,
                workflow: { tenantId: req.user!.tenantId },
            },
            include: {
                workflow: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true } },
                nodeLogs: { orderBy: { startedAt: 'asc' } },
            },
        });

        if (!execution) {
            return res.status(404).json({ error: 'Execution not found' });
        }

        res.json(execution);
    } catch (error) {
        req.log.error({ error }, 'Get execution error');
        res.status(500).json({ error: 'Failed to get execution' });
    }
});

/**
 * @swagger
 * /executions/{workflowId}/run:
 *   post:
 *     summary: Trigger manual execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: object
 *                 description: Initial input data for the workflow
 *           example:
 *             input:
 *               email: "user@example.com"
 *               sku: "PROD-123"
 *     responses:
 *       202:
 *         description: Execution started
 *         content:
 *           application/json:
 *             example:
 *               id: "exec-new-123"
 *               status: "RUNNING"
 *               trigger: "MANUAL"
 *       404:
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Workflow not found"
 */
router.post('/:workflowId/run', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.workflowId as string;
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const executionService = new ExecutionService(prisma);
        const execution = await executionService.execute({
            workflowId: workflow.id,
            userId: req.user!.id,
            trigger: 'MANUAL',
            input: req.body.input || {},
        });

        res.status(202).json(execution);
    } catch (error) {
        req.log.error({ error }, 'Run workflow error');
        res.status(500).json({ error: 'Failed to run workflow' });
    }
});

/**
 * @swagger
 * /executions/{id}/cancel:
 *   post:
 *     summary: Cancel a running execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Execution cancelled
 *         content:
 *           application/json:
 *             example:
 *               message: "Execution cancelled"
 *       404:
 *         description: Execution not found or not running
 *         content:
 *           application/json:
 *             example:
 *               error: "Running execution not found"
 */
router.post('/:id/cancel', async (req: AuthRequest, res) => {
    try {
        const executionId = req.params.id as string;
        const execution = await prisma.execution.findFirst({
            where: {
                id: executionId,
                workflow: { tenantId: req.user!.tenantId },
                status: 'RUNNING',
            },
        });

        if (!execution) {
            return res.status(404).json({ error: 'Running execution not found' });
        }

        await prisma.execution.update({
            where: { id: executionId },
            data: {
                status: 'CANCELLED',
                completedAt: new Date(),
            },
        });

        res.json({ message: 'Execution cancelled' });
    } catch (error) {
        req.log.error({ error }, 'Cancel execution error');
        res.status(500).json({ error: 'Failed to cancel execution' });
    }
});

export default router;
