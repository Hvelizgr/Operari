/**
 * "Connect with…" for integration credentials (not sign-in): the user
 * authorizes Operari once, the refresh token is stored encrypted, and the
 * access token is renewed before a step reads it. Covers the providers whose
 * access tokens expire (Google, Microsoft ~1 h) or that only issue tokens
 * through OAuth.
 *
 * Each provider is configured with OAUTH_<ID>_CLIENT_ID / _CLIENT_SECRET.
 * Google falls back to the sign-in app (GOOGLE_CLIENT_ID / _SECRET); its
 * console must also list the connect callback as a redirect URI.
 */

export interface OAuthConnectProvider {
  id: string;
  label: string;
  authorizeUrl: () => string;
  tokenUrl: () => string;
  scopes: string[];
  scopeSeparator?: string;
  /** Asks for a refresh token / offline access. */
  extraAuthorizeParams?: Record<string, string>;
  /** `basic`: client credentials in the Authorization header (Zoom). */
  clientAuth?: 'body' | 'basic';
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  /** Display name from the token response, when the provider includes one. */
  describe?: (token: Record<string, unknown>) => string | null;
}

function env(id: string, key: 'CLIENT_ID' | 'CLIENT_SECRET'): string | undefined {
  return process.env[`OAUTH_${id.toUpperCase()}_${key}`] || undefined;
}

function scopesFor(id: string, fallback: string[]): string[] {
  const raw = process.env[`OAUTH_${id.toUpperCase()}_SCOPES`];
  return raw ? raw.split(/[\s,]+/).filter(Boolean) : fallback;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

const MICROSOFT_TENANT = () => process.env.OAUTH_MICROSOFT_TENANT || 'common';
const ZOHO_ACCOUNTS = () =>
  (process.env.OAUTH_ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/$/, '');

export const CONNECT_PROVIDERS: Record<string, OAuthConnectProvider> = {
  google: {
    id: 'google',
    label: 'Google',
    authorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scopes: scopesFor('google', [
      'openid',
      'email',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.send',
    ]),
    // prompt=consent: Google only returns a refresh token on the first
    // consent unless asked again.
    extraAuthorizeParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
    clientId: () => env('google', 'CLIENT_ID') ?? process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => env('google', 'CLIENT_SECRET') ?? process.env.GOOGLE_CLIENT_SECRET,
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft 365',
    authorizeUrl: () =>
      `https://login.microsoftonline.com/${MICROSOFT_TENANT()}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${MICROSOFT_TENANT()}/oauth2/v2.0/token`,
    scopes: scopesFor('microsoft', [
      'offline_access',
      'openid',
      'email',
      'User.Read',
      'Mail.Send',
      'Mail.ReadWrite',
      'Files.ReadWrite.All',
      'Calendars.ReadWrite',
      'ChannelMessage.Send',
    ]),
    clientId: () => env('microsoft', 'CLIENT_ID'),
    clientSecret: () => env('microsoft', 'CLIENT_SECRET'),
  },
  slack: {
    id: 'slack',
    label: 'Slack',
    authorizeUrl: () => 'https://slack.com/oauth/v2/authorize',
    tokenUrl: () => 'https://slack.com/api/oauth.v2.access',
    scopes: scopesFor('slack', [
      'chat:write',
      'chat:write.public',
      'channels:read',
      'groups:read',
      'users:read',
      'files:write',
      'reactions:write',
    ]),
    scopeSeparator: ',',
    clientId: () => env('slack', 'CLIENT_ID'),
    clientSecret: () => env('slack', 'CLIENT_SECRET'),
    describe: t => {
      const team = t.team as Record<string, unknown> | undefined;
      return str(team?.name);
    },
  },
  hubspot: {
    id: 'hubspot',
    label: 'HubSpot',
    authorizeUrl: () => 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: () => 'https://api.hubapi.com/oauth/v1/token',
    scopes: scopesFor('hubspot', [
      'oauth',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
    ]),
    clientId: () => env('hubspot', 'CLIENT_ID'),
    clientSecret: () => env('hubspot', 'CLIENT_SECRET'),
  },
  salesforce: {
    id: 'salesforce',
    label: 'Salesforce',
    authorizeUrl: () =>
      `${(process.env.OAUTH_SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '')}/services/oauth2/authorize`,
    tokenUrl: () =>
      `${(process.env.OAUTH_SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '')}/services/oauth2/token`,
    scopes: scopesFor('salesforce', ['api', 'refresh_token', 'offline_access']),
    clientId: () => env('salesforce', 'CLIENT_ID'),
    clientSecret: () => env('salesforce', 'CLIENT_SECRET'),
    describe: t => {
      const url = str(t.instance_url);
      return url ? new URL(url).host : null;
    },
  },
  zoom: {
    id: 'zoom',
    label: 'Zoom',
    authorizeUrl: () => 'https://zoom.us/oauth/authorize',
    tokenUrl: () => 'https://zoom.us/oauth/token',
    // Zoom takes scopes from the app configuration.
    scopes: scopesFor('zoom', []),
    clientAuth: 'basic',
    clientId: () => env('zoom', 'CLIENT_ID'),
    clientSecret: () => env('zoom', 'CLIENT_SECRET'),
  },
  dropbox: {
    id: 'dropbox',
    label: 'Dropbox',
    authorizeUrl: () => 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: () => 'https://api.dropboxapi.com/oauth2/token',
    scopes: scopesFor('dropbox', [
      'account_info.read',
      'files.metadata.read',
      'files.content.read',
      'files.content.write',
      'sharing.write',
    ]),
    extraAuthorizeParams: { token_access_type: 'offline' },
    clientId: () => env('dropbox', 'CLIENT_ID'),
    clientSecret: () => env('dropbox', 'CLIENT_SECRET'),
  },
  zoho: {
    id: 'zoho',
    label: 'Zoho',
    authorizeUrl: () => `${ZOHO_ACCOUNTS()}/oauth/v2/auth`,
    tokenUrl: () => `${ZOHO_ACCOUNTS()}/oauth/v2/token`,
    scopes: scopesFor('zoho', ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.READ']),
    scopeSeparator: ',',
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
    clientId: () => env('zoho', 'CLIENT_ID'),
    clientSecret: () => env('zoho', 'CLIENT_SECRET'),
  },
};

export function connectProvider(id: string): OAuthConnectProvider | null {
  return Object.prototype.hasOwnProperty.call(CONNECT_PROVIDERS, id) ? CONNECT_PROVIDERS[id] : null;
}

export function isConfigured(p: OAuthConnectProvider): boolean {
  return !!p.clientId() && !!p.clientSecret();
}

export function authorizeUrl(p: OAuthConnectProvider, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: p.clientId() ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    ...(p.extraAuthorizeParams ?? {}),
  });
  if (p.scopes.length) params.set('scope', p.scopes.join(p.scopeSeparator ?? ' '));
  return `${p.authorizeUrl()}?${params.toString()}`;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[] | null;
  raw: Record<string, unknown>;
}

