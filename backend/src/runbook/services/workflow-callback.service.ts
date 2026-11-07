import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { AuditService } from '../../audit/audit.service';
import { logger } from '../../config/logger.config';

const BATCH = 100;

export type ResumeFn = (params: {
  executionId: string;
  userId: string;
  tenantId: string;
  input?: Record<string, unknown>;
}) => Promise<unknown>;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicBase(): string {
  const env = process.env;
  const base =
    env.OPERARI_RUNNER_CALLBACK_URL || env.APP_URL || env.FRONTEND_URL || 'http://localhost:4000';
  return base.split(',')[0].trim().replace(/\/$/, '');
}

/**
 * One-use return address for a workflow running elsewhere. The answer is stored
 * before anything else happens: a fast workflow can reply while the run is
 * still on its way to PAUSED, when it cannot be resumed yet, and the sweep
 * delivers it then.
 */
export class WorkflowCallbackService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly resume: ResumeFn,
    private readonly audit: AuditService | null = new AuditService(prisma)
  ) {}

  async issue(params: {
    tenantId: string;
    executionId: string;
    stepId: string;
    expiresAt: Date;
  }): Promise<{ id: string; url: string }> {
    const token = randomBytes(32).toString('base64url');
    const row = await this.prisma.workflowCallback.create({
      data: { ...params, tokenHash: hashToken(token) },
    });
    return { id: row.id, url: `${publicBase()}/webhook/workflow-callback/${token}` };
  }

  /** Drops the address after the call failed, so the sweep has nothing to time out. */
  async revoke(id: string): Promise<void> {
    await this.prisma.workflowCallback.delete({ where: { id } });
  }

  /** False for an unknown, used or expired token; callers cannot tell which. */
  async receive(token: string, payload: unknown): Promise<boolean> {
    const tokenHash = hashToken(token);
    const claim = await this.prisma.workflowCallback.updateMany({
      where: { tokenHash, status: 'WAITING', expiresAt: { gt: new Date() } },
      data: {
        status: 'RECEIVED',
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        receivedAt: new Date(),
      },
    });
    if (claim.count === 0) return false;

    const row = await this.prisma.workflowCallback.findUnique({ where: { tokenHash } });
    if (row) {
      await this.record('workflow.callback_received', row.tenantId, row.executionId, row.stepId);
      await this.deliver(row.id).catch(err => {
        logger.error({ err, callbackId: row.id }, 'Workflow callback delivery failed');
      });
    }
    return true;
  }

  private async deliver(id: string): Promise<void> {
    const row = await this.prisma.workflowCallback.findUnique({ where: { id } });
    if (!row || row.status !== 'RECEIVED') return;
    const execution = await this.prisma.execution.findUnique({
      where: { id: row.executionId },
      select: { status: true, userId: true },
    });
    if (!execution) return;
    if (execution.status === 'RUNNING' || execution.status === 'PENDING') return;

    const claim = await this.prisma.workflowCallback.updateMany({
      where: { id, status: 'RECEIVED' },
      data: { status: 'DONE' },
    });
    if (claim.count === 0 || execution.status !== 'PAUSED') return;

    try {
      await this.resume({
        executionId: row.executionId,
        userId: execution.userId,
        tenantId: row.tenantId,
        input: { callback: row.payload },
      });
    } catch (err) {
      await this.prisma.workflowCallback.update({ where: { id }, data: { status: 'RECEIVED' } });
      throw err;
    }
  }

  async sweep(now: Date = new Date()): Promise<void> {
    const received = await this.prisma.workflowCallback.findMany({
      where: { status: 'RECEIVED' },
      select: { id: true },
      take: BATCH,
    });
    for (const { id } of received) {
      await this.deliver(id).catch(err => {
        logger.error({ err, callbackId: id }, 'Workflow callback delivery failed');
      });
    }

    const expired = await this.prisma.workflowCallback.findMany({
      where: { status: 'WAITING', expiresAt: { lte: now } },
      take: BATCH,
    });
    for (const row of expired) {
      const claim = await this.prisma.workflowCallback.updateMany({
        where: { id: row.id, status: 'WAITING' },
        data: { status: 'TIMED_OUT' },
      });
      if (claim.count === 0) continue;
      const error = 'The workflow did not answer in time';
      await this.prisma.execution.updateMany({
        where: { id: row.executionId, status: 'PAUSED' },
        data: { status: 'FAILED', completedAt: now, error },
      });
      await this.prisma.nodeLog.updateMany({
        where: { executionId: row.executionId, nodeId: row.stepId, status: 'RUNNING' },
        data: { status: 'FAILED', completedAt: now, error },
      });
      await this.record('workflow.timed_out', row.tenantId, row.executionId, row.stepId);
    }
  }

  private async record(
    type: 'workflow.callback_received' | 'workflow.timed_out',
    tenantId: string,
    executionId: string,
    stepId: string
  ): Promise<void> {
    await this.audit
      ?.record({
        tenantId,
        type,
        actorId: 'system',
        actorType: 'system',
        resource: executionId,
        payload: { executionId, stepId },
      })
      .catch(() => undefined);
  }
}
