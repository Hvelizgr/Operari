import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { getAuthProvider, AuthTransportError } from '../auth';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
    };
}

/**
 * Bearer-token authentication middleware.
 *
 * Routes the token through the configured AuthProvider (default
 * JwtAuthProvider for self-host, WorkOSAuthProvider for cloud when
 * NANORUN_AUTH_PROVIDER=workos). The middleware itself never knows
 * which provider is in use — switching to WorkOS is a single env
 * variable flip with zero route changes.
 *
 * Response codes:
 *   - 401 "No token provided" when the Authorization header is missing
 *   - 401 "Invalid token" when the provider returns null
 *   - 503 "Auth service unavailable" when the provider throws
 *     AuthTransportError (e.g. WorkOS JWKS endpoint unreachable).
 *     The 503 distinction matters because clients should retry on
 *     503 but re-authenticate on 401.
 */
export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.substring(7);

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
