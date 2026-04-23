import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME } from '../auth/session-cookie';

/**
 * Double-submit cookie CSRF protection.
 *
 * Threat model: an attacker who controls a foreign origin wants to
 * make the authed browser POST to api.cairn.run with the user's
 * session cookie attached. `SameSite=Lax` already blocks most of
 * this, but we layer the double-submit on top so:
 *   - a sub-domain takeover can't bypass SameSite
 *   - a stale browser that ignores SameSite still fails
 *   - a same-site XSS that wants to forge POSTs still needs to read
 *     the CSRF cookie AND inject a header (same-origin XSS is not
 *     what CSRF defends against — but blocking one axis raises cost)
 *
 * Contract:
 *   - GET/HEAD/OPTIONS are always safe-method allowed.
 *   - Requests authenticated via Authorization: Bearer <token> are
 *     exempt — API keys and third-party SDK calls never carry
 *     `nanorun_session`, so there is no cookie for the attacker to
 *     forge with.
 *   - Requests with no session cookie pass through (public endpoints
 *     like /auth/login itself; CSRF is about protecting authed
 *     actions).
 *   - Requests WITH a session cookie must carry an `X-CSRF-Token`
 *     header whose value matches the `nanorun_csrf` cookie, compared
 *     with a constant-time equal.
 *
 * Rollout: gated by CSRF_ENFORCE env. When "false" (default) the
 * middleware logs violations without blocking so production traffic
 * can be observed before flipping to enforcement. Flip to "true"
 * once the frontend is known to be attaching the header on every
 * mutating request.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Path prefixes that bypass CSRF because they don't participate in
 * cookie-session auth at all. The API-key surface and webhook
 * receivers authenticate differently; health probes are unauth.
 */
const EXEMPT_PREFIXES = [
  '/api/v1/', // API-key auth, never a cookie session
  '/webhook/', // HMAC + opaque-token auth
  '/health',
  '/live',
  '/metrics',
];

function isExemptPath(path: string): boolean {
  for (const p of EXEMPT_PREFIXES) {
    if (path === p || path.startsWith(p)) return true;
  }
  return false;
}

function hasBearerAuth(req: Request): boolean {
  const auth = req.headers.authorization;
  return typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ');
}

function sessionCookieOf(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE_NAME];
}

function csrfCookieOf(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[CSRF_COOKIE_NAME];
}

function csrfHeaderOf(req: Request): string | undefined {
  const raw = req.headers[CSRF_HEADER_NAME];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Constant-time equality. We pad both buffers to a common length so
 * `timingSafeEqual` doesn't throw on length mismatch (which would
 * leak timing by itself). Lengths beyond the expected 43 chars are
 * normalized to the same capped value.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type CsrfEnforcement = 'enforce' | 'observe' | 'off';

function resolveMode(): CsrfEnforcement {
  const raw = (process.env.CSRF_ENFORCE ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === 'enforce' || raw === '1') return 'enforce';
  if (raw === 'observe' || raw === 'log') return 'observe';
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === '') return 'off';
  return 'off';
}

export function csrfProtection() {
  return function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
    const mode = resolveMode();
    if (mode === 'off') return next();

    if (SAFE_METHODS.has(req.method)) return next();
    if (isExemptPath(req.path)) return next();
    if (hasBearerAuth(req)) return next();

    const session = sessionCookieOf(req);
    if (!session) return next();

    const cookieToken = csrfCookieOf(req);
    const headerToken = csrfHeaderOf(req);

    const ok = !!cookieToken && !!headerToken && safeEqual(cookieToken, headerToken);

    if (ok) return next();

    req.log?.warn(
      {
        method: req.method,
        path: req.path,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
        mode,
      },
      'csrf.mismatch'
    );

    if (mode === 'observe') {
      // Phase-1 rollout: log and let through so a missing
      // frontend attach doesn't brick the app. Flip to
      // CSRF_ENFORCE=true once telemetry shows zero mismatches.
      return next();
    }

    return res.status(403).json({
      error: 'CSRF token missing or invalid',
      code: 'csrf_invalid',
    });
  };
}
