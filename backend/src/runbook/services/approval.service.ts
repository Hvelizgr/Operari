import { ApprovalStatus, PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

export type ResolveAction = 'grant' | 'reject';

export interface ResolveApprovalInput {
  approvalId: string;
  /** Tenant id from the API key context — used for authorization */
  tenantId: string;
  action: ResolveAction;
  /** Logical actor (e.g. "apikey:key-9" or a user id) */
  actorId: string;
  /** Optional human comment shown next to the resolution */
  comment?: string;
}

export interface ResolvedApproval {
  id: string;
  status: ApprovalStatus;
  workflowId: string;
  executionId: string;
  stepId: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  comment: string | null;
  /** True iff a paused Execution was resumed (grant only) */
  executionResumed: boolean;
  /** True iff the Execution was marked CANCELLED (reject only) */
  executionCancelled: boolean;
}

/**
 * Errors raised by ApprovalService.resolve(). The route layer maps the
 * `code` to the right HTTP status.
 *
 * Codes:
 *   - approval_not_found       → 404 (also used when tenant mismatch, on
 *                                  purpose, to avoid leaking existence)
 *   - approval_not_pending     → 409 — already resolved or expired
 *   - execution_not_paused     → 409 — runbook moved on already
 */
export class ApprovalServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApprovalServiceError';
  }
}

/**
 * Resume hook — abstracted so we don't import the full ExecutionService
 * in tests. Real wiring passes ExecutionService.resumeExecution.bound.
 */
export type ResumeFn = (params: {
  executionId: string;
  userId: string;
  tenantId: string;
}) => Promise<unknown>;

export interface ApprovalServiceOptions {
  /** Audit service used to record approval.granted / approval.rejected */
  audit?: AuditService | null;
  /** Function used to resume a paused execution after a grant */
  resumeExecution?: ResumeFn;
}

/**
 * ApprovalService — resolves a pending approval and propagates the
 * effect to the underlying Execution.
 *
 * Concurrency: the resolution path runs inside a Prisma `$transaction`
 * with an `updateMany(where: {status: PENDING})` to atomically claim the
 * approval. If the count is zero, somebody else already resolved it and
 * we report `approval_not_pending` instead of double-resolving.
 *
 * On grant: the matching paused Execution is resumed via the injected
 * `resumeExecution` function. The actual run continues asynchronously,
 * exactly like the existing /resume HTTP endpoint.
 *
 * On reject: the Execution is marked CANCELLED with an explanatory error
 * field. The runbook does NOT resume — anything downstream of the
 * approval node is dropped.
 */
export class ApprovalService {
  private readonly audit: AuditService | null;
  private readonly resumeExecution: ResumeFn | null;

  constructor(
    private readonly prisma: PrismaClient,
    options: ApprovalServiceOptions = {}
  ) {
    this.audit = options.audit === null ? null : (options.audit ?? new AuditService(prisma));
    this.resumeExecution = options.resumeExecution ?? null;
  }

  async resolve(input: ResolveApprovalInput): Promise<ResolvedApproval> {
    const newStatus: ApprovalStatus = input.action === 'grant' ? 'APPROVED' : 'REJECTED';

    // Look up approval + execution + workflow.tenantId in one go.
    const approval = await this.prisma.approval.findUnique({
      where: { id: input.approvalId },
      include: {
        workflow: { select: { tenantId: true } },
      },
    });

    // Tenant isolation: an approval belonging to another tenant is
    // reported as not-found, never as forbidden, to avoid information
    // leakage about which IDs exist on the platform.
    if (!approval || approval.workflow.tenantId !== input.tenantId) {
      throw new ApprovalServiceError(
        'approval_not_found',
        `Approval ${input.approvalId} not found`
      );
    }

    const result = await this.prisma.$transaction(async tx => {
      // Atomically claim the approval — only succeeds if still PENDING.
      const claim = await tx.approval.updateMany({
        where: { id: input.approvalId, status: 'PENDING' },
        data: {
          status: newStatus,
          approvedBy: input.actorId,
          approvedAt: new Date(),
          comment: input.comment ?? null,
        },
      });
      if (claim.count === 0) {
        throw new ApprovalServiceError(
          'approval_not_pending',
          `Approval ${input.approvalId} is no longer pending`
        );
      }

      const fresh = await tx.approval.findUniqueOrThrow({
        where: { id: input.approvalId },
      });

      let executionCancelled = false;
      if (input.action === 'reject') {
        // Mark the execution CANCELLED — only effective if still
        // PAUSED, to avoid clobbering a run that already moved on.
        const cancelled = await tx.execution.updateMany({
          where: { id: fresh.executionId, status: 'PAUSED' },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            error: `Approval rejected${input.comment ? `: ${input.comment}` : ''}`,
          },
        });
        executionCancelled = cancelled.count > 0;
      }

      return { fresh, executionCancelled };
    });

    // Resume the execution OUTSIDE the transaction so we don't hold a
    // DB connection during the entire runbook continuation.
    let executionResumed = false;
    if (input.action === 'grant') {
      if (this.resumeExecution) {
        try {
          await this.resumeExecution({
            executionId: result.fresh.executionId,
            userId: input.actorId,
            tenantId: input.tenantId,
          });
          executionResumed = true;
        } catch (err) {
          // The approval row is already claimed. We log via audit
          // and let the caller see executionResumed=false. The run
          // can be resumed manually via /resume if needed.
          executionResumed = false;
          void err;
        }
      }
    }

    await this.safeAudit({
      type: input.action === 'grant' ? 'approval.granted' : 'approval.rejected',
      tenantId: input.tenantId,
      actorId: input.actorId,
      resource: result.fresh.executionId,
      payload: {
        approvalId: result.fresh.id,
        executionId: result.fresh.executionId,
        workflowId: result.fresh.workflowId,
        stepId: result.fresh.stepId,
        comment: input.comment ?? null,
        executionResumed,
        executionCancelled: result.executionCancelled,
      },
    });

    return {
      id: result.fresh.id,
      status: result.fresh.status,
      workflowId: result.fresh.workflowId,
      executionId: result.fresh.executionId,
      stepId: result.fresh.stepId,
      approvedBy: result.fresh.approvedBy,
      approvedAt: result.fresh.approvedAt,
      comment: result.fresh.comment,
      executionResumed,
      executionCancelled: result.executionCancelled,
    };
  }

  private async safeAudit(params: {
    type: 'approval.granted' | 'approval.rejected';
    tenantId: string;
    actorId: string;
    resource: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (!this.audit) return;
    try {
      await this.audit.record({
        tenantId: params.tenantId,
        type: params.type,
        actorId: params.actorId,
        actorType: 'apikey',
        resource: params.resource,
        payload: params.payload,
      });
    } catch {
      // never block the resolution
    }
  }
}
