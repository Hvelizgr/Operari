// env.config validates JWT_SECRET (min 32 chars) at import time.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.FRONTEND_URL = 'https://app.test.local';
process.env.OAUTH_REDIRECT_BASE_URL = 'https://api.test.local';
process.env.GITHUB_CLIENT_ID = 'gh-client-id';
process.env.GITHUB_CLIENT_SECRET = 'gh-client-secret';

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

jest.mock('../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../server', () => ({ prisma: {} }));

// Mock the audit service so unlink doesn't try to write to the chain.
jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
    append: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the connected-account service: it's exercised end-to-end in
// security/connected-account.service.test.ts. Here we only verify the
// route wiring — the service contract is stubbed.
const linkMock = jest.fn();
const unlinkMock = jest.fn();
const listMock = jest.fn().mockResolvedValue([]);
const updateMetadataMock = jest.fn();
const getMetadataMock = jest.fn();
const getAccessTokenMock = jest.fn();
jest.mock('../../security/connected-account.service', () => {
  const actual = jest.requireActual('../../security/connected-account.service');
  return {
    ...actual,
    ConnectedAccountService: jest.fn().mockImplementation(() => ({
      list: listMock,
      link: linkMock,
      unlink: unlinkMock,
      updateMetadata: updateMetadataMock,
      getMetadata: getMetadataMock,
      getAccessToken: getAccessTokenMock,
    })),
  };
});

// Mock the OAuth code-exchange so we never hit github.com in CI. The
// route uses the real `newState()` (deterministic shape, not a mock
// concern).
const exchangeMock = jest.fn();
jest.mock('../../auth/oauth/oauth-service', () => {
  const actual = jest.requireActual('../../auth/oauth/oauth-service');
  return {
    ...actual,
    exchangeCodeForTokenAndProfile: (...args: unknown[]) => exchangeMock(...args),
  };
});

import { ConnectedAccountError } from '../../security/connected-account.service';

import connectedAccountsRouter from '../../routes/connected-accounts.routes';

function buildApp(opts?: { authed?: boolean }) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  if (opts?.authed) {
    app.use((req: express.Request & { user?: unknown }, _res, next) => {
      (req as unknown as { user: unknown }).user = {
        id: 'u1',
        email: 'u@e',
        role: 'USER',
        tenantId: 't1',
      };
      next();
    });
  }
  app.use((req: express.Request & { log?: unknown }, _res, next) => {
    (req as unknown as { log: { error: () => void } }).log = { error: () => undefined };
    next();
  });
  app.use('/api/connected-accounts', connectedAccountsRouter);
  return app;
}

describe('GET /api/connected-accounts/github/oauth/start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the GitHub authorize URL and sets a state cookie', async () => {
    const res = await request(buildApp({ authed: true })).get(
      '/api/connected-accounts/github/oauth/start'
    );
    expect(res.status).toBe(200);
    const url = new URL(res.body.url);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('gh-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.test.local/api/connected-accounts/github/oauth/callback'
    );
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(
      expect.arrayContaining(['repo', 'read:user', 'user:email'])
    );
    const state = url.searchParams.get('state');
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    // The state cookie is set with the same value
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(Array.isArray(setCookie) ? setCookie.join('\n') : setCookie).toMatch(
      `operari_ca_oauth_state=${state}`
    );
  });

  it('persists the redirect path in a return cookie when ?redirect= is supplied', async () => {
    const res = await request(buildApp({ authed: true })).get(
      '/api/connected-accounts/github/oauth/start?redirect=/en/settings/integrations'
    );
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(Array.isArray(setCookie) ? setCookie.join('\n') : setCookie).toContain(
      'operari_ca_oauth_return=%2Fen%2Fsettings%2Fintegrations'
    );
  });

  it('rejects with 501 when GitHub creds are not configured', async () => {
    const oldId = process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_ID;
    try {
      const res = await request(buildApp({ authed: true })).get(
        '/api/connected-accounts/github/oauth/start'
      );
      expect(res.status).toBe(501);
    } finally {
      process.env.GITHUB_CLIENT_ID = oldId;
    }
  });
});

