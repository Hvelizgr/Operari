import Queue from 'bull';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { ExecutionService, ExecuteParams } from '../editor/execution/execution.service';
import { prisma } from '../config/database';

export class QueueService {
    private static instance: QueueService;
    private workflowQueue: Queue.Queue;

    private constructor() {
        const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
        this.workflowQueue = new Queue('workflow-executions', redisUrl);
    }

    public static getInstance(): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService();
        }
        return QueueService.instance;
    }

    public startWorker() {
        // Simple check to avoid double initialization (though implementation safe)
        if (this.workflowQueue.client.status === 'ready' && this.workflowQueue.count() === undefined) { 
           // This check is flaky for 'handlers', so let's just proceed. 
           // Bull handles multiple process calls by adding more processors, which might be desired or not.
           // For now, let's assume the caller controls this.
        }
        this.initializeWorker();
    }

    private initializeWorker() {
        logger.info('Initializing Queue Worker...');
        
        this.workflowQueue.process(async (job) => {
            const { params } = job.data as { params: ExecuteParams };
            logger.info({ jobId: job.id, workflowId: params.workflowId }, 'Processing workflow execution from queue');

            try {
                // In a real isolated worker, we might need to instantiate Prisma and other services fresh.
                // For now, running in the same process, we reuse the existing services.
                const executionService = new ExecutionService(prisma);
                const result = await executionService.execute(params);
                return result;
            } catch (error) {
                logger.error({ jobId: job.id, error }, 'Failed to process workflow execution');
                throw error;
            }
        });

        this.workflowQueue.on('completed', (job, result) => {
            logger.info({ jobId: job.id, executionId: result?.id }, 'Job completed successfully');
        });

        this.workflowQueue.on('failed', (job, err) => {
            logger.error({ jobId: job.id, error: err }, 'Job failed');
        });
        
        this.workflowQueue.on('error', (error) => {
            logger.error({ error }, 'Queue error');
        });
        
        logger.info('Queue Worker initialized');
    }

    public async enqueueExecution(params: ExecuteParams) {
        return this.workflowQueue.add(
            { params }, 
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: true,
                removeOnFail: false 
            }
        );
    }
    
    public async getJob(jobId: string) {
        return this.workflowQueue.getJob(jobId);
    }

    public async cleanOldJobs() {
        await this.workflowQueue.clean(1000 * 60 * 60 * 24, 'completed');
        await this.workflowQueue.clean(1000 * 60 * 60 * 24, 'failed');
    }

    public async close() {
        await this.workflowQueue.close();
    }
}
