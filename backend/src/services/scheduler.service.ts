import { PrismaClient } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';
import cron from 'node-cron';

import { logger } from '../config/logger.config';
import { ExecutionService } from '../editor/execution/execution.service';
import { parseInputDefs } from '../runbook/inputs/parse-input-defs';
import { validateRunInputs } from '../runbook/inputs/validate-run-inputs';

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
      this.scheduleJob(job.id, job.runbookId, job.cronExpr);
    }

    logger.info({ jobCount: jobs.length }, `Scheduler started with ${jobs.length} active jobs`);
  }

  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();
    logger.info('Scheduler stopped');
  }

  async scheduleJob(jobId: string, runbookId: string, cronExpr: string) {
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
        { jobId, runbookId },
        `Executing scheduled job ${jobId} for runbook ${runbookId}`
      );

      try {
        const runbook = await this.prisma.runbook.findUnique({
          where: { id: runbookId },
        });

        if (!runbook) {
          logger.error(
            { runbookId, jobId },
            `Workflow ${runbookId} not found for scheduled job ${jobId}`
          );
          return;
        }

        // Resolve the runbook's declared typed inputs from their
        // defaults. A schedule fire carries no user-supplied payload,
        // so validateRunInputs({}) either returns a defaults-only map
        // or fails because a required input has no default — in which
        // case we skip the dispatch and log, rather than silently
        // running the graph against undefined variables.
        const inputDefs = parseInputDefs(runbook.inputs);
        const validated = validateRunInputs(inputDefs, {});
        if (!validated.ok) {
          logger.error(
            { runbookId, jobId, issues: validated.issues },
            `Scheduled job ${jobId} skipped — required inputs missing and no defaults`
          );
          // Advance nextRunAt anyway so the UI doesn't stall on a
          // stale timestamp while the operator fixes the runbook.
          await this.prisma.scheduledJob
            .update({
              where: { id: jobId },
              data: { nextRunAt: computeNextRunAt(cronExpr) },
            })
            .catch(() => {
              /* ignore — job may have been deleted concurrently */
            });
          return;
        }

        await this.executionService.execute({
          runbookId: runbook.id,
          userId: runbook.userId,
          tenantId: runbook.tenantId,
          trigger: 'SCHEDULED',
          input: validated.values,
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

  async rescheduleJob(jobId: string, runbookId: string, cronExpr: string) {
    await this.unscheduleJob(jobId);
    await this.scheduleJob(jobId, runbookId, cronExpr);
  }

  async unscheduleJob(jobId: string) {
    if (this.tasks.has(jobId)) {
      this.tasks.get(jobId)?.stop();
      this.tasks.delete(jobId);
    }
  }
}
