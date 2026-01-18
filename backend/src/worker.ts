import './config/env.config'; // Load env vars
import { prisma } from './config/database';
import { QueueService } from './scaling/queue.service';
import { logger } from './config/logger.config';
import { NodeLoaderService } from './services/node-loader.service';

import { PluginManager } from './plugins/PluginManager';

async function startWorker() {
    try {
        logger.info('Starting NanoFlow Job Worker...');

        // Connect to Database
        await prisma.$connect();
        logger.info('Database connected');

        // Initialize Dynamic Node Loader (Legacy)
        await NodeLoaderService.getInstance().initialize();

        // Initialize Plugin System (Phase 4)
        const pluginManager = new PluginManager(process.env.PLUGINS_DIR || './plugins');
        await pluginManager.loadPlugins();
        logger.info(`Initialized Plugin System. Loaded ${pluginManager.getAllPlugins().length} plugins.`);

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
