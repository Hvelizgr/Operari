import { NextFunction, Request, Response } from 'express';

import { AuthTransportError, getAuthProvider } from '../auth';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { prisma } from '../server';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

/**
 * Dual-transport authentication middleware.
 *
 * Accepts either `Authorization: Bearer <jwt>` (SDK/CLI/machine clients)
 * or the HttpOnly `nanorun_session` cookie (web UI). Bearer wins when
 * both are present so existing SDK flows are unaffected. The cookie
 * path means the browser session is XSS-resistant — JS in the Next.js
 * app can never read the token.
 *
 * The token itself still goes through the configured AuthProvider
 * (JwtAuthProvider for self-host, WorkOSAuthProvider for cloud) so the
 * transport change is orthogonal to the provider change.
 *
 * Response codes:
 *   - 401 "No token provided" when neither transport carries a token
 *   - 401 "Invalid token" when the provider returns null
 *   - 503 "Auth service unavailable" when the provider throws
 *     AuthTransportError (e.g. WorkOS JWKS endpoint unreachable).
 *     The 503 distinction matters because clients should retry on
 *     503 but re-authenticate on 401.
 */
function extractToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    SESSION_COOKIE_NAME
  ];
  return cookieToken ?? null;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = await getAuthProvider(prisma).verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    next();
  } catch (error) {
    if (error instanceof AuthTransportError) {
      return res.status(503).json({
        error: 'Auth service unavailable',
        provider: error.provider,
      });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Soft auth — sets req.user when a valid token is supplied, and silently
 * continues without one otherwise. Intended for endpoints that serve
 * both authenticated and anonymous callers with different payloads
 * (e.g. /api/node-types returns globals-only to anonymous, globals +
 * tenant-owned custom types to authenticated).
 *
 * Unlike `authenticate`, never emits 401 — that's the whole point. An
 * invalid token is treated identically to no token: the request
 * proceeds anonymous.
 */
export const attachUserIfPresent = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const user = await getAuthProvider(prisma).verifyToken(token);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };
    }
  } catch {
    // Swallow: the caller may be exercising the anonymous path.
  }
  next();
};

/**
 * Anonymous fallback middleware — sets a default user when no auth is
 * present and NANORUN_ANONYMOUS_MODE=true. Used by self-host single-
 * tenant deployments that don't need login.
 *
 * If NANORUN_ANONYMOUS_MODE is not "true", this middleware is a no-op,
 * so routes that require auth will return 401 via the `authenticate`
 * middleware.
 */
export const anonymousFallback = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user && process.env.NANORUN_ANONYMOUS_MODE === 'true') {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@nanorun.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
