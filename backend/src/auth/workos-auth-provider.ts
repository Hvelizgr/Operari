import type { PrismaClient, Role } from '@prisma/client';
import type { AuthProvider, AuthenticatedUser } from './auth-provider.types';
import { AuthTransportError } from './auth-provider.types';

/**
 * WorkOSAuthProvider — adapter for WorkOS AuthKit (P1 #11).
 *
 * What this ships
 *   - The right interface so routes can opt into WorkOS via
 *     `NANORUN_AUTH_PROVIDER=workos` without rewriting auth call sites
 *   - Tenant resolution: WorkOS organizations map 1:1 to NanoRun
 *     tenants via `Tenant.workosOrganizationId` (added by the
 *     `add_tenant_external_ids` migration)
 *   - Local user upsert: on a successful WorkOS verify, create the
 *     User row if missing. WorkOS owns identity; NanoRun owns
 *     authorization (RBAC + per-tenant resources).
 *
 * Pluggable verification: the constructor takes a `verifyJwksToken`
 * function so the actual JWKS HTTP call can be swapped. The
 * production wiring is `WorkOSJwksVerifier.asVerifyTokenFn()` which
 * uses `node:crypto` + `fetch` to verify RS256 against the WorkOS
 * JWKS endpoint with kid rotation, alg=none/HS256 attack protection,
 * and a per-instance JWKS cache. Tests inject fakes.
 *
 * What this DOES NOT cover (out of scope for this file)
 *   - Webhook handling for user.updated / user.deleted events from
 *     WorkOS. The inverse direction — WorkOS telling NanoRun a user
 *     changed — lives in a future webhooks/workos.routes.ts.
 *   - SSO / SAML flow initiation. WorkOS owns the hosted UI; the
 *     backend only sees the resulting bearer token at request time.
 */

/**
 * Decoded WorkOS token claims. WorkOS issues JWTs that include the
 * standard sub/email/iss/aud plus custom claims for the user's
 * organization id and role within that organization.
 */
export interface WorkOSClaims {
    sub: string;
    email: string;
    /** WorkOS organization id — maps to NanoRun tenant */
    organization_id: string;
    /** WorkOS-side role string. Defaults to 'member'. */
    role?: string;
    /** Issued-at timestamp (epoch seconds) */
    iat: number;
    /** Expiration timestamp (epoch seconds) */
    exp: number;
}

export type VerifyJwksTokenFn = (token: string) => Promise<WorkOSClaims | null>;

export interface WorkOSAuthProviderOptions {
    /**
     * Function that verifies a WorkOS-issued token against the WorkOS
     * JWKS endpoint and returns the decoded claims (or null on
     * failure). Production passes a real implementation backed by
     * `fetch('https://api.workos.com/sso/jwks/<client_id>')`. Tests
     * pass a fake.
     */
    verifyJwksToken: VerifyJwksTokenFn;

    /**
     * Map a WorkOS role string to a NanoRun role. Defaults to
     * `(role) => role ?? 'USER'`. Override for tenants that use
     * custom WorkOS roles.
     */
    mapRole?: (workosRole: string | undefined) => string;
}

export class WorkOSAuthProvider implements AuthProvider {
    readonly name = 'workos';

    private readonly verifyJwksToken: VerifyJwksTokenFn;
    private readonly mapRole: (workosRole: string | undefined) => string;

    constructor(
        private readonly prisma: PrismaClient,
        options: WorkOSAuthProviderOptions,
    ) {
        this.verifyJwksToken = options.verifyJwksToken;
        this.mapRole = options.mapRole ?? ((role) => role ?? 'USER');
    }

    async verifyToken(token: string): Promise<AuthenticatedUser | null> {
        let claims: WorkOSClaims | null;
        try {
            claims = await this.verifyJwksToken(token);
        } catch (err) {
            // Transport-level failure (WorkOS unreachable) is different
            // from a bad token. The middleware translates this into 503
            // so clients know to retry rather than re-authenticate.
            throw new AuthTransportError(
                err instanceof Error ? err.message : 'WorkOS verify failed',
                this.name,
            );
        }
        if (!claims) return null;

        // Resolve the NanoRun tenant from the WorkOS organization id.
        // The tenants table has a workosOrganizationId column added by
        // the cloud beta migration; until that lands, this lookup
        // returns null and the request fails closed.
        const tenant = await this.findTenantByWorkOSOrgId(claims.organization_id);
        if (!tenant) return null;

        // Upsert the user row. WorkOS owns identity (email, sub) and
        // we mirror it locally so RBAC and per-tenant resources can
        // join against User.id.
        const mappedRole = this.mapRole(claims.role) as Role;
        const user = await this.prisma.user.upsert({
            where: { email: claims.email },
            create: {
                email: claims.email,
                name: claims.email,
                passwordHash: '',
                tenantId: tenant.id,
                role: mappedRole,
            },
            update: {
                tenantId: tenant.id,
                role: mappedRole,
            },
        });

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            provider: this.name,
        };
    }

    /**
     * Look up the NanoRun tenant by WorkOS organization id. Returns
     * null when no tenant is linked to the org — verifyToken turns
     * that into a 401, which is the fail-closed default for "WorkOS
     * knows the user but the user belongs to an org we don't host".
     *
     * The lookup uses the unique index added by the
     * `add_tenant_external_ids` migration so it is a single-row
     * point query, fast on every request.
     */
    private async findTenantByWorkOSOrgId(orgId: string): Promise<{ id: string } | null> {
        if (!orgId) return null;
        return this.prisma.tenant.findUnique({
            where: { workosOrganizationId: orgId },
            select: { id: true },
        });
    }
}
