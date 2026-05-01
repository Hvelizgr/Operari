import { PrismaClient } from '@prisma/client';
import cronstrue from 'cronstrue';
import cron from 'node-cron';

import { ExecutionService } from '../editor/execution/execution.service';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { computeNextRunAt, SchedulerService } from './scheduler.service';

/**
 * Schedule resource service. Wraps prisma.scheduledJob with multi-tenant
 * scoping and keeps the in-memory SchedulerService in sync. Every CRUD
 * operation that touches a row also reschedules / unschedules the job
 * inside the live cron registry — otherwise the UI would silently lie
 * about the job state until the next backend restart.
 */
export class ScheduleService {
  constructor(
    private prisma: PrismaClient,
    private scheduler: SchedulerService,
    private executionService: ExecutionService
  ) {}

  /**
   * Hydrate one ScheduledJob row with runbook info, last run status,
   * and a human-readable cron description. Used by the list endpoint.
   */
  private async hydrate(
    job: {
      id: string;
      runbookId: string;
      cronExpr: string;
      isActive: boolean;
      lastRunAt: Date | null;
      nextRunAt: Date | null;
      createdAt: Date;
    },
    tenantId: string
  ) {
    const [runbook, lastRun] = await Promise.all([
      this.prisma.runbook.findFirst({
        where: { id: job.runbookId, tenantId },
        select: { id: true, slug: true, name: true },
      }),
      this.prisma.execution.findFirst({
        where: {
          tenantId,
          runbookId: job.runbookId,
          trigger: 'SCHEDULED',
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, startedAt: true, completedAt: true },
      }),
    ]);
    if (!runbook) return null;

    let humanCron: string | null = null;
    try {
      humanCron = cronstrue.toString(job.cronExpr);
    } catch {
      humanCron = null;
    }

    return {
      id: job.id,
      runbook,
      cronExpr: job.cronExpr,
      humanCron,
      isActive: job.isActive,
      lastRunAt: job.lastRunAt,
      nextRunAt: job.nextRunAt,
      lastRun,
      createdAt: job.createdAt,
    };
  }

  async list(tenantId: string) {
    const jobs = await this.prisma.scheduledJob.findMany({
      where: { runbook: { tenantId } },
      orderBy: { createdAt: 'desc' },
    });
    const hydrated = await Promise.all(jobs.map(j => this.hydrate(j, tenantId)));
    return hydrated.filter((j): j is NonNullable<typeof j> => j !== null);
  }

  async upcoming(tenantId: string, hours: number) {
    const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);
    const jobs = await this.prisma.scheduledJob.findMany({
      where: {
        runbook: { tenantId },
        isActive: true,
        nextRunAt: { not: null, lte: cutoff },
      },
      orderBy: { nextRunAt: 'asc' },
      take: 50,
    });
    const hydrated = await Promise.all(jobs.map(j => this.hydrate(j, tenantId)));
    return hydrated.filter((j): j is NonNullable<typeof j> => j !== null);
  }

  async create(tenantId: string, runbookId: string, cronExpr: string) {
    if (!cron.validate(cronExpr)) {
      throw new CustomError({
        message: `Invalid cron expression: ${cronExpr}`,
        code: ErrorCode.VALIDATION_ERROR,
        userMessage: 'The cron expression is not valid.',
      });
    }
    // Confirm the runbook belongs to the tenant.
    const runbook = await this.prisma.runbook.findFirst({
      where: { id: runbookId, tenantId },
    });
    if (!runbook) {
      throw new CustomError({
        message: `Workflow ${runbookId} not found for tenant ${tenantId}`,
        code: ErrorCode.WORKFLOW_NOT_FOUND,
        userMessage: 'Runbook not found.',
      });
    }
    // Schema enforces runbookId @unique, so a second create on the
    // same runbook would 500. Convert to a clean 409.
    const existing = await this.prisma.scheduledJob.findUnique({
      where: { runbookId },
    });
    if (existing) {
      throw new CustomError({
        message: 'schedule_already_exists_for_runbook',
        code: ErrorCode.RESOURCE_CONFLICT,
        userMessage: 'This runbook already has a schedule.',
      });
    }

    const job = await this.prisma.scheduledJob.create({
      data: {
        runbookId,
        cronExpr,
        isActive: true,
        nextRunAt: computeNextRunAt(cronExpr),
      },
    });
    await this.scheduler.scheduleJob(job.id, runbookId, cronExpr);
    return job;
  }

  async update(tenantId: string, id: string, patch: { cronExpr?: string; isActive?: boolean }) {
    const existing = await this.prisma.scheduledJob.findFirst({
      where: { id, runbook: { tenantId } },
    });
    if (!existing) return null;

    if (patch.cronExpr !== undefined && !cron.validate(patch.cronExpr)) {
      throw new CustomError({
        message: `Invalid cron expression: ${patch.cronExpr}`,
        code: ErrorCode.VALIDATION_ERROR,
        userMessage: 'The cron expression is not valid.',
      });
    }

    const nextCron = patch.cronExpr ?? existing.cronExpr;
    const nextActive = patch.isActive ?? existing.isActive;
    const nextRunAt = nextActive ? computeNextRunAt(nextCron) : null;

    const updated = await this.prisma.scheduledJob.update({
      where: { id },
      data: {
        ...(patch.cronExpr !== undefined && { cronExpr: patch.cronExpr }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
        nextRunAt,
      },
    });

    // Sync the live registry — pause / resume / change cron all
    // require unschedule + (maybe) reschedule.
    await this.scheduler.unscheduleJob(id);
    if (nextActive) {
      await this.scheduler.scheduleJob(id, existing.runbookId, nextCron);
    }

    return updated;
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.scheduledJob.findFirst({
      where: { id, runbook: { tenantId } },
    });
    if (!existing) return null;
    await this.scheduler.unscheduleJob(id);
    await this.prisma.scheduledJob.delete({ where: { id } });
    return existing;
  }

  /**
   * Trigger a manual run of the scheduled runbook *now*. Marked as
   * MANUAL trigger (not SCHEDULED) so the run history correctly
   * shows that a human pressed Run-now.
   */
  async runNow(tenantId: string, id: string) {
    const job = await this.prisma.scheduledJob.findFirst({
      where: { id, runbook: { tenantId } },
      include: { runbook: true },
    });
    if (!job) return null;
    const runbook = await this.prisma.runbook.findFirst({
      where: { id: job.runbookId, tenantId },
    });
    if (!runbook) return null;
    const run = await this.executionService.execute({
      runbookId: runbook.id,
      userId: runbook.userId,
      trigger: 'MANUAL',
      tenantId,
    });
    return { runId: run.id };
  }
}
