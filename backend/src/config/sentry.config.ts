import * as Sentry from '@sentry/node';

/**
 * Sentry bootstrap.
 *
 * Design rules:
 *   - **No-op by default.** If `SENTRY_DSN` is not set we never call
 *     `Sentry.init`, never attach handlers, never phone home. Every
 *     public entry point in this module checks `isEnabled()` first
 *     so self-host deployments pay zero runtime cost and zero
 *     network calls.
 *   - **Init must run before the rest of the app.** The Sentry docs
 *     require `Sentry.init()` to happen before any code that should
 *     be instrumented — including requires of express, pg, etc.
 *     `server.ts` imports this module on line 1 for that reason.
 *   - **PII scrubbing.** `sendDefaultPii: false` keeps request
 *     cookies, headers with `authorization`, and request bodies out
 *     of events; `beforeSend` strips anything else we recognize
 *     (stripe signatures, bcrypt hashes in stack traces, etc.).
 *   - **Release tag.** `release` comes from APP_VERSION so a bad
 *     deploy is grepable by commit sha in Sentry's Releases view.
 */

let _enabled = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1');
  const environment = process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? 'development';
  const release = process.env.APP_VERSION ?? 'dev';

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    sendDefaultPii: false,
    // Don't ship sensitive request data to Sentry. We still get
    // the URL, method, status, and headers minus auth — plenty to
    // triage without shipping a cookie jar to a third party.
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },
  });

  _enabled = true;
}

/**
 * True once `Sentry.init` has been called. Wires and shutdown hooks
 * check this so we never touch the SDK when it was skipped — calling
 * `Sentry.setupExpressErrorHandler(app)` without init is a loud
 * no-op, but the process handlers would happily swallow errors into
 * the void.
 */
export function isSentryEnabled(): boolean {
  return _enabled;
}

/**
 * Attach the Express error-capture middleware. Must run AFTER all
 * routes and BEFORE the app's own error handler so Sentry sees the
 * error first and the handler still formats the response.
 */
export function installExpressErrorHandler(app: import('express').Express): void {
  if (!_enabled) return;
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Process-level safety net for async errors Express never sees —
 * unhandled promise rejections inside a setTimeout, inside the
 * scheduler, inside a websocket callback, etc. Exposing it as a
 * named function keeps the server bootstrap readable.
 */
export function installProcessHandlers(): void {
  if (!_enabled) return;
  process.on('uncaughtException', err => {
    Sentry.captureException(err);
  });
  process.on('unhandledRejection', reason => {
    Sentry.captureException(reason);
  });
}

/**
 * Flush pending events. Called from the SIGINT / SIGTERM handlers so
 * a shutting-down pod still delivers the last few errors. Bounded
 * by a 2s timeout — we would rather lose a few trailing events than
 * block container shutdown for 30s during a deploy.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!_enabled) return;
  try {
    await Sentry.close(timeoutMs);
  } catch {
    /* never block shutdown on Sentry */
  }
}

/**
 * Explicit capture for code paths that catch and swallow errors but
 * still want Sentry to see them (e.g. ExecutionService's per-step
 * try/catch). Auto-tags the event so filtering by runbook/step in
 * the Sentry UI is one click.
 */
export function captureError(err: unknown, context: Record<string, unknown> = {}): void {
  if (!_enabled) return;
  Sentry.withScope(scope => {
    for (const [k, v] of Object.entries(context)) {
      scope.setTag(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    Sentry.captureException(err);
  });
}

// ─────────────────────────────────────────────────────────────
// Scrubbing
// ─────────────────────────────────────────────────────────────

const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-webhook-signature',
  'x-hub-signature-256',
  'x-stripe-signature',
]);

const REDACTED_BODY_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'token',
  'secret',
  'totpcode',
  'apikey',
]);

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    event.request = scrubRequest(event.request);
  }
  return event;
}

function scrubBreadcrumb(b: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (b.data && typeof b.data === 'object') {
    b.data = scrubObject(b.data as Record<string, unknown>);
  }
  return b;
}

function scrubRequest(req: Sentry.Request): Sentry.Request {
  if (req.headers) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      out[k] = REDACTED_HEADERS.has(k.toLowerCase()) ? '<redacted>' : String(v);
    }
    req.headers = out;
  }
  if (req.data && typeof req.data === 'object') {
    req.data = scrubObject(req.data as Record<string, unknown>);
  }
  return req;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED_BODY_KEYS.has(k.toLowerCase())) {
      out[k] = '<redacted>';
      continue;
    }
    out[k] = v;
  }
  return out;
}
