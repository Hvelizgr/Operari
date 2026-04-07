import './config/tracing.config'; // Initialize tracing first
import './config/env.config'; // Validate env vars first
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.config';

import authRoutes from './routes/auth.routes';
import runbookRoutes from './routes/runbook.routes';
import executionRoutes from './routes/execution.routes';
import nodeTypesRoutes from './routes/node-types.routes'; // Added import
import webhookRoutes from './routes/webhook.routes';
import chatRoutes from './routes/chat.routes';
import v1RunbookRoutes from './routes/v1/runbooks.routes';
import v1RunRoutes from './routes/v1/runs.routes';
import v1KeyRoutes from './routes/v1/keys.routes';
import v1WebhookRoutes from './routes/v1/webhooks.routes';
import v1AuditRoutes from './routes/v1/audit.routes';
import v1ApprovalRoutes from './routes/v1/approvals.routes';
import approvalRoutes from './routes/approvals.routes';
import runRoutes from './routes/runs.routes';
import connectedAccountRoutes from './routes/connected-accounts.routes';
import runbookAssistRoutes from './routes/runbook-assist.routes';
import webhooksAdminRoutes from './routes/webhooks-admin.routes';
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
import runbookJsonSchema from './runbook/yaml/runbook.schema.json';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const PORT = env.PORT;

import { socketService } from './editor/execution/socket.service';
socketService.initialize(httpServer, env.FRONTEND_URL);

app.use(helmet());
app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
}));
// Capture the raw body so webhook routes can verify HMAC against the
// exact bytes the sender signed. Re-serializing req.body via
// JSON.stringify() does NOT preserve byte-for-byte the original
// payload (key ordering, whitespace, number precision can all
// differ), which is the canonical webhook security bug.
// See backend/src/routes/webhook.routes.ts for the consumer.
app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
}));

app.use(requestLogger);
app.use(addUserContext);

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/executions', executionRateLimiter, executionRoutes);
app.use('/api/runbooks', standardRateLimiter, runbookRoutes);
app.use('/api/node-types', standardRateLimiter, nodeTypesRoutes);
app.use('/webhook', webhookRateLimiter, webhookRoutes);
app.use('/api/chat', standardRateLimiter, chatRoutes);
app.use('/api/approvals', standardRateLimiter, approvalRoutes);
app.use('/api/runs', standardRateLimiter, runRoutes);
app.use('/api/connected-accounts', standardRateLimiter, connectedAccountRoutes);
app.use('/api/runbook-assist', standardRateLimiter, runbookAssistRoutes);
app.use('/api/webhooks', standardRateLimiter, webhooksAdminRoutes);

// NanoRun API v1 (SDK & CLI)
app.use('/api/v1/runbooks', executionRateLimiter, v1RunbookRoutes);
app.use('/api/v1/runs', standardRateLimiter, v1RunRoutes);
app.use('/api/v1/keys', standardRateLimiter, v1KeyRoutes);
app.use('/api/v1/webhooks', standardRateLimiter, v1WebhookRoutes);
app.use('/api/v1/audit', standardRateLimiter, v1AuditRoutes);
app.use('/api/v1/approvals', standardRateLimiter, v1ApprovalRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Canonical RunbookSpec JSON Schema. Served at the root so VS Code's
// yaml extension can pick it up via a stable URL — point yaml.schemas
// at this endpoint and every *.runbook.yaml file gets autocomplete +
// inline diagnostics. Also consumed by the CLI for `nanorun lint`
// and (eventually) by the editor for save-time validation.
//
// The file is checked into the repo at backend/src/runbook/yaml/runbook.schema.json
// so it can be served statically without a build step. The require()
// pattern matches how swaggerSpec is loaded above.
app.get('/runbook.schema.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/schema+json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(runbookJsonSchema);
});

app.use(errorHandler);

const scheduler = new SchedulerService(prisma);

async function main() {
    try {
        await prisma.$connect();
        logger.info('Database connected');

        scheduler.start();
        logger.info('Scheduler started');

        // ADR 0003 phase 3: scan for runs that were in flight when the
        // previous backend instance died and abandon them so they stop
        // showing up in dashboards. Behind two flags:
        //   NANORUN_DURABLE_ENGINE=true   → engine is wired in general
        //   NANORUN_RESUME_WORKER_ACT=true → act on decisions, not just dryRun
        // Default: dryRun=true so a fresh deploy logs the report and the
        // operator confirms it before letting the worker mutate.
        if (process.env.NANORUN_DURABLE_ENGINE === 'true') {
            try {
                const { ExecutionEventStore } = await import('./runbook/engine/execution-event.store');
                const { ResumeWorker } = await import('./runbook/engine/resume-worker');
                const { Logger } = await import('./services/logger.service');
                const eventStore = new ExecutionEventStore(prisma);
                const worker = new ResumeWorker(eventStore, Logger.getInstance());
                const dryRun = process.env.NANORUN_RESUME_WORKER_ACT !== 'true';
                const report = await worker.runOnce({ dryRun });
                logger.info(
                    {
                        scannedTenants: report.scannedTenants,
                        scannedRuns: report.scannedRuns,
                        abandoned: report.counts.ABANDON,
                        skipped: report.counts.SKIP,
                        wouldResume: report.counts.RESUME,
                        dryRun: report.dryRun,
                        durationMs: report.durationMs,
                    },
                    'Resume worker scan complete',
                );
            } catch (workerErr) {
                // Worker failure must NEVER block server startup. Log and
                // proceed; the next deploy can re-run the scan.
                logger.error({ err: workerErr }, 'Resume worker scan failed');
            }
        }

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
