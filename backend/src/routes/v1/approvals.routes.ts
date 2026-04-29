import { Response, Router } from 'express';
import { z } from 'zod';

import { ExecutionService } from '../../editor/execution/execution.service';
import { ApiKeyRequest, requireApiKey } from '../../middleware/api-key.middleware';
import {
  ApprovalService,
  ApprovalServiceError,
  ResolveAction,
} from '../../runbook/services/approval.service';
import { prisma } from '../../server';

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

const handle = (action: ResolveAction) => async (req: ApiKeyRequest, res: Response) => {
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
      runbookId: result.runbookId,
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

/**
 * POST /api/v1/approvals/:id/grant
 *
 * Grants a pending approval and resumes the paused execution.
 *
 * Requires scope: `approvals:resolve`.
 * Audit: emits `approval.granted`. Resume in turn emits `run.resumed`.
 */
/**
 * GET /api/v1/approvals
 *
 * List approvals for the authenticated tenant. Default behavior:
 * returns the PENDING ones (the inbox the on-call engineer cares
 * about). Pass `?status=APPROVED|REJECTED|EXPIRED|all` to widen.
 *
 * Tenant scoping: the Approval model has no tenantId column; it
 * scopes via the parent Workflow's tenantId. The query joins through
 * `runbook.tenantId` so a tenant cannot see another tenant's approvals.
 *
 * Pagination: `?limit=N&cursor=<approvalId>` — cursor is the id of
 * the last approval from the previous page. Default limit 50, max 200.
 *
 * Requires scope: `approvals:read`.
 */
router.get('/', requireApiKey('approvals:read'), async (req: ApiKeyRequest, res: Response) => {
  const { tenantId } = req.apiContext!;

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
      error: `Invalid status: ${statusParam}. Must be one of PENDING|APPROVED|REJECTED|EXPIRED|all.`,
      code: 'invalid_status',
    });
  }

  const limitRaw = parseInt((req.query.limit as string) ?? '50', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  const cursor = req.query.cursor as string | undefined;

  const approvals = await prisma.approval.findMany({
    where: {
      runbook: { tenantId },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      runbook: { select: { id: true, slug: true, name: true } },
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
      runbook: a.runbook,
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
