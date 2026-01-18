import './config/env.config'; // Load env vars
import { prisma } from './config/database';
import { QueueService } from './scaling/queue.service';
import { logger } from './config/logger.config';
import { NodeLoaderService } from './services/node-loader.service';

async function startWorker() {
    try {
        logger.info('Starting NanoFlow Job Worker...');

        // Connect to Database
        await prisma.$connect();
        logger.info('Database connected');

        // Initialize Dynamic Node Loader (needed for execution)
        await NodeLoaderService.getInstance().initialize();
        logger.info('Node Loader initialized');

        // Start Queue Processing
        const queueService = QueueService.getInstance();
        queueService.startWorker();
        
        logger.info('Worker is ready and processing jobs 🚀');

        // Graceful Shutdown
        const shutdown = async () => {
             logger.info('Shutting down worker...');
             await queueService.close();
             await prisma.$disconnect();
             logger.info('Worker stopped');
             process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        logger.error({ error }, 'Failed to start worker');
        process.exit(1);
    }
}

startWorker();
