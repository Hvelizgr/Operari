import { type CookieOptions, type Request, type Response, Router } from 'express';

import { AuditService } from '../audit/audit.service';
import { exchangeCodeForTokenAndProfile, newState } from '../auth/oauth/oauth-service';
import { isProviderConfigured, PROVIDERS } from '../auth/oauth/providers';
import { env } from '../config/env.config';
import { anonymousFallback, AuthRequest } from '../middleware/auth.middleware';
import {
  ConnectedAccountError,
  ConnectedAccountService,
} from '../security/connected-account.service';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { prisma } from '../server';

const router = Router();

// Lazy singleton — the service constructor demands cipher/reader/audit
// even though `list` does not use them, so we instantiate them once
// here. The encryption key is optional in dev (no real secrets are
// stored) and falls back to a deterministic 32-byte hex string so the
// list endpoint never crashes a self-host setup.
let service: ConnectedAccountService | null = null;
function getService(): ConnectedAccountService {
  if (!service) {
    const key = env.ENCRYPTION_KEY ?? '0'.repeat(64);
    const cipher = new SecretCipher(key);
    const audit = new AuditService(prisma);
    const reader = new SecretReader(cipher, audit);
    service = new ConnectedAccountService(prisma, cipher, reader, audit);
  }
  return service;
}

// Anonymous fallback gated by OPERARI_ANONYMOUS_MODE=true.
router.use(anonymousFallback);

const PROVIDER_RE = /^[a-z0-9][a-z0-9._-]{0,48}$/;
const MAX_METADATA_BYTES = 4096;

