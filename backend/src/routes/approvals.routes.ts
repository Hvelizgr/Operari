import { Router } from 'express';
import { z } from 'zod';

import { ExecutionService } from '../editor/execution/execution.service';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  ApprovalService,
  ApprovalServiceError,
  ResolveAction,
} from '../runbook/services/approval.service';
import { prisma } from '../server';

const router = Router();

let approvalService: ApprovalService | null = null;
function getService(): ApprovalService {
  if (!approvalService) {
    const executionService = new ExecutionService(prisma);
    approvalService = new ApprovalService(prisma, {
      resumeExecution: executionService.resumeExecution.bind(executionService),
    });
  }
  return approvalService;
}

// Anonymous fallback for dev/single-tenant self-host, mirrors
// workflow.routes.ts. Real JWT verification is enforced on the
// /api/v1/* surfaces — this route exists so the in-app Approval
// Inbox UI can talk to the same backend without an API key.
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

/**
 * GET /api/approvals
 *
 * List approvals for the authenticated user's tenant. JWT-auth mirror
 * of GET /api/v1/approvals — same query params, same response shape.
 * The Approval Inbox UI in the frontend uses this endpoint instead of
 * the v1 one because the frontend is logged in via JWT, not API key.
 *
 *   ?status=PENDING|APPROVED|REJECTED|EXPIRED|all  (default: PENDING)
 *   ?limit=N (default 50, max 200)
 *   ?cursor=<approvalId>
 */
router.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  const statusParam = (req.query.status as string | undefined)?.toUpperCase();
  const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
  type StatusValue = (typeof allowedStatuses)[number];
  let statusFilter: { in: StatusValue[] } | undefined;
  if (!statusParam || statusParam === '') {
    statusFilter = { in: ['PENDING'] };
  } else if (statusParam === 'ALL') {
    statusFilter = undefined;
  } else if ((allowedStatuses as readonly string[]).includes(statusParam)) {
    statusFilter = { in: [statusParam as StatusValue] };
  } else {
    return res.status(400).json({
      error: `Invalid status: ${statusParam}. Must be PENDING|APPROVED|REJECTED|EXPIRED|all.`,
      code: 'invalid_status',
    });
  }

  const limitRaw = parseInt((req.query.limit as string) ?? '50', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  const cursor = req.query.cursor as string | undefined;

  const approvals = await prisma.approval.findMany({
    where: {
      workflow: { tenantId },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      workflow: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = approvals.length > limit;
  const page = hasMore ? approvals.slice(0, limit) : approvals;

  res.json({
    data: page.map(a => ({
      id: a.id,
      status: a.status,
      message: a.message,
      workflow: a.workflow,
      executionId: a.executionId,
      stepId: a.stepId,
      requestedBy: a.requestedBy,
      createdAt: a.createdAt,
      approvedBy: a.approvedBy,
      approvedAt: a.approvedAt,
      comment: a.comment,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

const resolveBodySchema = z.object({
  comment: z.string().max(2000).optional(),
});

const handle =
  (action: ResolveAction) => async (req: AuthRequest, res: import('express').Response) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const approvalId = String(req.params.id);

    const parsed = resolveBodySchema.safeParse(req.body ?? {});
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
        actorId: `user:${userId}`,
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
          err.code === 'approval_not_found' ? 404 : err.code === 'approval_not_pending' ? 409 : 500;
        return res.status(status).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  };

router.post('/:id/grant', handle('grant'));
router.post('/:id/reject', handle('reject'));

export default router;
