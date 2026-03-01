import Queue from 'bull';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { ExecutionService, ExecuteParams } from '../editor/execution/execution.service';
import { prisma } from '../config/database';
import { redisConfig } from '../config/redis.config';

export class QueueService {
    private static instance: QueueService;
    private workflowQueue: Queue.Queue | null = null;
    private isInitialized: boolean = false;
    private fallbackMode: boolean = false;

    private constructor() {
        this.initializeQueue();
    }

    private initializeQueue() {
        const redisUrl = env.REDIS_URL;
        
        if (!redisUrl) {
            logger.warn('Redis URL not configured. Queue service running in fallback mode (direct execution).');
            this.fallbackMode = true;
            return;
        }

        try {
            this.workflowQueue = new Queue('workflow-executions', redisUrl, {
                settings: {
                    stalledInterval: 30000,
                    maxStalledCount: 3,
                },
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            });

            this.workflowQueue.on('error', (error) => {
                logger.error({ error }, 'Queue error - switching to fallback mode');
                this.fallbackMode = true;
            });

            this.workflowQueue.on('ready', () => {
                logger.info('Queue service connected to Redis');
                this.fallbackMode = false;
                this.isInitialized = true;
            });

            this.isInitialized = true;
        } catch (error) {
            logger.error({ error }, 'Failed to initialize queue service');
            this.fallbackMode = true;
        }
    }

    public static getInstance(): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService();
        }
        return QueueService.instance;
    }

    public startWorker() {
        if (this.fallbackMode || !this.workflowQueue) {
            logger.info('Queue worker skipped - running in fallback mode');
            return;
        }
        this.initializeWorker();
    }

    private initializeWorker() {
        if (!this.workflowQueue) return;
        
        logger.info('Initializing Queue Worker...');
        
        this.workflowQueue.process(async (job) => {
            const { params } = job.data as { params: ExecuteParams };
            logger.info({ jobId: job.id, workflowId: params.workflowId }, 'Processing workflow execution from queue');

            try {
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
        
        this.workflowQueue.on('stalled', (job) => {
            logger.warn({ jobId: job.id }, 'Job stalled - will be retried');
        });
        
        logger.info('Queue Worker initialized');
    }

    public async enqueueExecution(params: ExecuteParams) {
        const workerEnabled = process.env.ENABLE_WORKER === 'true';
        
        if (this.fallbackMode || !this.workflowQueue || !redisConfig.isReady() || !workerEnabled) {
            logger.info({ workflowId: params.workflowId }, 'Direct execution mode: executing workflow immediately');
            return this.executeDirectly(params);
        }

        try {
            return await this.workflowQueue.add({ params });
        } catch (error) {
            logger.warn({ error }, 'Failed to enqueue - falling back to direct execution');
            return this.executeDirectly(params);
        }
    }

    private async executeDirectly(params: ExecuteParams) {
        const executionService = new ExecutionService(prisma);
        const result = await executionService.execute(params);
        return { id: result.id, jobId: 'direct-' + Date.now(), data: result };
    }
    
    public async getJob(jobId: string) {
        if (!this.workflowQueue) return null;
        return this.workflowQueue.getJob(jobId);
    }

    public async cleanOldJobs() {
        if (!this.workflowQueue) return;
        await this.workflowQueue.clean(1000 * 60 * 60 * 24, 'completed');
        await this.workflowQueue.clean(1000 * 60 * 60 * 24, 'failed');
    }

    public async close() {
        if (this.workflowQueue) {
            await this.workflowQueue.close();
        }
    }

    public getStatus() {
        return {
            initialized: this.isInitialized,
            fallbackMode: this.fallbackMode,
            redisStatus: redisConfig.getStatus(),
        };
    }
}
