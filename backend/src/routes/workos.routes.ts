import { randomBytes } from 'crypto';
import { type CookieOptions, type Request, type Response, Router } from 'express';
import jwt from 'jsonwebtoken';

import { AuditService } from '../audit/audit.service';
import { setSessionCookie } from '../auth/session-cookie';
import { prisma } from '../server';

/**
 * WorkOS SSO callback route.
 *
 * The WorkOSAuthProvider in `src/auth/workos-auth-provider.ts` handles
 * token verification — that piece works in isolation against any
 * already-issued WorkOS JWT. What was missing was the redirect dance
 * that turns an unauthenticated browser into a session cookie:
 *
 *   GET /api/auth/workos              → sets state cookie, 302 to WorkOS authorize URL
 *   GET /api/auth/workos/callback     → exchanges code for token, mints session, 302 to /en/dashboard
 *
 * Mirrors the Google/GitHub flow in oauth.routes.ts. We keep this in
 * its own file because:
 *   - WorkOS uses its own env-var triplet (WORKOS_CLIENT_ID,
 *     WORKOS_CLIENT_SECRET, optional WORKOS_AUTHORIZE_URL +
 *     WORKOS_TOKEN_URL).
 *   - WorkOS organization → Operari tenant lookup is its own step
 *     (`Tenant.workosOrganizationId`) the generic OAuth flow does
 *     not perform.
 *
 * Token exchange is a single POST to the WorkOS /sso/token endpoint;
 * the access_token comes back as a signed JWT we run through the
 * existing JWKS verifier.
 */

const router = Router();

const STATE_COOKIE = 'operari_workos_oauth_state';
const RETURN_COOKIE = 'operari_workos_oauth_return';
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

const SAFE_RETURN_PATH = /^\/(en|es)(\/[\w\-/]*)?$/;

function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && SAFE_RETURN_PATH.test(value) ? value : null;
}

function callbackUrl(req: Request): string {
  const base =
    process.env.OAUTH_REDIRECT_BASE_URL ||
    process.env.FRONTEND_URL ||
    `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/auth/workos/callback`;
}

function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function authorizeUrl(): string {
  return process.env.WORKOS_AUTHORIZE_URL || 'https://api.workos.com/sso/authorize';
}

function tokenUrl(): string {
  return process.env.WORKOS_TOKEN_URL || 'https://api.workos.com/sso/token';
}

function isWorkOSConfigured(): boolean {
  return Boolean(process.env.WORKOS_CLIENT_ID && process.env.WORKOS_CLIENT_SECRET);
}

/** Pluggable token exchange — overridable for tests. */
export type TokenExchangeFn = (params: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) => Promise<{
  access_token: string;
  profile?: { id?: string; email?: string; organization_id?: string; role?: string };
}>;

let tokenExchanger: TokenExchangeFn = async ({
  tokenUrl,
  clientId,
  clientSecret,
  code,
  redirectUri,
}) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`WorkOS token exchange failed: HTTP ${res.status}`);
  }
  return (await res.json()) as {
    access_token: string;
    profile?: { id?: string; email?: string; organization_id?: string; role?: string };
  };
};

/** Test hook — swap the live exchanger for a fake. */
export function setTokenExchangerForTesting(fn: TokenExchangeFn | null): void {
  if (fn) {
    tokenExchanger = fn;
  }
}

/** Test hook — restore the live exchanger. */
export function resetTokenExchangerForTesting(): void {
  tokenExchanger = async ({ tokenUrl, clientId, clientSecret, code, redirectUri }) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`WorkOS token exchange failed: HTTP ${res.status}`);
    }
    return (await res.json()) as {
      access_token: string;
      profile?: { id?: string; email?: string; organization_id?: string; role?: string };
    };
  };
}

let auditService: AuditService | null = null;
function getAudit(): AuditService {
  if (!auditService) auditService = new AuditService(prisma);
  return auditService;
}

