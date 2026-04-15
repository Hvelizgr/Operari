/**
 * Pluggable authentication provider interface.
 *
 * NanoRun supports two auth modes per IMPLEMENTACION P1 #11:
 *
 *   1. Self-host: JWT casero (the existing path). Stays the default
 *      so single-node deployments do not need an external auth
 *      service.
 *
 *   2. Cloud SaaS: WorkOS AuthKit (free up to 1M MAU, SSO/SAML
 *      $125/connection charged to enterprise customers, no JWT secret
 *      management on our side, MFA / passwordless / social out of the
 *      box). Wired via this interface so the routes never know which
 *      provider is in use.
 *
 * Future providers (Auth0, Keycloak, Authentik, Zitadel, …) plug in
 * by implementing the same interface — the route layer above does
 * not change.
 *
 * The interface is intentionally narrow:
 *   - verifyToken returns the resolved AuthenticatedUser, or null on
 *     failure. No exceptions for "wrong creds" — exceptions leak via
 *     timing.
 *   - getProviderName returns a stable identifier so audit events
 *     can record which provider authorized the session
 *     ('jwt' | 'workos' | …).
 *
 * What this interface does NOT cover:
 *   - User creation / signup. Self-host has its own /auth/register
 *     route; WorkOS handles signup on its own hosted page.
 *   - Password reset flows.
 *   - MFA enrollment.
 * Each provider exposes those via its native surface; the runtime
 * only needs verifyToken at request time.
 */

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    /**
     * Stable identifier of the provider that issued the session.
     * Recorded in audit events as `actorMetadata.authProvider` so
     * incident timelines can show "logged in via WorkOS SSO".
     */
    provider: string;
}

export interface AuthProvider {
    /** Stable provider name: 'jwt' | 'workos' | … */
    readonly name: string;

    /**
     * Verify a bearer token and return the authenticated user, or
     * null if the token is invalid / expired / revoked. Implementations
     * MUST NOT throw on rejection — return null instead so the route
     * layer can respond with a uniform 401.
     *
     * Throwing IS allowed for transport-level failures (the auth
     * service is unreachable), which the middleware translates into
     * a 503.
     */
    verifyToken(token: string): Promise<AuthenticatedUser | null>;
}

export class AuthTransportError extends Error {
    constructor(message: string, public readonly provider: string) {
        super(message);
        this.name = 'AuthTransportError';
    }
}
