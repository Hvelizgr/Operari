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
 *       404:
 *         description: Execution not found
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input: { type: object }
 *     responses:
 *       202:
 *         description: Execution started
 *       404:
 *         description: Workflow not found
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
 *       404:
 *         description: Execution not found or not running
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
