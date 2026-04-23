import './config/tracing.config'; // Initialize tracing first
import './config/env.config'; // Validate env vars first

// Sentry MUST be initialized BEFORE express is imported by any code
// that gets wrapped by the SDK. Tracing + env already ran above; we
// init Sentry here so the http instrumentation hooks bind to fresh
// require() calls.
import {
  flushSentry,
  initSentry,
  installExpressErrorHandler,
  installProcessHandlers,
} from './config/sentry.config';
initSentry();
installProcessHandlers();
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
// Swagger Documentation
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.config';
import { logger } from './config/logger.config';
import { swaggerSpec } from './config/swagger.config';
import { csrfProtection } from './middleware/csrf.middleware';
import { errorHandler } from './middleware/error.middleware';
import { addUserContext, requestLogger } from './middleware/logger.middleware';
import {
  authRateLimiter,
  cleanupRateLimiters,
  executionRateLimiter,
  loginEmailRateLimiter,
  standardRateLimiter,
  webhookRateLimiter,
} from './middleware/ratelimit.middleware';
import adminRoutes from './routes/admin.routes';
import approvalRoutes from './routes/approvals.routes';
import authRoutes from './routes/auth.routes';
import billingRoutes from './routes/billing.routes';
import chatRoutes from './routes/chat.routes';
import connectedAccountRoutes from './routes/connected-accounts.routes';
import contactRoutes from './routes/contact.routes';
import dashboardRoutes from './routes/dashboard.routes';
import eventAgentsRoutes from './routes/event-agents.routes';
import eventsRoutes from './routes/events.routes';
import executionRoutes from './routes/execution.routes';
import githubExplorerRoutes from './routes/github-explorer.routes';
import invitesRoutes from './routes/invites.routes';
import monitorsRoutes from './routes/monitors.routes';
import nodeTypesRoutes from './routes/node-types.routes'; // Added import
import oauthRoutes from './routes/oauth.routes';
import runbookRoutes from './routes/runbook.routes';
import runbookAssistRoutes from './routes/runbook-assist.routes';
import runRoutes from './routes/runs.routes';
import schedulesRoutes from './routes/schedules.routes';
import sqlRoutes from './routes/sql.routes';
import templatesRoutes from './routes/templates.routes';
import tenantsRoutes from './routes/tenants.routes';
import v1ApprovalRoutes from './routes/v1/approvals.routes';
import v1AuditRoutes from './routes/v1/audit.routes';
import v1KeyRoutes from './routes/v1/keys.routes';
import v1RunbookRoutes from './routes/v1/runbooks.routes';
import v1RunRoutes from './routes/v1/runs.routes';
import v1WebhookRoutes from './routes/v1/webhooks.routes';
import webhookRoutes from './routes/webhook.routes';
import webhooksAdminRoutes from './routes/webhooks-admin.routes';
import runbookJsonSchema from './runbook/yaml/runbook.schema.json';
import { MonitorService } from './services/monitor.service';
import { SchedulerService } from './services/scheduler.service';
import { SchedulerLeader } from './services/scheduler-leader';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const PORT = env.PORT;

import { socketService } from './editor/execution/socket.service';
socketService.initialize(httpServer, env.FRONTEND_URL);

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
// Capture the raw body so webhook routes can verify HMAC against the
// exact bytes the sender signed. Re-serializing req.body via
// JSON.stringify() does NOT preserve byte-for-byte the original
// payload (key ordering, whitespace, number precision can all
// differ), which is the canonical webhook security bug.
// See backend/src/routes/webhook.routes.ts for the consumer.
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use(cookieParser());

app.use(requestLogger);
app.use(addUserContext);

// Double-submit CSRF guard. No-op when CSRF_ENFORCE is unset so
// self-host / first deploys pay zero cost; flip the env to
// "observe" to log mismatches without blocking, then "enforce" once
// telemetry is clean. Exempt paths (/api/v1/*, /webhook/*, probes)
// and Bearer-authenticated requests are handled inside the
// middleware so we can mount it globally here.
app.use(csrfProtection());

