/**
 * "Test credential": one fixed, read-only call per provider that proves the
 * stored secret works and says whose it is. Like the option loaders, the
 * client only names the account; URLs live here, so the check cannot aim a
 * secret at another host.
 */

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface CheckResult {
  ok: boolean;
  /** Who the credential belongs to, when the provider says. */
  identity?: string;
  error?: string;
}

interface CredentialCheck {
  url: string | ((meta: Record<string, unknown>) => string | null);
  headers: (secret: string) => Record<string, string>;
  method?: 'GET' | 'POST';
  identity?: (body: Record<string, unknown>) => string | undefined;
  /** Some APIs answer 200 with an error flag (Slack). */
  bodyError?: (body: Record<string, unknown>) => string | undefined;
}

const bearer = (secret: string) => ({ authorization: `Bearer ${secret}` });
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

const CHECKS: Record<string, CredentialCheck> = {
  github: {
    url: 'https://api.github.com/user',
    headers: s => ({ ...bearer(s), 'x-github-api-version': '2022-11-28' }),
    identity: b => str(b.login),
  },
  slack: {
    url: 'https://slack.com/api/auth.test',
    method: 'POST',
    headers: bearer,
    identity: b => [str(b.team), str(b.user)].filter(Boolean).join(' / ') || undefined,
    bodyError: b => (b.ok === false ? (str(b.error) ?? 'auth.test failed') : undefined),
  },
  google: {
    url: 'https://openidconnect.googleapis.com/v1/userinfo',
    headers: bearer,
    identity: b => str(b.email),
  },
  microsoft: {
    url: 'https://graph.microsoft.com/v1.0/me',
    headers: bearer,
    identity: b => str(b.userPrincipalName) ?? str(b.mail),
  },
  notion: {
    url: 'https://api.notion.com/v1/users/me',
    headers: s => ({ ...bearer(s), 'notion-version': '2022-06-28' }),
    identity: b => str(b.name),
  },
  hubspot: {
    url: 'https://api.hubapi.com/account-info/v3/details',
    headers: bearer,
    identity: b => (b.portalId !== undefined ? `portal ${String(b.portalId)}` : undefined),
  },
  dropbox: {
    url: 'https://api.dropboxapi.com/2/users/get_current_account',
    method: 'POST',
    headers: bearer,
    identity: b => str(b.email),
  },
  zoom: {
    url: 'https://api.zoom.us/v2/users/me',
    headers: bearer,
    identity: b => str(b.email),
  },
  stripe: {
    url: 'https://api.stripe.com/v1/balance',
    headers: bearer,
    identity: b =>
      b.livemode === true ? 'live mode' : b.livemode === false ? 'test mode' : undefined,
  },
  salesforce: {
    url: meta => {
      const base = str(meta.instanceUrl);
      if (!base) return null;
      const u = new URL(base);
      return u.protocol === 'https:' && u.hostname.endsWith('.salesforce.com')
        ? `${u.origin}/services/oauth2/userinfo`
        : null;
    },
    headers: bearer,
    identity: b => str(b.preferred_username) ?? str(b.email),
  },
  'ai.anthropic': {
    url: 'https://api.anthropic.com/v1/models?limit=1',
    headers: s => ({ 'x-api-key': s, 'anthropic-version': '2023-06-01' }),
  },
  'ai.openai': {
    url: 'https://api.openai.com/v1/models',
    headers: bearer,
  },
  // Base URL from the account; the route sends every check through the
  // SSRF guard, so it cannot reach private addresses.
  'ai.openai-compatible': {
    url: meta => {
      const base = str(meta.baseUrl);
      if (!base) return null;
      const u = new URL(base);
      return u.protocol === 'https:' || u.protocol === 'http:'
        ? `${base.replace(/\/$/, '')}/models`
        : null;
    },
    headers: bearer,
  },
};

export function canCheck(provider: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHECKS, provider);
}

export async function checkCredential(
  provider: string,
  secret: string,
  metadata: Record<string, unknown>,
  fetchImpl: FetchFn = fetch
): Promise<CheckResult> {
  const check = CHECKS[provider];
  if (!check) return { ok: false, error: `No test is defined for ${provider} credentials` };
  const url = typeof check.url === 'string' ? check.url : check.url(metadata);
  if (!url)
    return { ok: false, error: 'This credential is missing the instance URL needed to test it' };
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: check.method ?? 'GET',
      headers: { accept: 'application/json', ...check.headers(secret) },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, error: `Could not reach the provider: ${(err as Error).message}` };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail =
      str((body.error as Record<string, unknown> | undefined)?.message) ??
      str(body.message) ??
      str(body.error) ??
      `HTTP ${res.status}`;
    return {
      ok: false,
      error:
        res.status === 401 || res.status === 403 ? `Rejected by the provider: ${detail}` : detail,
    };
  }
  const bodyError = check.bodyError?.(body);
  if (bodyError) return { ok: false, error: `Rejected by the provider: ${bodyError}` };
  return { ok: true, identity: check.identity?.(body) };
}
