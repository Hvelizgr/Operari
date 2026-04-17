import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { OAuthProfile, OAuthProviderConfig } from './providers';

export interface OAuthExchangeDeps {
    fetchImpl?: typeof fetch;
}

export interface OAuthResolvedUser {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
    name: string | null;
}

export function newState(): string {
    return randomBytes(24).toString('base64url');
}

/**
 * Build the provider authorize URL with the required OAuth 2 params.
 * `state` doubles as CSRF token — the caller stores it in an HttpOnly
 * cookie that the callback route cross-checks against the `state`
 * returned by the provider.
 */
export function buildAuthorizeUrl(
    provider: OAuthProviderConfig,
    redirectUri: string,
    state: string,
): string {
    const clientId = provider.clientId();
    if (!clientId) throw new Error(`${provider.name} is not configured`);
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: provider.scopes.join(' '),
        state,
    });
    if (provider.name === 'google') {
        // Force refresh token + account selector so repeat sign-ins can
        // switch accounts without clearing the browser's Google cookie.
        params.set('access_type', 'online');
        params.set('prompt', 'select_account');
    }
    if (provider.name === 'github') {
        params.set('allow_signup', 'true');
    }
    return `${provider.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an auth code for an access token and fetch the user
 * profile. Does NOT touch the database — that's the caller's job so
 * linking logic stays in one place.
 */
export async function exchangeCode(
    provider: OAuthProviderConfig,
    code: string,
    redirectUri: string,
    deps: OAuthExchangeDeps = {},
): Promise<OAuthProfile> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const clientId = provider.clientId();
    const clientSecret = provider.clientSecret();
    if (!clientId || !clientSecret) {
        throw new Error(`${provider.name} is not configured`);
    }

    const tokenRes = await fetchImpl(provider.tokenUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
        }).toString(),
    });
    if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => '');
        throw new Error(`${provider.name} token exchange failed: ${tokenRes.status} ${body}`);
    }
    const tokenBody = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenBody.access_token;
    if (!accessToken) throw new Error(`${provider.name} returned no access_token`);

    const userRes = await fetchImpl(provider.userInfoUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'nanorun-oauth',
            Accept: 'application/vnd.github+json',
        },
    });
    if (!userRes.ok) {
        const body = await userRes.text().catch(() => '');
        throw new Error(`${provider.name} userinfo failed: ${userRes.status} ${body}`);
    }
    const rawUser = (await userRes.json()) as unknown;
    const profile = provider.parseUserInfo(rawUser);
    if (!profile) throw new Error(`${provider.name} userinfo was unparseable`);

    if (!profile.email && provider.fetchFallbackEmail) {
        profile.email = await provider.fetchFallbackEmail(accessToken);
    }
    return profile;
}

/**
 * Look up or create a User from an OAuth profile.
 *
 * Linking rules (account linking model):
 *   1. OAuthAccount row with matching (provider, providerId) → reuse its user
 *   2. User with matching email (case-insensitive) but no OAuthAccount
 *      for this provider → create the OAuthAccount row and reuse the user.
 *      This is the flow where someone already registered with password,
 *      then clicks "Continue with Google" using the same address.
 *   3. Neither → brand-new Tenant + User + OAuthAccount. Tenant defaults
 *      to "`{name}`'s workspace" so the dashboard isn't empty-titled.
 */
export async function resolveOAuthUser(
    prisma: PrismaClient,
    profile: OAuthProfile,
    provider: string,
): Promise<OAuthResolvedUser> {
    if (!profile.email) {
        throw new Error('OAuth profile has no email');
    }

    const existingLink = await prisma.oAuthAccount.findUnique({
        where: { provider_providerId: { provider, providerId: profile.providerId } },
        include: { user: true },
    });
    if (existingLink) {
        const u = existingLink.user;
        return { userId: u.id, tenantId: u.tenantId, email: u.email, role: u.role, name: u.name };
    }

    const byEmail = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
    if (byEmail) {
        await prisma.oAuthAccount.create({
            data: { provider, providerId: profile.providerId, userId: byEmail.id },
        });
        return {
            userId: byEmail.id,
            tenantId: byEmail.tenantId,
            email: byEmail.email,
            role: byEmail.role,
            name: byEmail.name,
        };
    }

    const displayName = profile.name?.trim() || profile.email.split('@')[0] || 'Workspace';
    const tenantBase = displayName.replace(/\s+/g, '-').toLowerCase();
    const tenant = await prisma.tenant.create({
        data: {
            name: `${displayName}'s workspace`,
            slug: `${tenantBase}-${Date.now()}`,
        },
    });
    const user = await prisma.user.create({
        data: {
            email: profile.email.toLowerCase(),
            name: profile.name,
            role: 'ADMIN',
            tenantId: tenant.id,
            oauthAccounts: {
                create: { provider, providerId: profile.providerId },
            },
        },
    });
    return { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role, name: user.name };
}
