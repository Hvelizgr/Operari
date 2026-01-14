import { Router } from 'express';
import { prisma } from '../server';
import { ExecutionService } from '../services/execution.service';

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
 *     responses:
 *       202:
 *         description: Workflow triggered successfully
 *       404:
 *         description: Workflow not found or inactive
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
