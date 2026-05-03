/**
 * Next.js instrumentation hook — fires once per server start (per
 * runtime). Forwards to the right Sentry config so server / edge
 * errors propagate to the same dashboard as the browser SDK.
 *
 * Without this hook, the `sentry.{server,edge}.config.ts` files would
 * never load and server-side throws would silently disappear.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Re-export the request-error hook so Next.js' uncaught request
// errors bubble through to the Sentry SDK rather than disappearing
// into the framework's logger.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
