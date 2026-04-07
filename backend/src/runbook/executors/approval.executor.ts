import { PrismaClient } from '@prisma/client';
import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
    resolveTemplate,
} from '../types/executor.types';
import { AuditService } from '../../audit/audit.service';

export interface ApprovalConfig {
    /** Message shown to approvers (supports template substitution) */
    message: string;
    /** Optional list of user emails who can approve */
    approvers?: string[];
    /** Auto-reject after this many seconds (default: never) */
    timeoutSeconds?: number;
}

export interface ApprovalExecutorOptions {
    /**
     * Audit service used to record approval lifecycle events. Pass `null`
     * to disable, otherwise a default instance is built from prisma.
     */
    audit?: AuditService | null;
}

/**
 * Approval gate executor.
 *
 * When a runbook reaches an approval node, the run is PAUSED and an
 * Approval record is created in the database. The run resumes only when
 * an authorized user approves (or rejects) it via the UI or API.
 *
 * This is the canonical "human-in-the-loop" pattern for sensitive
 * operations like production deploys, secret rotations, and destructive
 * database migrations.
 *
 * The executor emits an `approval.requested` audit event when the
 * Approval row is created. The matching `approval.granted` /
 * `approval.rejected` events are emitted by the resolution endpoint
 * `POST /api/v1/approvals/:id/grant|reject` via ApprovalService.
 */
export class ApprovalExecutor implements StepExecutor<ApprovalConfig> {
    readonly type = 'approval';

    private readonly audit: AuditService | null;

    constructor(private prisma: PrismaClient, options: ApprovalExecutorOptions = {}) {
        this.audit = options.audit === null
            ? null
            : (options.audit ?? new AuditService(prisma));
    }

    async execute(config: ApprovalConfig, context: ExecutorContext): Promise<ExecutorResult> {
        const startTime = Date.now();
        const message = resolveTemplate(config.message, context);

        // Look up the workflowId from the execution
        const execution = await this.prisma.execution.findUnique({
            where: { id: context.runId },
            select: { workflowId: true, userId: true },
        });

        if (!execution) {
            return {
                success: false,
                error: `Execution ${context.runId} not found`,
                duration: Date.now() - startTime,
            };
        }

        const approval = await this.prisma.approval.create({
            data: {
                workflowId: execution.workflowId,
                executionId: context.runId,
                stepId: context.stepId,
                status: 'PENDING',
                message,
                requestedBy: execution.userId,
            },
        });

        context.emit?.({
            type: 'log',
            text: `Approval requested: ${message}`,
            timestamp: new Date(),
        });

        // Fire-and-forget audit. Failures are swallowed so a broken audit
        // chain never blocks a runbook execution.
        if (this.audit && context.tenantId) {
            try {
                await this.audit.record({
                    tenantId: context.tenantId,
                    type: 'approval.requested',
                    actorId: execution.userId,
                    actorType: 'system',
                    resource: context.runId,
                    payload: {
                        executionId: context.runId,
                        workflowId: execution.workflowId,
                        stepId: context.stepId,
                        approvalId: approval.id,
                        message,
                        approvers: config.approvers ?? null,
                        timeoutSeconds: config.timeoutSeconds ?? null,
                    },
                });
            } catch (err) {
                context.emit?.({
                    type: 'log',
                    text: `[audit] failed to record approval.requested: ${(err as Error).message}`,
                    timestamp: new Date(),
                });
            }
        }

        // Return paused — runbook engine will suspend execution until approval resolves
        return {
            success: true,
            paused: true,
            output: {
                approvalId: approval.id,
                message,
                status: 'PENDING',
            },
            duration: Date.now() - startTime,
        };
    }
}