/**
 * POST /api/connected-accounts
 *
 * Store an API key, token or connection string the user pastes in, so
 * steps reference it as {{secrets.<id>}} instead of keeping it in plain
 * text inside the runbook. `metadata` holds non-secret settings (an AI
 * provider's base URL and models, for instance).
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // getService() falls back to a fixed dev key so listing never crashes;
  // real secrets must never be encrypted with it.
  if (!env.ENCRYPTION_KEY) {
    return res.status(503).json({
      error:
        'ENCRYPTION_KEY is not configured on the server, so credentials cannot be stored safely.',
    });
  }
  const { provider, displayName, secret, metadata } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof provider !== 'string' || !PROVIDER_RE.test(provider)) {
    return res
      .status(400)
      .json({ error: 'provider must be lowercase letters, digits, dots or dashes' });
  }
  if (typeof secret !== 'string' || !secret.trim() || secret.length > 16_384) {
    return res.status(400).json({ error: 'secret is required (max 16 KB)' });
  }
  if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 120)) {
    return res.status(400).json({ error: 'displayName must be a string up to 120 characters' });
  }
  if (
    metadata !== undefined &&
    (typeof metadata !== 'object' ||
      metadata === null ||
      Array.isArray(metadata) ||
      JSON.stringify(metadata).length > MAX_METADATA_BYTES)
  ) {
    return res.status(400).json({ error: 'metadata must be a JSON object up to 4 KB' });
  }
  try {
    const account = await getService().link({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      provider,
      displayName:
        typeof displayName === 'string' && displayName.trim() ? displayName.trim() : undefined,
      accessToken: secret.trim(),
      scopes: [],
      metadata: (metadata as Record<string, unknown> | undefined) ?? {},
      actorId: req.user.id,
      actorType: 'user',
    });
    return res.status(201).json({
      data: {
        id: account.id,
        provider: account.provider,
        displayName: account.displayName,
        metadata: account.metadata ?? {},
        createdAt: account.createdAt,
      },
    });
  } catch (err) {
    // @@unique([userId, provider, displayName])
    if ((err as { code?: string }).code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'You already have a credential with that provider and name' });
    }
    req.log.error({ err }, 'Create connected account failed');
    return res.status(500).json({ error: 'Failed to store the credential' });
  }
});

/**
 * GET /api/connected-accounts
 *
 * Token-free list of every account the current user has linked.
 * Used by the secret picker in the editor so step authors can select
 * a credential by id without ever seeing the underlying token. The
 * runtime engine resolves the id back to a token via
 * ConnectedAccountService.getAccessToken at execution time.
 *
 * Optional ?provider=github filter to scope the picker by provider.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { id: userId, tenantId } = req.user!;
    const accounts = await getService().list(tenantId, userId);
    const provider = req.query.provider as string | undefined;
    // `?provider=ai` also matches `ai.anthropic`, `ai.openai`, …
    const filtered = provider
      ? accounts.filter(a => a.provider === provider || a.provider.startsWith(`${provider}.`))
      : accounts;
    res.json({
      data: filtered.map(a => ({
        id: a.id,
        provider: a.provider,
        displayName: a.displayName,
        scopes: a.scopes,
        createdAt: a.createdAt,
        tokenExpiry: a.tokenExpiry,
        metadata: a.metadata ?? {},
      })),
    });
  } catch (err) {
    req.log.error({ err }, 'List connected accounts error');
    res.status(500).json({ error: 'Failed to list connected accounts' });
  }
});

// ---------------------------------------------------------------------
// GitHub OAuth — link a connected account so the runbook engine can
// post commit statuses, write files, and read repo metadata on the
// user's behalf.
//
// Two routes here, one cookie pair:
//   GET  /github/oauth/start    — set state cookie, return authorize URL
//   GET  /github/oauth/callback — verify state, exchange code, link
//
// We do NOT reuse the user-login route at /api/auth/github because
// the scopes are different (`repo` instead of `read:user`) and the
// exit path is different (back to /settings, not /dashboard).
// ---------------------------------------------------------------------

const STATE_COOKIE = 'operari_ca_oauth_state';
const RETURN_COOKIE = 'operari_ca_oauth_return';
const STATE_TTL_MS = 10 * 60 * 1000;

// Scopes for the connected-account flow. `repo` covers commit statuses
// + content writes (the github.commitFile step type); `read:user` and
// `user:email` populate the displayName so the operator can tell two
// linked accounts apart in the picker. We deliberately ask for the
// public `repo` scope rather than `public_repo` because most runbook
// users want to operate on private deploy / infra repos.
const GITHUB_CONNECTED_ACCOUNT_SCOPES = ['repo', 'read:user', 'user:email'];

const SAFE_RETURN_PATH = /^\/(en|es)(\/[\w\-/]*)?$/;

function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && SAFE_RETURN_PATH.test(value) ? value : null;
}

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

function callbackUrl(req: Request): string {
  const base =
    process.env.OAUTH_REDIRECT_BASE_URL ||
    process.env.FRONTEND_URL ||
    `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/connected-accounts/github/oauth/callback`;
}

function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * GET /api/connected-accounts/github/oauth/start
 *
 * Returns the GitHub authorize URL the frontend should redirect the
 * browser to. Sets a short-lived state cookie (CSRF) and an optional
 * return-path cookie so the callback can send the user back to the
 * page they came from. We do NOT 302 here — the frontend swaps
 * window.location itself so it can show its own loading UX while
 * the cookie is being set.
 */
