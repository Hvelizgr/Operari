import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  announceApproval,
  ApprovalNotifier,
  ApprovalTargets,
  hasTargets,
} from '../services/approval-notifier';
import { sealTargets } from '../services/approval-sweeper';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface ApprovalConfig {
  /** Message shown to approvers (supports template substitution) */
  message: string;
  /** Emails allowed to resolve the approval, and notified. Comma-separated or a list. */
  approvers?: string | string[];
  /** Auto-reject after this many seconds (default: never) */
  timeoutSeconds?: number;
  slackWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  /** Notify again, adding `escalateTo`, if still pending after this many seconds. */
  escalateAfterSeconds?: number;
  /** Emails that join the approvers on escalation. Comma-separated or a list. */
  escalateTo?: string | string[];
}

/** The sweeper ticks every minute, and a run needs a moment to reach PAUSED. */
const MIN_DEADLINE_SECONDS = 60;

function deadline(seconds: unknown, from: number): Date | undefined {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(from + Math.max(n, MIN_DEADLINE_SECONDS) * 1000);
}

function emailList(value: string | string[] | undefined, context: ExecutorContext): string[] {
  const items = Array.isArray(value) ? value : [value ?? ''];
  const emails = items
    .flatMap(item => resolveTemplate(item, context).split(/[\s,;]+/))
    .map(email => email.trim().toLowerCase())
    .filter(email => email.includes('@'));
  return Array.from(new Set(emails));
}

export interface ApprovalExecutorOptions {
  /**
   * Audit service used to record approval lifecycle events. Pass `null`
   * to disable, otherwise a default instance is built from prisma.
   */
  audit?: AuditService | null;
  notifier?: ApprovalNotifier;
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
  private readonly notifier: ApprovalNotifier;

  constructor(
    private prisma: PrismaClient,
    options: ApprovalExecutorOptions = {}
  ) {
    this.audit = options.audit === null ? null : (options.audit ?? new AuditService(prisma));
    this.notifier = options.notifier ?? new ApprovalNotifier();
  }

  async execute(config: ApprovalConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const message = resolveTemplate(config.message, context);

    // Dry-run: skip the human-in-the-loop pause. Emit a log line
    // so the operator can see which gates would have fired during
    // the real run + auto-return success so downstream steps
    // execute. No Approval row is created, so the inbox stays
    // clean of synthetic approvals.
    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would request approval: ${message}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          message,
          status: 'AUTO_APPROVED',
        },
        duration: Date.now() - startTime,
      };
    }

    // Look up the runbookId from the execution
    const execution = await this.prisma.execution.findUnique({
      where: { id: context.runId },
      select: { runbookId: true, userId: true, runbook: { select: { name: true } } },
    });

    if (!execution) {
      return {
        success: false,
        error: `Execution ${context.runId} not found`,
        duration: Date.now() - startTime,
      };
    }

    const approvers = emailList(config.approvers, context);
    const escalateTo = emailList(config.escalateTo, context);
    const expiresAt = deadline(config.timeoutSeconds, startTime);
    const escalateAt = deadline(config.escalateAfterSeconds, startTime);
    const slackWebhookUrl = resolveTemplate(config.slackWebhookUrl ?? '', context);
    const botToken = resolveTemplate(config.telegramBotToken ?? '', context);
    const chatId = resolveTemplate(config.telegramChatId ?? '', context);
    const targets: ApprovalTargets = {
      emails: approvers,
      ...(slackWebhookUrl ? { slackWebhookUrl } : {}),
      ...(botToken && chatId ? { telegram: { botToken, chatId } } : {}),
    };
    const sealed =
      escalateAt && context.tenantId && hasTargets(targets)
        ? sealTargets(targets, context.tenantId)
        : null;

    const approval = await this.prisma.approval.create({
      data: {
        runbookId: execution.runbookId,
        executionId: context.runId,
        stepId: context.stepId,
        status: 'PENDING',
        message,
        requestedBy: execution.userId,
        ...(approvers.length ? { approvers } : {}),
        ...(escalateTo.length ? { escalateTo } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(escalateAt ? { escalateAt } : {}),
        ...(sealed ? { notifyTargets: sealed } : {}),
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
            runbookId: execution.runbookId,
            stepId: context.stepId,
            approvalId: approval.id,
            message,
            approvers: approvers.length ? approvers : null,
            timeoutSeconds: config.timeoutSeconds ?? null,
            escalateTo: escalateTo.length ? escalateTo : null,
            escalateAfterSeconds: config.escalateAfterSeconds ?? null,
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

    // Not awaited: a slow channel must not delay the run reaching PAUSED, or an
    // answer could arrive before the run can be resumed.
    if (hasTargets(targets)) {
      void announceApproval({
        notifier: this.notifier,
        audit: this.audit,
        notice: {
          approvalId: approval.id,
          runbookName: execution.runbook?.name ?? execution.runbookId,
          message,
          escalated: false,
        },
        targets,
        tenantId: context.tenantId,
        executionId: context.runId,
      });
    }

    // Return paused — runbook engine will suspend execution until approval resolves.
    // conditionResult: true tells the engine to follow port 0 (approved) when the
    // run resumes. If the approval is rejected, the execution is CANCELLED outright
    // (see ApprovalService.resolve) so the false branch never fires — matching the
    // "approved" / "rejected" output port semantics defined in NodePalette.tsx.
    return {
      success: true,
      paused: true,
      output: {
        approvalId: approval.id,
        message,
        status: 'PENDING',
        conditionResult: true, // approved branch (port 0) on resume
      },
      duration: Date.now() - startTime,
    };
  }
}
