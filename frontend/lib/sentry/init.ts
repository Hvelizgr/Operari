'use client';

import * as Sentry from '@sentry/react';

/**
 * Sprint 4 — Sentry init-only landing.
 *
 * Initialises the client-side Sentry SDK when `NEXT_PUBLIC_SENTRY_DSN`
 * is present in the env. Without that var the call is a no-op so
 * self-hosted / dev installs pay zero runtime cost.
 *
 * What's wired:
 *   - Browser tracing for performance spans (sample rate 0.1).
 *   - Replay on the first error in a session (1 in 10) so on-call
 *     can see what the operator clicked before the crash.
 *   - Release / environment tags from `NEXT_PUBLIC_OPERARI_VERSION`
 *     and `NEXT_PUBLIC_OPERARI_ENV` (defaults to `development`).
 *
 * What's NOT wired in this commit:
 *   - Source map upload at build time (needs the @sentry/nextjs
 *     webpack plugin + auth token; deferred to deploy infra).
 *   - Server-side instrumentation (would need sentry.server.config.ts
 *     at the project root and the @sentry/nextjs `withSentryConfig`
 *     wrapper around next.config.ts).
 *   - User context binding from AuthProvider (next commit).
 *
 * `SurfaceBoundary`'s `onError` already calls `console.error`; we
 * extend that to forward to Sentry so subtree crashes show up in the
 * dashboard alongside top-level errors.
 */

let initialised = false;

export function initSentry() {
  if (initialised) return;
  if (typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_OPERARI_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_OPERARI_VERSION,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  });
  initialised = true;
}

/** Forward an error to Sentry. No-op when the DSN is unset. */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!initialised) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Bind the current user to Sentry's scope so subsequent events carry
 * `user.id` / `user.email` and the dashboard can group reports per
 * operator. Pass `null` on logout to clear the scope so an anonymous
 * crash isn't attributed to the previous user.
 *
 * No-op when the SDK is not initialised (DSN unset → self-host
 * installs without Sentry pay nothing).
 */
export function setSentryUser(user: { id: string; email?: string; username?: string } | null) {
  if (!initialised) return;
  Sentry.setUser(user);
}

/**
 * Tag the active scope with the operator's tenant so reports can be
 * sliced per-workspace. Sentry tags are indexed and searchable in the
 * dashboard, which makes "show me errors for tenant X" trivial.
 */
export function setSentryTenant(tenantId: string | null) {
  if (!initialised) return;
  Sentry.setTag('tenant_id', tenantId);
}
