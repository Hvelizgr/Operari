import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { QueueService } from '../scaling/queue.service';
import { logger } from '../config/logger.config';

export class SchedulerService {
    private prisma: PrismaClient;
    private queueService: QueueService;
    private tasks: Map<string, cron.ScheduledTask>;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.queueService = QueueService.getInstance();
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

        const task = cron.schedule(cronExpr, async () => {
            logger.info({ jobId, workflowId }, `Executing scheduled job ${jobId} for workflow ${workflowId}`);

            try {
                const workflow = await this.prisma.workflow.findUnique({
                    where: { id: workflowId },
                });

                if (!workflow) {
                    logger.error({ workflowId, jobId }, `Workflow ${workflowId} not found for scheduled job ${jobId}`);
                    return;
                }

                await this.queueService.enqueueExecution({
                    workflowId: workflow.id,
                    userId: workflow.userId,
                    trigger: 'SCHEDULED',
                });

                await this.prisma.scheduledJob.update({
                    where: { id: jobId },
                    data: {
                        lastRunAt: new Date(),
                        nextRunAt: new Date(Date.now() + 60000),
                    },
                });
            } catch (error) {
                logger.error({ error, jobId }, `Failed to execute scheduled job ${jobId}`);
            }
        });

        this.tasks.set(jobId, task);
    }

    async unscheduleJob(jobId: string) {
        if (this.tasks.has(jobId)) {
            this.tasks.get(jobId)?.stop();
            this.tasks.delete(jobId);
        }
    }
}
