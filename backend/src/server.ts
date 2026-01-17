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
import webhookRoutes from './routes/webhook.routes';
import { errorHandler } from './middleware/error.middleware';
import { SchedulerService } from './services/scheduler.service';
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
const prisma = new PrismaClient();
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
