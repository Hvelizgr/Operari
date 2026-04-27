/**
 * OAuth 2 provider registry.
 *
 * Each provider declares the three URLs needed to complete the
 * Authorization Code flow plus the shape of the `user info` response
 * normalized to `{ providerId, email, name }`. Credentials are read
 * lazily from `process.env` so a provider can stay unconfigured
 * without crashing the boot — unconfigured callbacks return 501.
 *
 * We intentionally do NOT use passport.js. The flow is ~4 fetch calls
 * per sign-in and passport's global strategy registration pulls in
 * session middleware we don't need (we own session state via our own
 * JWT cookie). Manual is ~60 lines and keeps the auth boundary small
 * enough to audit in one sitting.
 */

export type OAuthProviderName = 'google' | 'github';

export interface OAuthProviderConfig {
  name: OAuthProviderName;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  /** Parse the provider-specific userInfo response into our shape. */
  parseUserInfo: (raw: unknown) => OAuthProfile | null;
  /**
   * GitHub's `/user` endpoint hides the primary email when the user
   * marks it private, so we need a second fetch to `/user/emails`.
   * Google returns the email inline in the first call, so this is
   * a no-op for google. Receives the access token, returns an email
   * or null.
   */
  fetchFallbackEmail?: (accessToken: string) => Promise<string | null>;
}

export interface OAuthProfile {
  providerId: string;
  email: string | null;
  name: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export const PROVIDERS: Record<OAuthProviderName, OAuthProviderConfig> = {
  google: {
    name: 'google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    parseUserInfo: raw => {
      const obj = asRecord(raw);
      if (!obj) return null;
      const sub = typeof obj.sub === 'string' ? obj.sub : null;
      if (!sub) return null;
      return {
        providerId: sub,
        email: typeof obj.email === 'string' ? obj.email : null,
        name:
          typeof obj.name === 'string'
            ? obj.name
            : typeof obj.given_name === 'string'
              ? obj.given_name
              : null,
      };
    },
  },
  github: {
    name: 'github',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    parseUserInfo: raw => {
      const obj = asRecord(raw);
      if (!obj) return null;
      const id = typeof obj.id === 'number' || typeof obj.id === 'string' ? String(obj.id) : null;
      if (!id) return null;
      return {
        providerId: id,
        email: typeof obj.email === 'string' ? obj.email : null,
        name:
          typeof obj.name === 'string'
            ? obj.name
            : typeof obj.login === 'string'
              ? obj.login
              : null,
      };
    },
    fetchFallbackEmail: async accessToken => {
      const res = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'operari-oauth',
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as unknown;
      if (!Array.isArray(body)) return null;
      const primary = body.find(entry => {
        const obj = asRecord(entry);
        return (
          obj && obj.primary === true && obj.verified === true && typeof obj.email === 'string'
        );
      });
      if (primary) {
        const obj = asRecord(primary);
        return obj && typeof obj.email === 'string' ? obj.email : null;
      }
      const anyVerified = body.find(entry => {
        const obj = asRecord(entry);
        return obj && obj.verified === true && typeof obj.email === 'string';
      });
      const obj = asRecord(anyVerified);
      return obj && typeof obj.email === 'string' ? obj.email : null;
    },
  },
};

export function isProviderConfigured(name: OAuthProviderName): boolean {
  const p = PROVIDERS[name];
  return Boolean(p.clientId() && p.clientSecret());
}
