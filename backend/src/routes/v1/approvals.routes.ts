import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../server';
import { requireApiKey, ApiKeyRequest } from '../../middleware/api-key.middleware';
import {
    ApprovalService,
    ApprovalServiceError,
    ResolveAction,
} from '../../runbook/services/approval.service';
import { ExecutionService } from '../../editor/execution/execution.service';

const router = Router();

let approvalService: ApprovalService | null = null;
function getService(): ApprovalService {
    if (!approvalService) {
        const executionService = new ExecutionService(prisma);
        approvalService = new ApprovalService(prisma, {
            // Bind so `this` inside resumeExecution stays correct
            resumeExecution: executionService.resumeExecution.bind(executionService),
        });
    }
    return approvalService;
}

const bodySchema = z.object({
    comment: z.string().max(2000).optional(),
});

const handle = (action: ResolveAction) =>
    async (req: ApiKeyRequest, res: Response) => {
        const { tenantId, keyId } = req.apiContext!;
        const approvalId = String(req.params.id);

        const parsed = bodySchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                code: 'invalid_body',
                details: parsed.error.flatten(),
            });
        }

        try {
            const result = await getService().resolve({
                approvalId,
                tenantId,
                action,
                actorId: `apikey:${keyId}`,
                comment: parsed.data.comment,
            });

            return res.json({
                id: result.id,
                status: result.status,
                workflowId: result.workflowId,
                executionId: result.executionId,
                stepId: result.stepId,
                approvedBy: result.approvedBy,
                approvedAt: result.approvedAt,
                comment: result.comment,
                executionResumed: result.executionResumed,
                executionCancelled: result.executionCancelled,
            });
        } catch (err) {
            if (err instanceof ApprovalServiceError) {
                const status =
                    err.code === 'approval_not_found' ? 404 :
                        err.code === 'approval_not_pending' ? 409 :
                            500;
                return res.status(status).json({ error: err.message, code: err.code });
            }
            throw err;
        }
    };

/**
 * POST /api/v1/approvals/:id/grant
 *
 * Grants a pending approval and resumes the paused execution.
 *
 * Requires scope: `approvals:resolve`.
 * Audit: emits `approval.granted`. Resume in turn emits `run.resumed`.
 */
router.post('/:id/grant', requireApiKey('approvals:resolve'), handle('grant'));

/**
 * POST /api/v1/approvals/:id/reject
 *
 * Rejects a pending approval and CANCELS the execution.
 *
 * Requires scope: `approvals:resolve`.
 * Audit: emits `approval.rejected`. The execution status moves to
 * CANCELLED with an explanatory `error` field.
 */
router.post('/:id/reject', requireApiKey('approvals:resolve'), handle('reject'));

export default router;
