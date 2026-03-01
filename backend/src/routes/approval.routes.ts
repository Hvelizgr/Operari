import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.middleware';
import { approvalService } from '../services/approval.service';
import { ApprovalStatus, ApprovalType, Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /approvals/pending:
 *   get:
 *     summary: List pending approval requests for the tenant
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 */
router.get('/pending', requireRole(Role.ADMIN), async (req: AuthRequest, res) => {
    try {
        const requests = await approvalService.getPendingRequests(req.user!.tenantId);
        res.json(requests);
    } catch (error) {
        req.log.error({ error }, 'Get pending approvals error');
        res.status(500).json({ error: 'Failed to get pending approvals' });
    }
});

/**
 * @swagger
 * /approvals/request:
 *   post:
 *     summary: Create an approval request for a workflow
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 */
router.post('/request', async (req: AuthRequest, res) => {
    try {
        const schema = z.object({
            workflowId: z.string().uuid(),
            requestType: z.nativeEnum(ApprovalType),
            comment: z.string().optional(),
        });

        const { workflowId, requestType, comment } = schema.parse(req.body);

        const request = await approvalService.createRequest({
            workflowId,
            requesterId: req.user!.id,
            tenantId: req.user!.tenantId,
            requestType,
            comment,
        });

        res.status(201).json(request);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Create approval request error');
        res.status(500).json({ error: (error as Error).message || 'Failed to create approval request' });
    }
});

/**
 * @swagger
 * /approvals/{id}/review:
 *   post:
 *     summary: Review (Approve/Reject) an approval request
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/review', requireRole(Role.ADMIN), async (req: AuthRequest, res) => {
    try {
        const schema = z.object({
            status: z.enum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]),
            reviewerComment: z.string().optional(),
        });

        const { status, reviewerComment } = schema.parse(req.body);
        const approvalId = req.params.id as string;

        const result = await approvalService.reviewRequest({
            approvalId,
            reviewerId: req.user!.id,
            tenantId: req.user!.tenantId,
            status,
            reviewerComment,
        });

        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Review approval request error');
        res.status(500).json({ error: (error as Error).message || 'Failed to review approval request' });
    }
});

/**
 * @swagger
 * /approvals/config/{workflowId}:
 *   patch:
 *     summary: Update approval configuration for a workflow
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/config/:workflowId', requireRole(Role.ADMIN), async (req: AuthRequest, res) => {
    try {
        const schema = z.object({
            requiresApproval: z.boolean(),
        });

        const { requiresApproval } = schema.parse(req.body);
        const workflowId = req.params.workflowId as string;

        const workflow = await prisma.workflow.update({
            where: { 
                id: workflowId,
                tenantId: req.user!.tenantId 
            },
            data: { requiresApproval }
        });

        res.json(workflow);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Update approval config error');
        res.status(500).json({ error: 'Failed to update approval configuration' });
    }
});

export default router;
