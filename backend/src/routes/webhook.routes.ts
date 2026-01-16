import { Router } from 'express';
import { prisma } from '../server';
import { ExecutionService } from '../editor/execution/execution.service';

const router = Router();

/**
 * @swagger
 * /webhook/{workflowId}:
 *   post:
 *     summary: Trigger a workflow via webhook
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object }
 *           example:
 *             event: "user.created"
 *             data:
 *               userId: "123"
 *               email: "user@example.com"
 *     responses:
 *       202:
 *         description: Workflow triggered successfully
 *         content:
 *           application/json:
 *             example:
 *               executionId: "exec-webhook-123"
 *               status: "RUNNING"
 *       404:
 *         description: Workflow not found or inactive
 *         content:
 *           application/json:
 *             example:
 *               error: "Workflow not found or not active"
 */
router.post('/:workflowId', async (req, res) => {
    try {
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: req.params.workflowId,
                isActive: true,
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found or not active' });
        }

        const executionService = new ExecutionService(prisma);
        const execution = await executionService.execute({
            workflowId: workflow.id,
            userId: workflow.userId,
            trigger: 'WEBHOOK',
            input: {
                headers: req.headers,
                body: req.body,
                query: req.query,
            },
        });

        res.status(202).json({
            executionId: execution.id,
            status: execution.status,
        });
    } catch (error) {
        req.log.error({ error }, 'Webhook error');
        res.status(500).json({ error: 'Webhook execution failed' });
    }
});

export default router;
