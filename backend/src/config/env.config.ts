import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Central env-var schema.
 *
 * Every `process.env.X` the backend reads is declared here. Adding a
 * new env var anywhere in the code without touching this file breaks
 * boot — that's intentional: we fail loud the first time `parseEnv()`
 * runs so a typo or a missing deploy secret surfaces immediately
 * instead of blowing up a user request three hours later.
 *
 * The parsed result is re-exported as both `env` (the historical name
 * many modules import) and `config` (the alias new code should prefer)
 * so a future sweep can migrate call sites without a flag day.
 *
 * Optional-by-default: everything not already required stays optional
 * so self-host deploys that don't care about Stripe/WorkOS/Sentry can
 * boot without setting those secrets. Required vars (DATABASE_URL,
 * JWT_SECRET) fail loudly with a clear message.
 */

/** URL that may be absent OR an empty string (docker-compose frequently
 *  interpolates an unset host var to ""). Treats empty as undefined. */
const optionalUrl = z.preprocess(v => (v === '' ? undefined : v), z.string().url().optional());

/** Positive integer parsed from an env string. `fallback` applies when
 *  the var is unset. Clamp with `.min()` if the caller cares. */
const intFromString = (fallback: number) =>
  z.preprocess(v => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
  }, z.number().int());

const envSchema = z.object({
  // ─── Core runtime ──────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('4001'),
  APP_VERSION: z.string().default('dev'),
  APP_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ─── Persistence ───────────────────────────────────────────────
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  // ─── Auth ──────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  CSRF_ENFORCE: z.enum(['true', 'false']).optional(),
  OPERARI_ANONYMOUS_MODE: z.enum(['true', 'false']).default('false'),
  /**
   * Enables POST /api/auth/dev-login — an unauthenticated endpoint that
   * mints a real session for a fixed dev user (auto-created on first
   * call). Use ONLY for local development. The endpoint returns 404
   * when this flag is anything other than "true". Must NEVER be true
   * in any deployment that handles real tenants.
   */
  OPERARI_DEV_LOGIN_ENABLED: z.enum(['true', 'false']).default('false'),
  OPERARI_AUTH_PROVIDER: z.enum(['jwt', 'workos']).default('jwt'),
  OPERARI_PASSWORD_BREACH_CHECK: z.enum(['true', 'false']).default('true'),
  OPERARI_PASSWORD_BREACH_THRESHOLD: intFromString(1),
  OPERARI_SECRET_KEY: z.string().optional(),
  /** Legacy master keys accepted during a KeyRotationJob window.
   *  Comma-separated, newest legacy first. The runtime decrypts rows
   *  ciphered under any of these (tried in order after the primary
   *  OPERARI_SECRET_KEY fails) and re-encrypts them under the primary
   *  key. Once the rotation completes, drop this env var on the next
   *  deploy. */
  OPERARI_SECRET_KEY_LEGACY: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),

  // ─── Frontend linkage ──────────────────────────────────────────
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  OAUTH_REDIRECT_BASE_URL: optionalUrl,

  // ─── AI agent ──────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  AI_MODEL_NAME: z.string().default('claude-sonnet-4-6'),
  /** Feature flag that enables write-capable agent tools (create/update
   *  runbook, dispatch runs, modify RBAC). Off by default — the audit
   *  surface for write tools is still being shaped. */
  OPERARI_AGENT_WRITE_TOOLS: z.enum(['true', 'false']).default('false'),

  // ─── Social login providers ────────────────────────────────────
  // All optional — when a pair is unset, /api/auth/{provider} returns
  // 501 and the frontend hides the button.
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // ─── WorkOS SSO (cloud tier) ───────────────────────────────────
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_ISSUER: z.string().optional(),
  WORKOS_JWKS_URL: z.string().optional(),

  // ─── Billing (Stripe) ──────────────────────────────────────────
  OPERARI_BILLING_PROVIDER: z.enum(['stripe', 'none']).default('none'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OPERARI_QUOTA_FREE_RUNS: intFromString(100),
  OPERARI_QUOTA_FREE_RUNBOOKS: intFromString(3),

  // ─── Email (SMTP + Resend) ─────────────────────────────────────
  // Two providers supported — SMTP for self-host, Resend for cloud.
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: intFromString(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  CONTACT_FROM_EMAIL: z.string().optional(),
  CONTACT_TO_EMAIL: z.string().optional(),

  // ─── Sentry ────────────────────────────────────────────────────
  SENTRY_DSN: optionalUrl,
  SENTRY_ENV: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0).max(1))
    .default('0.1'),

  // ─── OpenTelemetry tracing ─────────────────────────────────────
  ENABLE_TRACING: z.enum(['true', 'false']).default('false'),
  JAEGER_ENDPOINT: z.string().url().optional(),

  // ─── Execution engine ──────────────────────────────────────────
  /** Toggles the durable (Redis-backed) runbook event store. When
   *  off, executions use the in-memory store — lost on process
   *  restart, fine for dev + single-tenant self-host. */
  OPERARI_DURABLE_ENGINE: z.enum(['true', 'false']).default('false'),
  /** Cap on live log-stream entries per step kept in memory. */
  OPERARI_LOG_STREAM_MAX_ENTRIES: intFromString(1000),
  /** Resume-worker active-action guard — prevents double-resume when
   *  two workers race on the same suspended run. Defaults on. */
  OPERARI_RESUME_WORKER_ACT: z.enum(['true', 'false']).default('true'),
  /** ADR 0003 phase 4. When 'true', the resume worker REPLAYS a
   *  crashed run whose event log shows no step actively executing at
   *  crash time (inFlightSteps empty). Off by default so the phase-3
   *  "abandon interrupted runs" behavior stays in force until an
   *  operator validates their event log is stable. */
  OPERARI_RESUME_WORKER_REPLAY: z.enum(['true', 'false']).default('false'),
  /** Directory the plugin loader scans at boot for third-party step
   *  types (see packages/sdk/src/steps). */
  OPERARI_PLUGINS_DIR: z.string().optional(),
  /** Opt-out for cron scheduler leader election. On by default so
   *  multi-pod deploys do not double-fire scheduled runs. Set to 'true'
   *  only for dev or tests where the dedicated pg connection is
   *  undesirable; single-pod deploys can leave the default — the
   *  advisory lock is acquired instantly when there is no contention. */
  SCHEDULER_LEADER_DISABLE: z.enum(['true', 'false']).default('false'),
  /** Force the tenant-scope guard to throw in production instead of
   *  soft-logging violations. Default 'false' keeps the historical
   *  log-only behavior so a safety-net false positive does not tank
   *  live traffic. Flip to 'true' once prod logs show zero
   *  `Tenant-scope guard violation` entries for two consecutive
   *  weeks — that's the "T.3" validation step from the audit.
   *  Dev/test always throws regardless of this flag. */
  OPERARI_TENANT_GUARD_STRICT: z.enum(['true', 'false']).default('false'),

  // ─── Version display ───────────────────────────────────────────
  /** Self-host build tag shown in the /health endpoint + UI footer.
   *  Separate from APP_VERSION which goes to Sentry release. */
  OPERARI_VERSION: z.string().optional(),
});

/** Silence validation in test runs so CI (or a bare `jest` call)
 *  can boot with the minimum envs declared in the workflow. Tests
 *  that need a specific var should set it explicitly. */
function parseEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(parsed.error.format(), null, 4)
    );
    process.exit(1);
  }
  return parsed.data;
}

/**
 * Parsed, typed environment snapshot. Frozen so a misguided assignment
 * like `env.NODE_ENV = 'production'` throws in dev. The whole point of
 * this module is that env values are read-only after boot.
 *
 * Two names for the same object:
 * - `env`: historical name, still imported by dozens of files.
 * - `config`: the alias new code should prefer. Future migration will
 *    codemod `process.env.X` → `config.X` and then drop the `env` alias.
 */
export const env = Object.freeze(parseEnv());
export const config = env;

/** Exported type so a function signature can accept a subset of the
 *  config without importing the full object. */
export type EnvConfig = typeof env;
