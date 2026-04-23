import type { PrismaClient } from '@prisma/client';
import type { AuthProvider } from './auth-provider.types';
import { JwtAuthProvider } from './jwt-auth-provider';
import { WorkOSAuthProvider } from './workos-auth-provider';
import { WorkOSJwksVerifier } from './workos-jwks-verifier';

export type { AuthProvider, AuthenticatedUser } from './auth-provider.types';
export { AuthTransportError } from './auth-provider.types';
export { JwtAuthProvider } from './jwt-auth-provider';
export { WorkOSAuthProvider } from './workos-auth-provider';
export type { WorkOSClaims, VerifyJwksTokenFn } from './workos-auth-provider';
export { WorkOSJwksVerifier } from './workos-jwks-verifier';

/**
 * Build the configured AuthProvider for this process.
 *
 *   NANORUN_AUTH_PROVIDER=jwt     (default — self-host)
 *   NANORUN_AUTH_PROVIDER=workos  (cloud, requires WORKOS_CLIENT_ID etc.)
 *
 * Defaults to JWT so existing self-host deployments need ZERO config
 * changes after this commit lands. The WorkOS path is opt-in. When
 * the env var is set, the production WorkOSJwksVerifier is wired
 * (fetch + node:crypto, no extra deps); if the required WorkOS env
 * vars are missing, falls back to a stub verifier that refuses
 * every token so the operator gets loud 401s instead of silent
 * insecurity.
 */
export function buildAuthProvider(prisma: PrismaClient): AuthProvider {
  const provider = (process.env.NANORUN_AUTH_PROVIDER ?? 'jwt').toLowerCase();
  switch (provider) {
    case 'workos': {
      const clientId = process.env.WORKOS_CLIENT_ID;
      if (!clientId) {
        // Loud refusal — operator forgot to set WORKOS_CLIENT_ID.
        // Returning a no-op verifier ensures every request 401s
        // instead of silently letting tokens through.
        return new WorkOSAuthProvider(prisma, {
          verifyJwksToken: async () => null,
        });
      }
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: process.env.WORKOS_JWKS_URL ?? `https://api.workos.com/sso/jwks/${clientId}`,
        expectedIssuer: process.env.WORKOS_ISSUER ?? 'https://api.workos.com',
        expectedAudience: clientId,
      });
      return new WorkOSAuthProvider(prisma, {
        verifyJwksToken: verifier.asVerifyTokenFn(),
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
