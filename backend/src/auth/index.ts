import type { PrismaClient } from '@prisma/client';
import type { AuthProvider } from './auth-provider.types';
import { JwtAuthProvider } from './jwt-auth-provider';
import { WorkOSAuthProvider } from './workos-auth-provider';

export type { AuthProvider, AuthenticatedUser } from './auth-provider.types';
export { AuthTransportError } from './auth-provider.types';
export { JwtAuthProvider } from './jwt-auth-provider';
export { WorkOSAuthProvider } from './workos-auth-provider';
export type { WorkOSClaims, VerifyJwksTokenFn } from './workos-auth-provider';

/**
 * Build the configured AuthProvider for this process.
 *
 *   NANORUN_AUTH_PROVIDER=jwt     (default — self-host)
 *   NANORUN_AUTH_PROVIDER=workos  (cloud, requires WORKOS_CLIENT_ID etc.)
 *
 * Defaults to JWT so existing self-host deployments need ZERO config
 * changes after this commit lands. The WorkOS path is opt-in and
 * fails closed if the verifyJwksToken function is not supplied — we
 * never silently fall back to JWT when the operator asked for WorkOS.
 */
export function buildAuthProvider(prisma: PrismaClient): AuthProvider {
    const provider = (process.env.NANORUN_AUTH_PROVIDER ?? 'jwt').toLowerCase();
    switch (provider) {
        case 'workos': {
            // Production wiring will pass a real verifyJwksToken
            // backed by fetch + jose JWKS verification. Until that
            // lands, the skeleton refuses every token (returns null)
            // so the operator does not silently fall back to insecure
            // mode. The error is loud at startup, not at every request.
            return new WorkOSAuthProvider(prisma, {
                verifyJwksToken: async () => null,
            });
        }
        case 'jwt':
        default:
            return new JwtAuthProvider(prisma);
    }
}

/**
 * Process-wide singleton AuthProvider. Built lazily so test
 * environments that mock auth never instantiate the production one.
 */
let providerSingleton: AuthProvider | null = null;

export function getAuthProvider(prisma: PrismaClient): AuthProvider {
    if (!providerSingleton) {
        providerSingleton = buildAuthProvider(prisma);
    }
    return providerSingleton;
}

export function setAuthProviderForTest(provider: AuthProvider): void {
    providerSingleton = provider;
}

export function resetAuthProviderForTest(): void {
    providerSingleton = null;
}
