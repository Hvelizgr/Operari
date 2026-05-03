import * as Sentry from '@sentry/nextjs';

/**
 * Sentry config for the Next.js edge runtime (middleware + edge route
 * handlers). DSN-gated. Kept narrow — the edge runtime has no Node
 * APIs so we skip the heavier integrations.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_OPERARI_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_OPERARI_VERSION,
    tracesSampleRate: 0.1,
  });
}
