import { randomBytes } from 'crypto';
import { type CookieOptions, type Request, type Response, Router } from 'express';
import jwt from 'jsonwebtoken';

import { AuditService } from '../audit/audit.service';
import {
  buildAuthorizeUrl,
  exchangeCode,
  newState,
  resolveOAuthUser,
} from '../auth/oauth/oauth-service';
import { isProviderConfigured, type OAuthProviderName, PROVIDERS } from '../auth/oauth/providers';
import { setSessionCookie } from '../auth/session-cookie';
import { prisma } from '../server';

const router = Router();

const STATE_COOKIE = 'operari_oauth_state';
const RETURN_COOKIE = 'operari_oauth_return';
const STATE_TTL_MS = 10 * 60 * 1000;

function stateCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure:
      req.secure ||
      req.get('x-forwarded-proto') === 'https' ||
      process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_MS,
  };
}

/**
 * Return URLs we are willing to send the browser after the callback.
 * Must be same-origin to the frontend to prevent open-redirect abuse.
 * Accept only locale-scoped pathnames like `/en/dashboard`.
 */
const SAFE_RETURN_PATH = /^\/(en|es)(\/[\w\-/]*)?$/;

function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && SAFE_RETURN_PATH.test(value) ? value : null;
}

function callbackUrl(req: Request, provider: OAuthProviderName): string {
  // Prefer an explicit configured base (e.g. https://api.operari.dev) so
  // callbacks work behind a TLS terminator. Fall back to the frontend
  // URL since the Next.js dev server rewrites /api/* to us — which
  // means the provider redirects the *browser* to the frontend, and
  // Next proxies the callback back to this route.
  const base =
    process.env.OAUTH_REDIRECT_BASE_URL ||
    process.env.FRONTEND_URL ||
    `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/auth/${provider}/callback`;
}

function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

let auditService: AuditService | null = null;
function getAudit(): AuditService {
  if (!auditService) auditService = new AuditService(prisma);
  return auditService;
}

function isProviderName(value: string): value is OAuthProviderName {
  return value === 'google' || value === 'github';
}

/**
 * GET /api/auth/:provider — initiate the OAuth flow.
 * Sets a short-lived state cookie (CSRF) and optionally a return-path
 * cookie (so we can send the user back to whatever page they were on),
 * then 302s to the provider's authorize URL.
 */
router.get('/:provider', (req: Request, res: Response) => {
  const name = String(req.params.provider);
  if (!isProviderName(name)) {
    return res.status(404).json({ error: 'Unknown provider' });
  }
  if (!isProviderConfigured(name)) {
    return res.status(501).json({ error: `${name} OAuth is not configured on this server` });
  }

  const state = newState();
  const provider = PROVIDERS[name];
  const redirectUri = callbackUrl(req, name);
  const url = buildAuthorizeUrl(provider, redirectUri, state);

  res.cookie(STATE_COOKIE, state, stateCookieOptions(req));
  const requestedReturn = safeReturnPath(req.query.redirect);
  if (requestedReturn) {
    res.cookie(RETURN_COOKIE, requestedReturn, stateCookieOptions(req));
  } else {
    res.clearCookie(RETURN_COOKIE, { path: '/' });
  }

  return res.redirect(url);
});

/**
 * GET /api/auth/:provider/callback — receive the auth code, exchange
 * it for the user profile, upsert the user, set our session cookie,
 * and redirect the browser back into the app.
 */
router.get('/:provider/callback', async (req: Request, res: Response) => {
  const name = String(req.params.provider);
  if (!isProviderName(name)) {
    return res.status(404).json({ error: 'Unknown provider' });
  }
  if (!isProviderConfigured(name)) {
    return res.status(501).json({ error: `${name} OAuth is not configured` });
  }

  const errorParam = typeof req.query.error === 'string' ? req.query.error : null;
  if (errorParam) {
    return res.redirect(`${frontendUrl()}/en/login?error=${encodeURIComponent(errorParam)}`);
  }

  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const stateCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    STATE_COOKIE
  ];
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return res.redirect(`${frontendUrl()}/en/login?error=oauth_state_mismatch`);
  }

  try {
    const provider = PROVIDERS[name];
    const redirectUri = callbackUrl(req, name);
    const profile = await exchangeCode(provider, code, redirectUri);
    if (!profile.email) {
      return res.redirect(`${frontendUrl()}/en/login?error=oauth_no_email`);
    }

    const resolved = await resolveOAuthUser(prisma, profile, name);
    // OAuth IdPs verified the email before issuing the token, so
    // we mark the user as verified without a second round-trip.
    // Idempotent — already-verified users stay verified.
    await prisma.user.update({
      where: { id: resolved.userId },
      data: { emailVerified: true },
    });

    const token = jwt.sign(
      {
        userId: resolved.userId,
        email: resolved.email,
        role: resolved.role,
        tenantId: resolved.tenantId,
        jti: randomBytes(16).toString('base64url'),
      },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );

    setSessionCookie(req, res, token);
    res.clearCookie(STATE_COOKIE, { path: '/' });

    getAudit()
      .record({
        tenantId: resolved.tenantId,
        type: 'auth.login',
        actorId: resolved.userId,
        actorType: 'user',
        resource: resolved.userId,
        payload: {
          method: `oauth:${name}`,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
        },
      })
      .catch(() => undefined);

    const returnPath =
      safeReturnPath(
        (req as Request & { cookies?: Record<string, string> }).cookies?.[RETURN_COOKIE]
      ) || '/en/dashboard';
    res.clearCookie(RETURN_COOKIE, { path: '/' });
    return res.redirect(`${frontendUrl()}${returnPath}`);
  } catch (error) {
    req.log.error({ err: error, provider: name }, 'OAuth callback failed');
    return res.redirect(`${frontendUrl()}/en/login?error=oauth_failed`);
  }
});

export default router;
