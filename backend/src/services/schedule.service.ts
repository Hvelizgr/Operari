import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import cronstrue from 'cronstrue';
import { SchedulerService, computeNextRunAt } from './scheduler.service';
import { ExecutionService } from '../editor/execution/execution.service';

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
        private executionService: ExecutionService,
    ) {}

    /**
     * Hydrate one ScheduledJob row with workflow info, last run status,
     * and a human-readable cron description. Used by the list endpoint.
     */
    private async hydrate(job: {
        id: string;
        workflowId: string;
        cronExpr: string;
        isActive: boolean;
        lastRunAt: Date | null;
        nextRunAt: Date | null;
        createdAt: Date;
    }, tenantId: string) {
        const [workflow, lastRun] = await Promise.all([
            this.prisma.runbook.findFirst({
                where: { id: job.workflowId, tenantId },
                select: { id: true, slug: true, name: true },
            }),
            this.prisma.execution.findFirst({
                where: {
                    workflowId: job.workflowId,
                    trigger: 'SCHEDULED',
                },
                orderBy: { startedAt: 'desc' },
                select: { id: true, status: true, startedAt: true, completedAt: true },
            }),
        ]);
        if (!workflow) return null;

        let humanCron: string | null = null;
        try {
            humanCron = cronstrue.toString(job.cronExpr);
        } catch {
            humanCron = null;
        }

        return {
            id: job.id,
            workflow,
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
            where: { workflow: { tenantId } },
            orderBy: { createdAt: 'desc' },
        });
        const hydrated = await Promise.all(jobs.map((j) => this.hydrate(j, tenantId)));
        return hydrated.filter((j): j is NonNullable<typeof j> => j !== null);
    }

    async upcoming(tenantId: string, hours: number) {
        const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);
        const jobs = await this.prisma.scheduledJob.findMany({
            where: {
                workflow: { tenantId },
                isActive: true,
                nextRunAt: { not: null, lte: cutoff },
            },
            orderBy: { nextRunAt: 'asc' },
            take: 50,
        });
        const hydrated = await Promise.all(jobs.map((j) => this.hydrate(j, tenantId)));
        return hydrated.filter((j): j is NonNullable<typeof j> => j !== null);
    }

    async create(tenantId: string, workflowId: string, cronExpr: string) {
        if (!cron.validate(cronExpr)) {
            throw new Error(`Invalid cron expression: ${cronExpr}`);
        }
        // Confirm the workflow belongs to the tenant.
        const workflow = await this.prisma.runbook.findFirst({
            where: { id: workflowId, tenantId },
        });
        if (!workflow) {
            throw new Error('workflow_not_found_in_tenant');
        }
        // Schema enforces workflowId @unique, so a second create on the
        // same runbook would 500. Convert to a clean error.
        const existing = await this.prisma.scheduledJob.findUnique({
            where: { workflowId },
        });
        if (existing) {
            throw new Error('schedule_already_exists_for_runbook');
        }

        const job = await this.prisma.scheduledJob.create({
            data: {
                workflowId,
                cronExpr,
                isActive: true,
                nextRunAt: computeNextRunAt(cronExpr),
            },
        });
        await this.scheduler.scheduleJob(job.id, workflowId, cronExpr);
        return job;
    }

    async update(
        tenantId: string,
        id: string,
        patch: { cronExpr?: string; isActive?: boolean },
    ) {
        const existing = await this.prisma.scheduledJob.findFirst({
            where: { id, workflow: { tenantId } },
        });
        if (!existing) return null;

        if (patch.cronExpr !== undefined && !cron.validate(patch.cronExpr)) {
            throw new Error(`Invalid cron expression: ${patch.cronExpr}`);
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
            await this.scheduler.scheduleJob(id, existing.workflowId, nextCron);
        }

        return updated;
    }

    async delete(tenantId: string, id: string) {
        const existing = await this.prisma.scheduledJob.findFirst({
            where: { id, workflow: { tenantId } },
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
            where: { id, workflow: { tenantId } },
            include: { workflow: true },
        });
        if (!job) return null;
        const workflow = await this.prisma.runbook.findFirst({
            where: { id: job.workflowId, tenantId },
        });
        if (!workflow) return null;
        const run = await this.executionService.execute({
            workflowId: workflow.id,
            userId: workflow.userId,
            trigger: 'MANUAL',
            tenantId,
        });
        return { runId: run.id };
    }
}
