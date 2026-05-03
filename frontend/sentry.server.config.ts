import * as Sentry from '@sentry/nextjs';

/**
 * Sprint 4 — Sentry server-side instrumentation for the Next.js
 * runtime (RSC, route handlers, middleware). DSN-gated so installs
 * without `NEXT_PUBLIC_SENTRY_DSN` pay zero overhead.
 *
 * Mirrors the client config (`lib/sentry/init.ts`) — same release /
 * environment tags, same low trace sample rate. The actual error
 * forwarding happens automatically via Next.js' built-in instrumen-
 * tation hook (`instrumentation.ts`) once this file exists.
 *
 * Source map upload + AuthProvider user-context still come later;
 * those need build-side config + a logged-in tree to bind off.
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
