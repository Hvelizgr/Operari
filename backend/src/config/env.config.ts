import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().transform(Number).default('4001'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    REDIS_URL: z.string().url().optional(),

    // AI Agent System
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    AI_MODEL_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
    AI_MODEL_NAME: z.string().default('claude-sonnet-4-6'),

    // OAuth / Connected Accounts
    ENCRYPTION_KEY: z.string().min(32).optional(),

    // Self-host: allow anonymous access (no auth required).
    // Set to "true" ONLY for single-tenant self-host deployments.
    NANORUN_ANONYMOUS_MODE: z.enum(['true', 'false']).default('false'),
    GMAIL_CLIENT_ID: z.string().optional(),
    GMAIL_CLIENT_SECRET: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    // Empty-string tolerant because docker-compose interpolation of an
    // unset host var yields "" (not undefined), which would otherwise
    // fail .url() validation and crash boot on a fresh self-host.
    OAUTH_REDIRECT_BASE_URL: z
        .preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),

    // Social login providers. Both are optional — when the pair is
    // unset the /api/auth/{provider} route returns 501 and the
    // frontend hides the corresponding "Continue with …" button via
    // NEXT_PUBLIC_OAUTH_* flags (see frontend env). Create apps at:
    //   Google: https://console.cloud.google.com/apis/credentials
    //   GitHub: https://github.com/settings/developers
    // Redirect URIs (use your OAUTH_REDIRECT_BASE_URL or localhost in dev):
    //   {base}/api/auth/google/callback
    //   {base}/api/auth/github/callback
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // Forces the HttpOnly session cookie's Secure flag. Leave unset to
    // let the cookie code auto-detect the request protocol (right for
    // local HTTP + prod HTTPS in most setups). Set explicitly to
    // `true` when serving over HTTPS behind a proxy that does not pass
    // X-Forwarded-Proto.
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),

    // Sentry error + perf observability. Optional in every
    // environment — self-host deployments leave DSN unset and the
    // SDK is never initialized. When DSN is set, traces_sample_rate
    // defaults to 0.1 (10%) because full sampling drops prod cost
    // faster than it helps debug. SENTRY_ENV differentiates
    // staging/prod in the Sentry UI without forcing NODE_ENV
    // assumptions.
    SENTRY_DSN: z
        .preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    SENTRY_ENV: z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z
        .string()
        .transform(Number)
        .pipe(z.number().min(0).max(1))
        .default('0.1'),
    /// Release tag surfaced in Sentry for "which build started
    /// throwing". Populated by CI from the git sha; falls back to
    /// a literal when the env var is empty so events still group.
    APP_VERSION: z.string().default('dev'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 4));
    process.exit(1);
}

export const env = parsedEnv.data;