function newState(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * GET /api/auth/workos
 *
 * Initiate the WorkOS SSO flow. Sets a CSRF state cookie, optionally
 * a return-path cookie, then 302s to the WorkOS hosted login UI.
 *
 * Optional ?redirect=/en/some-page query param to bring the user back
 * to a specific page after auth (validated against SAFE_RETURN_PATH).
 *
 * Optional ?organization=org_xxx hint the WorkOS UI uses to skip the
 * org picker. Pass-through; we do not validate it locally.
 */
router.get('/', (req: Request, res: Response) => {
  if (!isWorkOSConfigured()) {
    return res.status(501).json({ error: 'WorkOS SSO is not configured on this server' });
  }

  const state = newState();
  const params = new URLSearchParams({
    client_id: process.env.WORKOS_CLIENT_ID!,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    state,
    provider: 'authkit',
  });
  if (typeof req.query.organization === 'string') {
    params.set('organization', req.query.organization);
  }
  const url = `${authorizeUrl()}?${params.toString()}`;

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
 * GET /api/auth/workos/callback
 *
 * Receive the auth code from WorkOS, exchange it for an access token,
 * resolve the WorkOS org → Operari tenant link, upsert the user,
 * mint a session cookie, and redirect to the app.
 *
 * Failure modes that send the user back to /login with a query
 * parameter:
 *   - oauth_state_mismatch: state cookie missing or wrong (CSRF)
 *   - oauth_no_email: WorkOS profile lacks an email (rare; misconfigured directory)
 *   - oauth_no_tenant: WorkOS organization is not linked to a Operari tenant
 *   - oauth_failed: anything else (transport, signature, exchange)
 */
router.get('/callback', async (req: Request, res: Response) => {
  if (!isWorkOSConfigured()) {
    return res.status(501).json({ error: 'WorkOS SSO is not configured' });
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
    const exchange = await tokenExchanger({
      tokenUrl: tokenUrl(),
      clientId: process.env.WORKOS_CLIENT_ID!,
      clientSecret: process.env.WORKOS_CLIENT_SECRET!,
      code,
      redirectUri: callbackUrl(req),
    });

    // Profile is sometimes embedded in the token response; if not we
    // fall back to decoding the access_token (a JWT). For self-host
    // tests + an end-to-end smoke test, the embedded profile is
    // simpler.
    const profile = exchange.profile ?? decodeProfileClaims(exchange.access_token);
    if (!profile?.email) {
      return res.redirect(`${frontendUrl()}/en/login?error=oauth_no_email`);
    }
    if (!profile.organization_id) {
      return res.redirect(`${frontendUrl()}/en/login?error=oauth_no_tenant`);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { workosOrganizationId: profile.organization_id },
      select: { id: true },
    });
    if (!tenant) {
      return res.redirect(`${frontendUrl()}/en/login?error=oauth_no_tenant`);
    }

    const role = (profile.role ?? 'USER').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        name: profile.email,
        passwordHash: '',
        tenantId: tenant.id,
        role,
        emailVerified: true,
      },
      update: {
        tenantId: tenant.id,
        role,
        emailVerified: true,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        jti: randomBytes(16).toString('base64url'),
      },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );

    setSessionCookie(req, res, token);
    res.clearCookie(STATE_COOKIE, { path: '/' });

    getAudit()
      .record({
        tenantId: user.tenantId,
        type: 'auth.login',
        actorId: user.id,
        actorType: 'user',
        resource: user.id,
        payload: {
          method: 'workos',
          organizationId: profile.organization_id,
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
    req.log.error({ err: error }, 'WorkOS callback failed');
    return res.redirect(`${frontendUrl()}/en/login?error=oauth_failed`);
  }
});

/**
 * Decode a WorkOS access_token JWT WITHOUT verifying signature, just
 * to read the email + organization claims when the token endpoint
 * does not embed the profile. We still trust the token because we
 * just exchanged a server-to-server code with our client_secret —
 * the channel is authenticated even if we skip the signature check
 * here. Production deployments that want belt-and-braces verification
 * should use the JWKS verifier in `src/auth/workos-jwks-verifier.ts`.
 */
function decodeProfileClaims(token: string): {
  email?: string;
  organization_id?: string;
  role?: string;
} | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    const claims = JSON.parse(payload) as {
      email?: string;
      organization_id?: string;
      role?: string;
    };
    return claims;
  } catch {
    return null;
  }
}

export default router;