// Per-email login rate limit stacks on top of the IP-based auth limit
// so distributed credential stuffing against one account still gets
// blocked. Only the /login POST sees it — every other auth route
// falls through.
app.use('/api/auth/login', loginEmailRateLimiter);
app.use('/api/auth', authRateLimiter, authRoutes);
// OAuth routes live under /api/auth/:provider but are intentionally
// mounted AFTER /api/auth so the password register/login paths take
// precedence. The OAuth router owns dynamic `:provider` + `:provider/callback`
// and does its own 501 when the provider is not configured.
app.use('/api/auth', oauthRoutes);
app.use('/api/billing', standardRateLimiter, billingRoutes);
app.use('/api/invites', standardRateLimiter, invitesRoutes);
app.use('/api/tenants', standardRateLimiter, tenantsRoutes);
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
app.use('/api/dashboard', standardRateLimiter, dashboardRoutes);
app.use('/api/event-agents', standardRateLimiter, eventAgentsRoutes);
app.use('/api/schedules', standardRateLimiter, schedulesRoutes);
app.use('/api/templates', standardRateLimiter, templatesRoutes);
app.use('/api/monitors', standardRateLimiter, monitorsRoutes);
app.use('/api/events', standardRateLimiter, eventsRoutes);
app.use('/api/admin', standardRateLimiter, adminRoutes);
app.use('/api/sql', standardRateLimiter, sqlRoutes);
app.use('/api/github', standardRateLimiter, githubExplorerRoutes);
app.use('/api/contact', standardRateLimiter, contactRoutes);

// NanoRun API v1 (SDK & CLI)
app.use('/api/v1/runbooks', executionRateLimiter, v1RunbookRoutes);
app.use('/api/v1/runs', standardRateLimiter, v1RunRoutes);
app.use('/api/v1/keys', standardRateLimiter, v1KeyRoutes);
app.use('/api/v1/webhooks', standardRateLimiter, v1WebhookRoutes);
app.use('/api/v1/audit', standardRateLimiter, v1AuditRoutes);
app.use('/api/v1/approvals', standardRateLimiter, v1ApprovalRoutes);

/**
 * Liveness probe — pure "the process is responsive".
 *
 * Never touches downstream dependencies. A Kubernetes liveness probe
 * failure triggers a restart; we only want that when the process
 * itself is wedged (infinite loop, heap exhaustion), not when
 * postgres is down. Uptime monitors that just want the simplest
 * "is it up?" signal should hit this endpoint, not /health.
 *
 * Kept in the router chain so rate limiters explicitly skip it
 * (see logger.middleware + ratelimit.middleware path checks).
 */
app.get('/live', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? process.env.NANORUN_VERSION ?? '0.1.0-dev',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

/**
 * Readiness probe.
 *
 * Verifies the two stateful dependencies (postgres + redis) so a
 * docker-compose `healthcheck:` block or a k8s readiness probe can
 * actually distinguish "the process is up" from "the process is up
 * AND can talk to its dependencies". Both checks are wrapped in a
 * 1.5s timeout so a stuck connection does not stall the probe.
 *
 * Named `/health` for legacy compatibility (everything from CI to
 * our own uptime config already points here). The behavior is
 * readiness-shaped: a DB outage returns 503 so load balancers can
 * route around the instance.
 */
app.get('/health', async (_req, res) => {
  const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  };

  let postgres: 'ok' | 'error' = 'ok';
  let postgresError: string | undefined;
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500);
  } catch (err) {
    postgres = 'error';
    postgresError = err instanceof Error ? err.message : 'unknown';
  }

  // Redis is optional in self-host (LogStreamService is no-op when
  // not configured) so we report status separately and never fail
  // the overall probe on redis alone.
  let redis: 'ok' | 'error' | 'disabled' = 'disabled';
  let redisError: string | undefined;
  try {
    const { redisConfig } = await import('./config/redis.config');
    const client = redisConfig.getClient();
    if (client) {
      await withTimeout(client.ping(), 1500);
      redis = 'ok';
    }
  } catch (err) {
    redis = 'error';
    redisError = err instanceof Error ? err.message : 'unknown';
  }

  const overall: 'ok' | 'degraded' = postgres === 'ok' ? 'ok' : 'degraded';
  res.status(overall === 'ok' ? 200 : 503).json({
    status: overall,
    timestamp: new Date().toISOString(),
    // Prefer APP_VERSION (same value Sentry uses for release tagging)
    // so one tag correlates uptime pings with error groups. Falls
    // back to NANORUN_VERSION for legacy compose files.
    version: process.env.APP_VERSION ?? process.env.NANORUN_VERSION ?? '0.1.0-dev',
    uptimeSeconds: Math.round(process.uptime()),
    deps: {
      postgres: { status: postgres, ...(postgresError && { error: postgresError }) },
      redis: { status: redis, ...(redisError && { error: redisError }) },
    },
  });
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

