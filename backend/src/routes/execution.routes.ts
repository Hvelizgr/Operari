import { Router } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { ExecutionService } from '../editor/execution/execution.service';
import { QueueService } from '../scaling/queue.service';
import { parsePagination } from '../utils/validation';

const router = Router();

// router.use(authenticate);

// Set default anonymous user for public API access
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
        const { workflowId, status } = req.query;
        const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

        const where = {
            workflow: { tenantId: req.user!.tenantId },
            ...(workflowId && { workflowId: workflowId as string }),
            ...(status && { status: status as any }),
        };

        const countPromise = prisma.execution.count({ where });
        const dataPromise = prisma.execution.findMany({
            where,
            skip,
            take: limit,
            orderBy: { startedAt: 'desc' },
            include: {
                workflow: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true } },
                _count: { select: { nodeLogs: true } },
            },
        });

        const [total, executions] = await Promise.all([countPromise, dataPromise]);

        res.json({
            executions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
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
        let workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        // Special handling for 'current-workflow' scratchpad - create if not exists
        if (!workflow && workflowId === 'current-workflow') {
            workflow = await prisma.workflow.create({
                data: {
                    id: 'current-workflow',
                    name: 'Borrador (Scratchpad)',
                    description: 'Tu espacio de trabajo temporal',
                    nodes: [],
                    connections: [],
                    isActive: false,
                    userId: req.user!.id,
                    tenantId: req.user!.tenantId,
                },
            });
        }

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const queueService = QueueService.getInstance();
        const job = await queueService.enqueueExecution({
            workflowId: workflow.id,
            userId: req.user!.id,
            trigger: 'MANUAL',
            input: req.body.input || {},
        });

        res.status(202).json({ 
            message: 'Execution queued', 
            jobId: job.id,
            id: (job as any).data?.id || (job as any).id,
            status: 'QUEUED',
            workflowId: workflow.id
        });
    } catch (error) {
        req.log.error({ error }, 'Run workflow error');
        res.status(500).json({ error: 'Failed to queue workflow execution' });
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

/**
 * @swagger
 * /executions/{id}/replay:
 *   post:
 *     summary: Replay an execution from a specific node
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nodeId:
 *                 type: string
 *                 description: ID of the node to start replay from
 *     responses:
 *       202:
 *         description: Replay started
 *       404:
 *         description: Execution or node log not found
 */
router.post('/:id/replay', async (req: AuthRequest, res) => {
    try {
        const executionId = req.params.id as string;
        const { nodeId } = req.body;

        const executionService = new ExecutionService(prisma);
        const newExecution = await executionService.replayExecution({
            executionId,
            nodeId,
            userId: req.user!.id,
            tenantId: req.user!.tenantId,
        });

        res.status(202).json(newExecution);
    } catch (error: any) {
        req.log.error({ error }, 'Replay execution error');
        res.status(error.status || 500).json({ error: error.message || 'Failed to replay execution' });
    }
});

/**
 * @swagger
 * /executions/{id}/resume:
 *   post:
 *     summary: Resume a paused execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *                 description: Optional input data to merge for the resumed execution
 *     responses:
 *       200:
 *         description: Execution resumed
 *       404:
 *         description: Paused execution not found
 */
router.post('/:id/resume', async (req: AuthRequest, res) => {
    try {
        const executionId = req.params.id as string;
        const input = req.body.input || {};

        const executionService = new ExecutionService(prisma);
        const execution = await executionService.resumeExecution({
            executionId,
            userId: req.user!.id,
            tenantId: req.user!.tenantId,
            input,
        });

        res.status(200).json(execution);
    } catch (error: any) {
        req.log.error({ error }, 'Resume execution error');
        res.status(error.status || 500).json({ error: error.message || 'Failed to resume execution' });
    }
});

/**
 * @swagger
 * /executions/{workflowId}/debug:
 *   post:
 *     summary: Debug a workflow (similar to run but optimized for testing)
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
 *               startNodeId:
 *                 type: string
 *                 description: Optional node ID to start debugging from
 *     responses:
 *       202:
 *         description: Debug execution started
 *       404:
 *         description: Workflow not found
 */
router.post('/:workflowId/debug', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.workflowId as string;
        const { input, startNodeId } = req.body;

        let workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        // Special handling for 'current-workflow' scratchpad - create if not exists
        if (!workflow && workflowId === 'current-workflow') {
            workflow = await prisma.workflow.create({
                data: {
                    id: 'current-workflow',
                    name: 'Borrador (Scratchpad)',
                    description: 'Tu espacio de trabajo temporal',
                    nodes: [],
                    connections: [],
                    isActive: false,
                    userId: req.user!.id,
                    tenantId: req.user!.tenantId,
                },
            });
        }

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const queueService = QueueService.getInstance();
        const job = await queueService.enqueueExecution({
            workflowId: workflow.id,
            userId: req.user!.id,
            trigger: 'MANUAL', // Debug runs are always MANUAL
            input: input || {},
            startNodeId, // Allow partial execution
        });

        res.status(202).json({ 
            message: 'Debug execution queued', 
            jobId: job.id,
            id: (job as any).data?.id || (job as any).id,
            status: 'QUEUED' 
        });
    } catch (error) {
        req.log.error({ error }, 'Debug workflow error');
        res.status(500).json({ error: 'Failed to queue debug execution' });
    }
});

/**
 * @swagger
 * /executions/{workflowId}/test:
 *   post:
 *     summary: Run workflow in Test Mode (using mocks and running assertions)
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
 *     responses:
 *       202:
 *         description: Test execution started
 *       404:
 *         description: Workflow not found
 */
router.post('/:workflowId/test', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.workflowId as string;
        const { input } = req.body;

        const workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const queueService = QueueService.getInstance();
        const job = await queueService.enqueueExecution({
            workflowId: workflow.id,
            userId: req.user!.id,
            trigger: 'API',
            input: input || {},
            testMode: true, // IMPORTANT: Enable test mode
        });

        res.status(202).json({ 
            message: 'Test execution queued', 
            jobId: job.id,
            id: (job as any).data?.id || (job as any).id,
            status: 'QUEUED',
            testMode: true
        });
    } catch (error) {
        req.log.error({ error }, 'Test workflow error');
        res.status(500).json({ error: 'Failed to queue test execution' });
    }
});

export default router;
