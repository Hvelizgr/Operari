import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import type { AuthProvider, AuthenticatedUser } from './auth-provider.types';

/**
 * JwtAuthProvider — wraps the existing self-host JWT auth so it
 * implements the new {@link AuthProvider} interface.
 *
 * Behavior preserved exactly from the previous `authenticate`
 * middleware: verify with `process.env.JWT_SECRET`, fetch the user
 * from Prisma to confirm they still exist, return the resolved user
 * shape. Returns null on any failure path so the middleware can
 * respond with a uniform 401.
 *
 * Why a class around four lines: the wrapping is what lets the
 * route layer accept any AuthProvider without caring which one is
 * configured. Tests can swap a fake provider without monkey-patching
 * jsonwebtoken.
 */
export class JwtAuthProvider implements AuthProvider {
    readonly name = 'jwt';

    constructor(
        private readonly prisma: PrismaClient,
        private readonly secret: string = process.env.JWT_SECRET ?? '',
    ) { }

    async verifyToken(token: string): Promise<AuthenticatedUser | null> {
        if (!this.secret) {
            // Misconfiguration: better to refuse loud than to silently
            // accept tokens with no secret. The middleware turns this
            // into a 401 — operators see "Invalid token" in the logs
            // and know to set JWT_SECRET.
            return null;
        }

        let decoded: { userId: string; email: string; role: string; tenantId: string };
        try {
            decoded = jwt.verify(token, this.secret) as typeof decoded;
        } catch {
            return null;
        }

        const user = await this.prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            provider: this.name,
        };
    }
}