export class OAuthTokenError extends Error {
  constructor(
    message: string,
    /** invalid_grant: the refresh token was revoked or expired; reconnecting is the only fix. */
    readonly revoked = false
  ) {
    super(message);
    this.name = 'OAuthTokenError';
  }
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

async function tokenRequest(
  p: OAuthConnectProvider,
  body: Record<string, string>,
  fetchImpl: FetchFn,
  now: number
): Promise<TokenSet> {
  const form = new URLSearchParams(body);
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };
  if (p.clientAuth === 'basic') {
    headers.authorization =
      'Basic ' + Buffer.from(`${p.clientId() ?? ''}:${p.clientSecret() ?? ''}`).toString('base64');
  } else {
    form.set('client_id', p.clientId() ?? '');
    form.set('client_secret', p.clientSecret() ?? '');
  }
  let res: Response;
  try {
    res = await fetchImpl(p.tokenUrl(), { method: 'POST', headers, body: form.toString() });
  } catch (err) {
    throw new OAuthTokenError(`${p.label} token endpoint unreachable: ${(err as Error).message}`);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Slack answers 200 with { ok: false, error } instead of an HTTP error.
  const error = str(json.error) ?? (json.ok === false ? 'slack_error' : null);
  if (!res.ok || error) {
    throw new OAuthTokenError(
      `${p.label} token request failed: ${error ?? `HTTP ${res.status}`}${
        str(json.error_description) ? ` (${json.error_description})` : ''
      }`,
      error === 'invalid_grant' || error === 'invalid_refresh_token'
    );
  }
  const accessToken = str(json.access_token);
  if (!accessToken) throw new OAuthTokenError(`${p.label} returned no access token`);
  const expiresIn = Number(json.expires_in);
  const scope = str(json.scope);
  return {
    accessToken,
    refreshToken: str(json.refresh_token),
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(now + expiresIn * 1000) : null,
    scopes: scope ? scope.split(/[\s,]+/).filter(Boolean) : null,
    raw: json,
  };
}

export function exchangeCode(
  p: OAuthConnectProvider,
  code: string,
  redirectUri: string,
  fetchImpl: FetchFn = fetch,
  now = Date.now()
): Promise<TokenSet> {
  return tokenRequest(
    p,
    { grant_type: 'authorization_code', code, redirect_uri: redirectUri },
    fetchImpl,
    now
  );
}

export function refreshTokens(
  p: OAuthConnectProvider,
  refreshToken: string,
  fetchImpl: FetchFn = fetch,
  now = Date.now()
): Promise<TokenSet> {
  return tokenRequest(
    p,
    { grant_type: 'refresh_token', refresh_token: refreshToken },
    fetchImpl,
    now
  );
}
