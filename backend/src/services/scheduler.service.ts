import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { ExecutionService } from '../editor/execution/execution.service';
import { logger } from '../config/logger.config';

/**
 * Compute the next fire time of a cron expression. Returns null if the
 * expression is invalid (caller should already have validated).
 *
 * Centralized so the schedule service, the runbook upsert path, and the
 * scheduler hot path all agree on the same nextRunAt value.
 */
export function computeNextRunAt(cronExpr: string, from: Date = new Date()): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: from });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export class SchedulerService {
  private prisma: PrismaClient;
  private executionService: ExecutionService;
  private tasks: Map<string, cron.ScheduledTask>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.executionService = new ExecutionService(prisma);
    this.tasks = new Map();
  }

  async start() {
    logger.info('Starting scheduler service...');

    const jobs = await this.prisma.scheduledJob.findMany({
      where: { isActive: true },
    });

    for (const job of jobs) {
      this.scheduleJob(job.id, job.workflowId, job.cronExpr);
    }

    logger.info({ jobCount: jobs.length }, `Scheduler started with ${jobs.length} active jobs`);
  }

  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();
    logger.info('Scheduler stopped');
  }

  async scheduleJob(jobId: string, workflowId: string, cronExpr: string) {
    if (this.tasks.has(jobId)) {
      this.tasks.get(jobId)?.stop();
    }

    if (!cron.validate(cronExpr)) {
      logger.error({ jobId, cronExpr }, `Invalid cron expression for job ${jobId}`);
      return;
    }

    // Persist nextRunAt up front so the Schedules UI sees a real
    // value immediately, not after the first natural fire.
    const nextRunAt = computeNextRunAt(cronExpr);
    if (nextRunAt) {
      await this.prisma.scheduledJob
        .update({ where: { id: jobId }, data: { nextRunAt } })
        .catch(() => {
          /* ignore — job may not exist yet during create flows */
        });
    }

    const task = cron.schedule(cronExpr, async () => {
      logger.info(
        { jobId, workflowId },
        `Executing scheduled job ${jobId} for workflow ${workflowId}`
      );

      try {
        const workflow = await this.prisma.runbook.findUnique({
          where: { id: workflowId },
        });

        if (!workflow) {
          logger.error(
            { workflowId, jobId },
            `Workflow ${workflowId} not found for scheduled job ${jobId}`
          );
          return;
        }

        await this.executionService.execute({
          workflowId: workflow.id,
          userId: workflow.userId,
          tenantId: workflow.tenantId,
          trigger: 'SCHEDULED',
        });

        await this.prisma.scheduledJob.update({
          where: { id: jobId },
          data: {
            lastRunAt: new Date(),
            nextRunAt: computeNextRunAt(cronExpr),
          },
        });
      } catch (error) {
        logger.error({ error, jobId }, `Failed to execute scheduled job ${jobId}`);
      }
    });

    this.tasks.set(jobId, task);
  }

  async rescheduleJob(jobId: string, workflowId: string, cronExpr: string) {
    await this.unscheduleJob(jobId);
    await this.scheduleJob(jobId, workflowId, cronExpr);
  }

  async unscheduleJob(jobId: string) {
    if (this.tasks.has(jobId)) {
      this.tasks.get(jobId)?.stop();
      this.tasks.delete(jobId);
    }
  }
}
