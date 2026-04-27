import type { NextFunction, Response } from 'express';

// auth.middleware.ts imports `prisma` from ../server, which transitively
// loads env.config and crashes on missing DATABASE_URL/JWT_SECRET. We
// only need a placeholder client because the middleware never calls
// prisma directly — it just hands it to the AuthProvider, which we
// stub via setAuthProviderForTest below.
jest.mock('../../server', () => ({ prisma: {} }));

import {
  type AuthenticatedUser,
  type AuthProvider,
  AuthTransportError,
  resetAuthProviderForTest,
  setAuthProviderForTest,
} from '../../auth';
import { authenticate, AuthRequest, requireRole } from '../../middleware/auth.middleware';

/**
 * Unit tests for the bearer-auth middleware.
 *
 * The middleware delegates to whatever AuthProvider the process is
 * configured with. We swap in a stub provider via the
 * `setAuthProviderForTest` hook the auth module already exposes —
 * cleaner than jest.mock(), and forces real coverage of the catch
 * branches (transport vs. invalid-token) and the requireRole helper.
 */

const FAKE_USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'op@operari.test',
  role: 'ADMIN',
  tenantId: 'tenant-1',
  provider: 'stub',
};

function buildRes(): {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

function buildReq(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {}
): AuthRequest {
  return { headers, cookies } as unknown as AuthRequest;
}

function stubProvider(
  behavior:
    | { kind: 'ok'; user?: AuthenticatedUser }
    | { kind: 'reject' }
    | { kind: 'transport-error' }
    | { kind: 'unknown-error'; error: Error }
): AuthProvider {
  return {
    name: 'stub',
    verifyToken: jest.fn(async () => {
      switch (behavior.kind) {
        case 'ok':
          return behavior.user ?? FAKE_USER;
        case 'reject':
          return null;
        case 'transport-error':
          throw new AuthTransportError('jwks unreachable', 'stub');
        case 'unknown-error':
          throw behavior.error;
      }
    }),
  };
}

describe('authenticate middleware', () => {
  afterEach(() => {
    resetAuthProviderForTest();
    jest.clearAllMocks();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;

    await authenticate(buildReq(), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is not a Bearer token', async () => {
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;

    await authenticate(buildReq({ authorization: 'Basic abc' }), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next() on a valid token', async () => {
    setAuthProviderForTest(stubProvider({ kind: 'ok' }));
    const { res, status } = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    const req = buildReq({ authorization: 'Bearer good-token' });

    await authenticate(req, res, next);

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'op@operari.test',
      role: 'ADMIN',
      tenantId: 'tenant-1',
    });
    // Critical: provider field is NOT copied onto req.user — the
    // route layer should never branch on which provider issued the
    // token.
    expect((req.user as Record<string, unknown>).provider).toBeUndefined();
  });

  it('falls back to the operari_session cookie when no Bearer header is set', async () => {
    const provider = stubProvider({ kind: 'ok' });
    setAuthProviderForTest(provider);
    const { res, status } = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    const req = buildReq({}, { operari_session: 'cookie-token' });

    await authenticate(req, res, next);

    expect(provider.verifyToken).toHaveBeenCalledWith('cookie-token');
    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.id).toBe('user-1');
  });

  it('prefers the Authorization header over the cookie when both are present', async () => {
    const provider = stubProvider({ kind: 'ok' });
    setAuthProviderForTest(provider);
    const { res } = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    const req = buildReq(
      { authorization: 'Bearer header-wins' },
      { operari_session: 'cookie-loses' }
    );

    await authenticate(req, res, next);

    expect(provider.verifyToken).toHaveBeenCalledWith('header-wins');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 "Invalid token" when the provider returns null', async () => {
    setAuthProviderForTest(stubProvider({ kind: 'reject' }));
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;

    await authenticate(buildReq({ authorization: 'Bearer bad' }), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 "Auth service unavailable" with provider when transport fails', async () => {
    // The 401-vs-503 distinction is the whole reason the middleware
    // catches AuthTransportError separately: clients should retry on
    // 503 (transient infra issue) but re-authenticate on 401
    // (token actually rejected). Pin it.
    setAuthProviderForTest(stubProvider({ kind: 'transport-error' }));
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;

    await authenticate(buildReq({ authorization: 'Bearer x' }), res, next);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: 'Auth service unavailable',
      provider: 'stub',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to 401 when the provider throws a non-transport error', async () => {
    // A non-AuthTransportError throw is treated as "token bad" so
    // the 503 path stays reserved for true transport failures and
    // never leaks internal exception messages to clients.
    setAuthProviderForTest(stubProvider({ kind: 'unknown-error', error: new Error('boom') }));
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;

    await authenticate(buildReq({ authorization: 'Bearer x' }), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole middleware', () => {
  it('returns 401 when no user is attached to the request', () => {
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;

    requireRole('ADMIN')(buildReq(), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user role is not in the allowed set', () => {
    const { res, status, json } = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    const req = buildReq();
    req.user = { id: 'u', email: 'e', role: 'USER', tenantId: 't' };

    requireRole('ADMIN', 'OWNER')(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the user role matches one of the allowed roles', () => {
    const { res, status } = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    const req = buildReq();
    req.user = { id: 'u', email: 'e', role: 'OWNER', tenantId: 't' };

    requireRole('ADMIN', 'OWNER')(req, res, next);

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('handles a single allowed role (no rest-args misuse)', () => {
    const { res } = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    const req = buildReq();
    req.user = { id: 'u', email: 'e', role: 'ADMIN', tenantId: 't' };

    requireRole('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