// Sentry error middleware must land BEFORE the app's custom
// `errorHandler` so the exception reaches Sentry first (preserving
// the request scope) and `errorHandler` still formats the wire
// response. No-op when SENTRY_DSN is not configured.
installExpressErrorHandler(app);
app.use(errorHandler);

const scheduler = new SchedulerService(prisma);
// Coordinator that ensures only one pod runs the scheduler at a time.
// Constructed here (not in main) so SIGINT can always stop() it without
// racing against server startup.
const schedulerLeader: SchedulerLeader | null =
  env.SCHEDULER_LEADER_DISABLE === 'true'
    ? null
    : new SchedulerLeader({
        onAcquire: async () => {
          await scheduler.start();
        },
        onLose: async () => {
          // Connection to the advisory-lock session dropped. Stop the
          // local cron tasks so another pod that takes over does not
          // race with them. Re-acquisition will re-start them.
          scheduler.stop();
        },
      });
export { scheduler };

async function main() {
  try {
    // Startup security checks
    if (!env.ENCRYPTION_KEY) {
      logger.warn(
        '⚠️  ENCRYPTION_KEY is not set. Connected accounts and secrets will use an insecure default key. ' +
          'Set ENCRYPTION_KEY to a random 64-char hex string for production use.'
      );
    } else if (env.ENCRYPTION_KEY === '0'.repeat(64) || env.ENCRYPTION_KEY === '0'.repeat(32)) {
      logger.warn(
        '⚠️  ENCRYPTION_KEY is set to a known default value. ' +
          "Generate a random key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }

    if (env.NANORUN_ANONYMOUS_MODE === 'true') {
      logger.warn(
        '⚠️  NANORUN_ANONYMOUS_MODE=true — all API routes allow unauthenticated access. ' +
          'Only use this for single-tenant self-host deployments.'
      );
    }

    await prisma.$connect();
    logger.info('Database connected');

    if (schedulerLeader) {
      await schedulerLeader.start();
      logger.info(
        { isLeader: schedulerLeader.isLeader() },
        schedulerLeader.isLeader()
          ? 'Scheduler started (leader)'
          : 'Scheduler standing by (follower — will take over if leader dies)'
      );
    } else {
      await scheduler.start();
      logger.warn(
        'Scheduler started without leader election (SCHEDULER_LEADER_DISABLE=true). ' +
          'Safe only for single-pod deployments.'
      );
    }

    // Monitor watchdog: 1-minute polling worker. Kept dead simple
    // (setInterval) — monitors are not on a hot path. The worker
    // also runs once at startup so the UI shows fresh status without
    // a 1-minute lag after a restart.
    const monitorService = new MonitorService(prisma);
    monitorService.evaluateAll().catch(err => {
      logger.error({ err }, 'Initial monitor sweep failed');
    });
    const monitorInterval = setInterval(() => {
      monitorService.evaluateAll().catch(err => {
        logger.error({ err }, 'Monitor sweep failed');
      });
    }, 60_000);
    process.on('SIGTERM', () => clearInterval(monitorInterval));
    logger.info('Monitor watchdog started (1-minute interval)');

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
          'Resume worker scan complete'
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
  if (schedulerLeader) {
    await schedulerLeader.stop();
  }
  cleanupRateLimiters();
  await prisma.$disconnect();
  // Flush pending Sentry events. 2s timeout is short enough that a
  // kill -9 during a long flush never deadlocks the pod, and long
  // enough that the last few events from whatever crashed the
  // process usually make it through.
  await flushSentry(2000);
  logger.info('Server stopped');
  process.exit(0);
});

main();

export { prisma };