router.get('/github/oauth/start', (req: AuthRequest, res: Response) => {
  if (!isProviderConfigured('github')) {
    return res.status(501).json({ error: 'GitHub OAuth is not configured on this server' });
  }

  const state = newState();
  const provider = PROVIDERS.github;
  const redirectUri = callbackUrl(req);
  const clientId = provider.clientId();
  if (!clientId) {
    return res.status(501).json({ error: 'GitHub OAuth is not configured on this server' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GITHUB_CONNECTED_ACCOUNT_SCOPES.join(' '),
    state,
    allow_signup: 'true',
  });
  const url = `${provider.authorizeUrl}?${params.toString()}`;

  res.cookie(STATE_COOKIE, state, stateCookieOptions(req));
  const requestedReturn = safeReturnPath(req.query.redirect);
  if (requestedReturn) {
    res.cookie(RETURN_COOKIE, requestedReturn, stateCookieOptions(req));
  } else {
    res.clearCookie(RETURN_COOKIE, { path: '/' });
  }

  return res.json({ url });
});

/**
 * GET /api/connected-accounts/github/oauth/callback
 *
 * Receives the auth code, exchanges it for an access token, fetches
 * the user profile (so we can store a useful displayName), and calls
 * ConnectedAccountService.link() to encrypt + persist. Redirects the
 * browser back into the app on completion.
 *
 * The current authenticated user is the linker — the access token
 * lives under their tenant. Anonymous-mode self-host installs link
 * to the default tenant.
 */
router.get('/github/oauth/callback', async (req: AuthRequest, res: Response) => {
  if (!isProviderConfigured('github')) {
    return res.status(501).json({ error: 'GitHub OAuth is not configured on this server' });
  }

  const returnPath =
    safeReturnPath(
      (req as Request & { cookies?: Record<string, string> }).cookies?.[RETURN_COOKIE]
    ) || '/en/settings';
  res.clearCookie(RETURN_COOKIE, { path: '/' });

  const errorParam = typeof req.query.error === 'string' ? req.query.error : null;
  if (errorParam) {
    return res.redirect(`${frontendUrl()}${returnPath}?ca_error=${encodeURIComponent(errorParam)}`);
  }

  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const stateCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    STATE_COOKIE
  ];
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return res.redirect(`${frontendUrl()}${returnPath}?ca_error=oauth_state_mismatch`);
  }

  // The linker MUST be a real authenticated user. Anonymous-mode
  // self-hosts get the default-tenant pseudo-user via
  // anonymousFallback above; that's intentional, single-tenant
  // self-hosts legitimately want to link a token. Cloud / multi-
  // tenant deploys never satisfy that fallback because OPERARI_ANONYMOUS_MODE
  // is off, so the call falls through to 401 below.
  if (!req.user) {
    return res.redirect(`${frontendUrl()}/en/login?error=oauth_not_authenticated`);
  }

  try {
    const provider = PROVIDERS.github;
    const redirectUri = callbackUrl(req);
    const { accessToken, profile } = await exchangeCodeForTokenAndProfile(
      provider,
      code,
      redirectUri
    );

    const displayName = profile.name ?? profile.email ?? `github:${profile.providerId}`;
    await getService().link({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      provider: 'github',
      displayName,
      accessToken,
      scopes: GITHUB_CONNECTED_ACCOUNT_SCOPES,
      metadata: { providerId: profile.providerId },
      actorId: req.user.id,
      actorType: 'user',
    });

    res.clearCookie(STATE_COOKIE, { path: '/' });
    return res.redirect(`${frontendUrl()}${returnPath}?ca_linked=github`);
  } catch (err) {
    req.log.error({ err }, 'GitHub connected-account OAuth callback failed');
    return res.redirect(`${frontendUrl()}${returnPath}?ca_error=oauth_failed`);
  }
});

/**
 * DELETE /api/connected-accounts/:id
 *
 * Unlink a connected account. Calls ConnectedAccountService.unlink so
 * the row is removed and a `connectedaccount.unlinked` event hits the
 * audit chain. Cross-tenant ids are rejected before the delete touches
 * the database.
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const accountId = String(req.params.id);
  try {
    await getService().unlink({
      accountId,
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      actorType: 'user',
      reason: typeof req.query.reason === 'string' ? req.query.reason : 'user-initiated',
    });
    return res.status(204).end();
  } catch (err) {
    if (err instanceof ConnectedAccountError) {
      const status = err.code === 'NOT_FOUND' || err.code === 'CROSS_TENANT' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code.toLowerCase() });
    }
    req.log.error({ err }, 'Unlink connected account failed');
    return res.status(500).json({ error: 'Failed to unlink connected account' });
  }
});

export default router;
