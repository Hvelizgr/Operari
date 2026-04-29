import { Response, Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../audit/audit.service';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { AuthRequest } from '../middleware/auth.middleware';
import { HttpExecutor } from '../runbook/executors/http.executor';
import {
  SecretReferenceError,
  SecretTemplateResolver,
} from '../runbook/secrets/secret-template-resolver';
import { ExecutorContext } from '../runbook/types/executor.types';
import { ConnectedAccountService } from '../security/connected-account.service';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { checkUrlSafe } from '../security/ssrf-guard';
import { prisma } from '../server';

const router = Router();

// Anonymous fallback so a single-tenant self-host with
// OPERARI_ANONYMOUS_MODE=true can use the tester without login,
// matching sql.routes / runbook-assist.routes behaviour.
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

const executeSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
  url: z.string().min(1).max(4096),
  headers: z.record(z.string().max(256), z.string().max(8192)).optional(),
  body: z.string().max(1_000_000).optional(),
  timeoutMs: z.number().int().min(100).max(30_000).optional(),
  followRedirects: z.boolean().optional(),
});

type ExecuteInput = z.infer<typeof executeSchema>;

let secretResolverSingleton: SecretTemplateResolver | null = null;
function getSecretResolver(): SecretTemplateResolver | null {
  if (secretResolverSingleton) return secretResolverSingleton;
  const key = env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    // Without a real encryption key we cannot resolve {{secrets.X}}
    // safely. The route still serves requests that don't reference
    // secrets — the lookup below short-circuits when the resolver is null.
    return null;
  }
  const cipher = new SecretCipher(key);
  const audit = new AuditService(prisma);
  const reader = new SecretReader(cipher, audit);
  const accounts = new ConnectedAccountService(prisma, cipher, reader, audit);
  secretResolverSingleton = new SecretTemplateResolver(accounts);
  return secretResolverSingleton;
}

/**
 * POST /api/http-tester/execute
 *
 * Run an ad-hoc HTTP request from the team-facing playground. NOT a
 * runbook step — no RunHistory row, no Trace span, no NodeLog. The
 * point is to let on-call team members poke endpoints from the same
 * UI shell that runs their runbooks (the SQL editor's HTTP sibling).
 *
 * Auth: same dual-transport pattern as the rest of the web UI surface
 * (cookie or Bearer). Tenant scoping is taken from `req.user.tenantId`,
 * never from the body.
 *
 * SSRF: every URL is screened by `checkUrlSafe` (private IPs, loopback,
 * link-local, cloud metadata). Self-hosts that legitimately need to
 * hit private endpoints can flip OPERARI_HTTP_TESTER_ALLOW_PRIVATE.
 *
 * Secret refs: if the request references {{secrets.<id>}}, the
 * SecretTemplateResolver pre-resolves it and emits one
 * `secret.accessed` audit event per unique reference. We do not open
 * a side-channel — every plaintext read goes through the same audit
 * path the runbook engine uses.
 */
router.post('/execute', async (req: AuthRequest, res: Response) => {
  let body: ExecuteInput;
  try {
    body = executeSchema.parse(req.body ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', details: err.errors });
    }
    throw err;
  }

  const tenantId = req.user!.tenantId;
  const adHocRunId = `http-tester:${req.user!.id}:${Date.now()}`;
  const adHocStepId = 'http-tester';

  // Build the executor's HttpConfig — same shape the runbook engine
  // hands to HttpExecutor, so behaviour is identical to a real step.
  const httpConfig = {
    method: body.method,
    url: body.url,
    headers: body.headers ?? {},
    body: body.body,
    timeout: body.timeoutMs ?? 15_000,
    followRedirects: body.followRedirects ?? true,
    // The runbook engine treats non-2xx as failure; the playground
    // should surface the response intact so the user can inspect a
    // 4xx/5xx without it being marked "failed".
    failOnNon2xx: false,
  };

  // Pre-resolve secrets — emits secret.accessed audit events.
  let secrets: Record<string, string> = {};
  const resolver = getSecretResolver();
  if (resolver) {
    try {
      secrets = await resolver.resolve({
        config: httpConfig,
        tenantId,
        runId: adHocRunId,
        stepId: adHocStepId,
      });
    } catch (err) {
      if (err instanceof SecretReferenceError) {
        return res.status(400).json({
          error: 'Secret reference cannot be resolved',
          message: err.message,
          accountId: err.accountId,
        });
      }
      throw err;
    }
  }

  // Resolve templates in the URL early so the SSRF guard checks the
  // *actual* host the request is going to hit, not a templated one.
  const context: ExecutorContext = {
    runId: adHocRunId,
    stepId: adHocStepId,
    tenantId,
    variables: {},
    previousOutputs: {},
    secrets,
  };
  const resolvedUrl = httpConfig.url.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const segments = path.trim().split('.');
    if (segments[0] === 'secrets' && segments[1] && secrets[segments[1]]) {
      return secrets[segments[1]];
    }
    return '';
  });

  const ssrf = await checkUrlSafe(resolvedUrl);
  if (!ssrf.allowed) {
    return res.status(400).json({
      error: 'URL is not allowed',
      reason: ssrf.reason,
      message: ssrf.message,
    });
  }

  const startTime = Date.now();
  // Construct the executor per-request so it captures the current
  // `globalThis.fetch` binding. The runtime cost is one object alloc
  // per request; the test ergonomics gain is being able to swap the
  // global fetch inside a test without touching this module's load
  // order.
  const executor = new HttpExecutor();
  try {
    const result = await executor.execute(httpConfig, context);
    const durationMs = Date.now() - startTime;

    if (!result.success) {
      // Real network failure (timeout, DNS, connection refused) — not
      // a non-2xx response, since failOnNon2xx is false above.
      return res.status(502).json({
        error: 'Request failed',
        message: result.error ?? 'unknown error',
        durationMs,
      });
    }

    const output = result.output as
      | {
          status: number;
          statusText: string;
          headers: Record<string, string>;
          body: string;
          url: string;
          method: string;
        }
      | undefined;

    return res.json({
      status: output?.status ?? 0,
      statusText: output?.statusText ?? '',
      headers: output?.headers ?? {},
      body: output?.body ?? '',
      url: output?.url ?? resolvedUrl,
      method: output?.method ?? body.method,
      durationMs: result.duration ?? durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, url: resolvedUrl }, 'http-tester request crashed');
    return res.status(500).json({
      error: 'Tester crashed',
      message,
      durationMs: Date.now() - startTime,
    });
  }
});

export default router;

// Exposed for tests so they can swap the resolver singleton.
export const __testHooks = {
  resetSecretResolver: () => {
    secretResolverSingleton = null;
  },
};