describe('GET /api/connected-accounts/github/oauth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects state mismatch and redirects to the front-end with an error param', async () => {
    const res = await request(buildApp({ authed: true }))
      .get('/api/connected-accounts/github/oauth/callback?code=c1&state=mismatched')
      .set('Cookie', ['operari_ca_oauth_state=expected-state']);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('ca_error=oauth_state_mismatch');
  });

  it('exchanges the code, links the account, and redirects with ca_linked=github on the happy path', async () => {
    exchangeMock.mockResolvedValueOnce({
      accessToken: 'gh-access-token',
      profile: { providerId: '12345', email: 'alice@example.com', name: 'Alice' },
    });
    linkMock.mockResolvedValueOnce({ id: 'ca-1' });

    const res = await request(buildApp({ authed: true }))
      .get('/api/connected-accounts/github/oauth/callback?code=valid-code&state=ok-state')
      .set('Cookie', ['operari_ca_oauth_state=ok-state']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('ca_linked=github');
    expect(linkMock).toHaveBeenCalledTimes(1);
    expect(linkMock.mock.calls[0][0]).toMatchObject({
      tenantId: 't1',
      userId: 'u1',
      provider: 'github',
      accessToken: 'gh-access-token',
      displayName: 'Alice',
      scopes: expect.arrayContaining(['repo', 'read:user', 'user:email']),
      metadata: { providerId: '12345' },
      actorId: 'u1',
      actorType: 'user',
    });
  });

  it('honors the return cookie and redirects back to the original page', async () => {
    exchangeMock.mockResolvedValueOnce({
      accessToken: 't',
      profile: { providerId: '1', email: 'a@b', name: 'A' },
    });
    linkMock.mockResolvedValueOnce({ id: 'ca-2' });

    const res = await request(buildApp({ authed: true }))
      .get('/api/connected-accounts/github/oauth/callback?code=c&state=s')
      .set('Cookie', [
        'operari_ca_oauth_state=s',
        'operari_ca_oauth_return=/es/settings/integrations',
      ]);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/es/settings/integrations?ca_linked=github');
  });

  it('redirects with ca_error=oauth_failed when the exchange throws', async () => {
    exchangeMock.mockRejectedValueOnce(new Error('github 500'));

    const res = await request(buildApp({ authed: true }))
      .get('/api/connected-accounts/github/oauth/callback?code=c&state=s')
      .set('Cookie', ['operari_ca_oauth_state=s']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('ca_error=oauth_failed');
    expect(linkMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/connected-accounts/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function summary(env: string | null) {
    return {
      id: 'ca-1',
      provider: 'github',
      displayName: 'alice',
      scopes: ['repo'],
      createdAt: new Date('2026-04-29T00:00:00Z'),
      tokenExpiry: null,
      tenantId: 't1',
      userId: 'u1',
      updatedAt: new Date('2026-05-01T00:00:00Z'),
      metadata: env === null ? { providerId: '12345' } : { providerId: '12345', env },
    };
  }

  it('writes metadata.env when env is a valid slug', async () => {
    updateMetadataMock.mockResolvedValueOnce(summary('prod'));
    const res = await request(buildApp({ authed: true }))
      .patch('/api/connected-accounts/ca-1')
      .send({ env: 'prod' });
    expect(res.status).toBe(200);
    expect(res.body.data.env).toBe('prod');
    expect(updateMetadataMock).toHaveBeenCalledWith({
      accountId: 'ca-1',
      tenantId: 't1',
      patch: { env: 'prod' },
      actorId: 'u1',
      actorType: 'user',
    });
  });

  it('clears metadata.env when env is null', async () => {
    updateMetadataMock.mockResolvedValueOnce(summary(null));
    const res = await request(buildApp({ authed: true }))
      .patch('/api/connected-accounts/ca-1')
      .send({ env: null });
    expect(res.status).toBe(200);
    expect(res.body.data.env).toBeNull();
    expect(updateMetadataMock.mock.calls[0][0].patch).toEqual({ env: null });
  });

  it('treats an empty string as a clear', async () => {
    updateMetadataMock.mockResolvedValueOnce(summary(null));
    const res = await request(buildApp({ authed: true }))
      .patch('/api/connected-accounts/ca-1')
      .send({ env: '   ' });
    expect(res.status).toBe(200);
    expect(updateMetadataMock.mock.calls[0][0].patch).toEqual({ env: null });
  });

  it('rejects env values with disallowed characters', async () => {
    const res = await request(buildApp({ authed: true }))
      .patch('/api/connected-accounts/ca-1')
      .send({ env: 'has spaces' });
    expect(res.status).toBe(400);
    expect(updateMetadataMock).not.toHaveBeenCalled();
  });

  it('rejects an empty body with no supported fields', async () => {
    const res = await request(buildApp({ authed: true }))
      .patch('/api/connected-accounts/ca-1')
      .send({});
    expect(res.status).toBe(400);
    expect(updateMetadataMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the service raises NOT_FOUND or CROSS_TENANT', async () => {
    updateMetadataMock.mockRejectedValueOnce(new ConnectedAccountError('nope', 'NOT_FOUND'));
    const res = await request(buildApp({ authed: true }))
      .patch('/api/connected-accounts/missing')
      .send({ env: 'prod' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('returns 401 when no user is authenticated', async () => {
    const res = await request(buildApp({ authed: false }))
      .patch('/api/connected-accounts/ca-1')
      .send({ env: 'prod' });
    expect(res.status).toBe(401);
    expect(updateMetadataMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/connected-accounts/:id/test', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('returns success + login + scopes when GitHub accepts the token', async () => {
    getMetadataMock.mockResolvedValueOnce({ id: 'ca-1', provider: 'github' });
    getAccessTokenMock.mockResolvedValueOnce('ghp_real');
    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ login: 'octocat', id: 1 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-OAuth-Scopes': 'repo, read:user, user:email',
          },
        })
    ) as unknown as typeof fetch;

    const res = await request(buildApp({ authed: true })).post('/api/connected-accounts/ca-1/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      provider: 'github',
      info: { login: 'octocat', scopes: ['repo', 'read:user', 'user:email'] },
    });
  });

  it('returns success:false when GitHub returns 401', async () => {
    getMetadataMock.mockResolvedValueOnce({ id: 'ca-2', provider: 'github' });
    getAccessTokenMock.mockResolvedValueOnce('ghp_revoked');
    globalThis.fetch = jest.fn(
      async () => new Response('Bad credentials', { status: 401 })
    ) as unknown as typeof fetch;

    const res = await request(buildApp({ authed: true })).post('/api/connected-accounts/ca-2/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe(401);
  });

  it('returns 501 when the provider has no test implementation yet', async () => {
    getMetadataMock.mockResolvedValueOnce({ id: 'ca-3', provider: 'slack' });
    const res = await request(buildApp({ authed: true })).post('/api/connected-accounts/ca-3/test');
    expect(res.status).toBe(501);
    expect(res.body.code).toBe('unsupported_provider');
    expect(getAccessTokenMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the account does not exist or belongs to another tenant', async () => {
    getMetadataMock.mockResolvedValueOnce(null);
    const res = await request(buildApp({ authed: true })).post(
      '/api/connected-accounts/missing/test'
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('returns 401 when no user is authenticated', async () => {
    const res = await request(buildApp({ authed: false })).post(
      '/api/connected-accounts/ca-1/test'
    );
    expect(res.status).toBe(401);
    expect(getMetadataMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/connected-accounts/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 204 and calls unlink with the actor metadata', async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    const res = await request(buildApp({ authed: true })).delete('/api/connected-accounts/ca-1');
    expect(res.status).toBe(204);
    expect(unlinkMock).toHaveBeenCalledWith({
      accountId: 'ca-1',
      tenantId: 't1',
      actorId: 'u1',
      actorType: 'user',
      reason: 'user-initiated',
    });
  });

  it('forwards an explicit ?reason= into the audit payload', async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    await request(buildApp({ authed: true })).delete(
      '/api/connected-accounts/ca-2?reason=token-rotated'
    );
    expect(unlinkMock.mock.calls[0][0].reason).toBe('token-rotated');
  });

  it('returns 404 when the service raises NOT_FOUND or CROSS_TENANT', async () => {
    unlinkMock.mockRejectedValueOnce(new ConnectedAccountError('nope', 'NOT_FOUND'));
    const res = await request(buildApp({ authed: true })).delete('/api/connected-accounts/missing');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('returns 401 when no user is authenticated', async () => {
    const res = await request(buildApp({ authed: false })).delete('/api/connected-accounts/ca-1');
    expect(res.status).toBe(401);
    expect(unlinkMock).not.toHaveBeenCalled();
  });
});
