import './config/tracing.config'; // Initialize tracing first
import './config/env.config'; // Validate env vars first
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.config';

import authRoutes from './routes/auth.routes';
import workflowRoutes from './routes/workflow.routes';
import executionRoutes from './routes/execution.routes';
import analyticsRoutes from './routes/analytics.routes';
import nodeTypesRoutes from './routes/node-types.routes'; // Added import
import templateRoutes from './routes/template.routes';
import webhookRoutes from './routes/webhook.routes';
import credentialRoutes from './routes/credential.routes';
import n8nRoutes from './routes/n8n.routes';
import gitRoutes from './routes/git.routes';
import systemEventRoutes from './routes/system-event.routes';
import alertRoutes from './routes/alert.routes';
import userRoutes from './routes/user.routes';
import aiRoutes from './routes/ai.routes';
import tenantRoutes from './routes/tenant.routes';
import twoFactorRoutes from './routes/two-factor.routes';

import metricRoutes from './routes/metric.routes';
import { errorHandler } from './middleware/error.middleware';
import { SchedulerService } from './services/scheduler.service';
import { QueueService } from './scaling/queue.service';
import { NodeLoaderService } from './services/node-loader.service';
import {
    authRateLimiter,
    executionRateLimiter,
    standardRateLimiter,
    webhookRateLimiter,
    cleanupRateLimiters,
} from './middleware/ratelimit.middleware';
import { requestLogger, addUserContext } from './middleware/logger.middleware';
import { logger } from './config/logger.config';
// Swagger Documentation
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';

const app = express();
const httpServer = createServer(app);
import { prisma } from './config/database';

const PORT = env.PORT;

import { socketService } from './editor/execution/socket.service';
socketService.initialize(httpServer, env.FRONTEND_URL);

app.use(helmet());

// CORS configuration - support multiple origins in development
const corsOrigins = env.NODE_ENV === 'development'
    ? [env.FRONTEND_URL, /^http:\/\/localhost:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/]
    : env.FRONTEND_URL;

app.use(cors({
    origin: corsOrigins,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use(requestLogger);
app.use(addUserContext);

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/executions', executionRateLimiter, executionRoutes);
app.use('/api/workflows', standardRateLimiter, workflowRoutes);
app.use('/api/analytics', standardRateLimiter, analyticsRoutes);
app.use('/api/node-types', standardRateLimiter, nodeTypesRoutes);
app.use('/api/templates', standardRateLimiter, templateRoutes);
app.use('/api/credentials', standardRateLimiter, credentialRoutes);
app.use('/api/n8n', standardRateLimiter, n8nRoutes);
app.use('/api/git', standardRateLimiter, gitRoutes);
app.use('/api/events', standardRateLimiter, systemEventRoutes);
app.use('/api/metrics', standardRateLimiter, metricRoutes);
app.use('/api/alerts', standardRateLimiter, alertRoutes);
app.use('/api/users', standardRateLimiter, userRoutes);
app.use('/api/ai', standardRateLimiter, aiRoutes);
app.use('/api/tenant', standardRateLimiter, tenantRoutes);
app.use('/api/2fa', standardRateLimiter, twoFactorRoutes);
app.use('/webhook', webhookRateLimiter, webhookRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

app.use(errorHandler);

const scheduler = new SchedulerService(prisma);

async function main() {
    try {
        await prisma.$connect();
        logger.info('Database connected');

        scheduler.start();
        logger.info('Scheduler started');

        // Initialize Queue (and Worker if enabled)
        const queueService = QueueService.getInstance();
        if (process.env.ENABLE_WORKER === 'true') {
            queueService.startWorker();
            logger.info('Queue Worker started in API process');
        } else {
            logger.info('Queue initialized (Worker disabled in API)');
        }

        // Initialize Dynamic Node Loader
        await NodeLoaderService.getInstance().initialize();

        httpServer.listen(PORT, () => {
            logger.info({ port: PORT }, `Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error({ error }, 'Failed to start server');
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    scheduler.stop();
    cleanupRateLimiters();
    await prisma.$disconnect();
    logger.info('Server stopped');
    process.exit(0);
});

main();

export { prisma };
