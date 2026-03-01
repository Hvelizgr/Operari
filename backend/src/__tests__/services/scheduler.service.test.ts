import { SchedulerService } from '../../services/scheduler.service';
import { QueueService } from '../../scaling/queue.service';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

// Mock dependencies
jest.mock('../../scaling/queue.service');
jest.mock('node-cron');
jest.mock('@prisma/client');
jest.mock('../../config/logger.config', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));

describe('SchedulerService', () => {
    let schedulerService: SchedulerService;
    let mockPrisma: any;
    let mockQueueService: any;
    let mockTask: any;

    beforeEach(() => {
        // Setup mocks
        mockPrisma = {
            scheduledJob: {
                findMany: jest.fn(),
                update: jest.fn(),
            },
            workflow: {
                findUnique: jest.fn(),
            }
        };

        mockQueueService = {
            enqueueExecution: jest.fn(),
        };
        (QueueService.getInstance as jest.Mock).mockReturnValue(mockQueueService);

        mockTask = {
            stop: jest.fn(),
        };
        (cron.schedule as jest.Mock).mockReturnValue(mockTask);
        (cron.validate as jest.Mock).mockReturnValue(true);

        schedulerService = new SchedulerService(mockPrisma as unknown as PrismaClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should start and schedule active jobs', async () => {
        const activeJobs = [
            { id: 'job-1', workflowId: 'wf-1', cronExpr: '* * * * *', isActive: true },
            { id: 'job-2', workflowId: 'wf-2', cronExpr: '0 0 * * *', isActive: true },
        ];
        mockPrisma.scheduledJob.findMany.mockResolvedValue(activeJobs);

        await schedulerService.start();

        expect(mockPrisma.scheduledJob.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
        expect(cron.schedule).toHaveBeenCalledTimes(2);
        expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));
    });

    it('should stop all tasks', async () => {
        // First add a task
        const activeJobs = [{ id: 'job-1', workflowId: 'wf-1', cronExpr: '* * * * *', isActive: true }];
        mockPrisma.scheduledJob.findMany.mockResolvedValue(activeJobs);
        await schedulerService.start();

        // Then stop
        schedulerService.stop();

        expect(mockTask.stop).toHaveBeenCalled();
    });

    it('should enqueue workflow execution when job runs', async () => {
        // Setup workflow
        const workflow = { id: 'wf-1', userId: 'user-1' };
        mockPrisma.workflow.findUnique.mockResolvedValue(workflow);
        
        // Trigger the cron callback manually
        let cronCallback: (() => void) | undefined;
        (cron.schedule as jest.Mock).mockImplementation((expr, cb) => {
            cronCallback = cb;
            return mockTask;
        });

        await schedulerService.scheduleJob('job-1', 'wf-1', '* * * * *');
        
        expect(cronCallback).toBeDefined();
        if (cronCallback) {
            await cronCallback();
        }

        expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith({
            workflowId: 'wf-1',
            userId: 'user-1',
            trigger: 'SCHEDULED'
        });
        
        expect(mockPrisma.scheduledJob.update).toHaveBeenCalled();
    });
});
