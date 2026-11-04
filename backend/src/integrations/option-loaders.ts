/**
 * Dynamic option lists for step forms ("pick a Slack channel" instead of
 * typing its id). Each loader is a fixed, read-only call to one provider
 * API: the editor sends a connected-account id, a loader id and a few
 * validated parameters, never a URL, so this cannot be turned into a
 * generic proxy for the stored credentials.
 */

export interface LoadedOption {
  name: string;
  value: string;
  /** Other form fields to fill when this option is picked (GitHub owner). */
  also?: Record<string, string>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface OptionLoader {
  id: string;
  /** ConnectedAccount.provider the credential must have. */
  provider: string;
  /** Form fields the loader needs, each with the pattern it must match. */
  params?: Record<string, RegExp>;
  load(ctx: {
    secret: string;
    params: Record<string, string>;
    fetch: FetchFn;
  }): Promise<LoadedOption[]>;
}

export class OptionLoaderError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = 'OptionLoaderError';
  }
}

const MAX_OPTIONS = 1000;

async function getJson(
  fetchImpl: FetchFn,
  url: string,
  init: RequestInit,
  label: string
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok === false) {
    const detail =
      (typeof json.error === 'string' && json.error) ||
      (typeof json.message === 'string' && json.message) ||
      `HTTP ${res.status}`;
    throw new OptionLoaderError(
      `${label}: ${detail}`,
      res.status === 401 || res.status === 403 ? 400 : 502
    );
  }
  return json;
}

const bearer = (secret: string, extra: Record<string, string> = {}) => ({
  headers: { authorization: `Bearer ${secret}`, accept: 'application/json', ...extra },
});

const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter(x => x && typeof x === 'object') as Record<string, unknown>[]) : [];
const s = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

async function slackPaged(
  fetchImpl: FetchFn,
  secret: string,
  method: string,
  query: string,
  key: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor = '';
  for (let page = 0; page < 10 && out.length < MAX_OPTIONS; page++) {
    const json = await getJson(
      fetchImpl,
      `https://slack.com/api/${method}?${query}&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      bearer(secret),
      'Slack'
    );
    out.push(...arr(json[key]));
    cursor = s((json.response_metadata as Record<string, unknown> | undefined)?.next_cursor);
    if (!cursor) break;
  }
  return out;
}

const LOADERS: OptionLoader[] = [
  {
    id: 'slack.channels',
    provider: 'slack',
    async load({ secret, fetch }) {
      const rows = await slackPaged(
        fetch,
        secret,
        'conversations.list',
        'types=public_channel,private_channel&exclude_archived=true',
        'channels'
      );
      return rows.map(c => ({ name: `#${s(c.name)}`, value: s(c.id) }));
    },
  },
  {
    id: 'slack.users',
    provider: 'slack',
    async load({ secret, fetch }) {
      const rows = await slackPaged(fetch, secret, 'users.list', '', 'members');
      return rows
        .filter(u => !u.deleted && !u.is_bot && s(u.id) !== 'USLACKBOT')
        .map(u => ({ name: s(u.real_name) || `@${s(u.name)}`, value: s(u.id) }));
    },
  },
  {
    id: 'github.repos',
    provider: 'github',
    async load({ secret, fetch }) {
      const out: LoadedOption[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await fetch(
          `https://api.github.com/user/repos?per_page=100&sort=pushed&page=${page}`,
          {
            ...bearer(secret, { 'x-github-api-version': '2022-11-28' }),
            signal: AbortSignal.timeout(10_000),
          }
        );
        if (!res.ok)
          throw new OptionLoaderError(`GitHub: HTTP ${res.status}`, res.status === 401 ? 400 : 502);
        const rows = arr(await res.json());
        out.push(
          ...rows.map(r => ({
            name: s(r.full_name),
            value: s(r.name),
            also: { owner: s((r.owner as Record<string, unknown> | undefined)?.login) },
          }))
        );
        if (rows.length < 100) break;
      }
      return out;
    },
  },
  {
    id: 'notion.databases',
    provider: 'notion',
    async load({ secret, fetch }) {
      const json = await getJson(
        fetch,
        'https://api.notion.com/v1/search',
        {
          method: 'POST',
          ...bearer(secret, { 'notion-version': '2022-06-28', 'content-type': 'application/json' }),
          body: JSON.stringify({
            filter: { property: 'object', value: 'database' },
            page_size: 100,
          }),
        },
        'Notion'
      );
      return arr(json.results).map(d => ({
        name:
          arr(d.title)
            .map(t => s(t.plain_text))
            .join('') || s(d.id),
        value: s(d.id),
      }));
    },
  },
  {
    id: 'google.calendars',
    provider: 'google',
    async load({ secret, fetch }) {
      const json = await getJson(
        fetch,
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
        bearer(secret),
        'Google Calendar'
      );
      return arr(json.items).map(c => ({
        name: s(c.summaryOverride) || s(c.summary),
        value: s(c.id),
      }));
    },
  },
  {
    id: 'microsoft.teams',
    provider: 'microsoft',
    async load({ secret, fetch }) {
      const json = await getJson(
        fetch,
        'https://graph.microsoft.com/v1.0/me/joinedTeams',
        bearer(secret),
        'Microsoft Teams'
      );
      return arr(json.value).map(t => ({ name: s(t.displayName), value: s(t.id) }));
    },
  },
  {
    id: 'microsoft.channels',
    provider: 'microsoft',
    params: { teamId: /^[0-9a-fA-F-]{36}$/ },
    async load({ secret, params, fetch }) {
      const json = await getJson(
        fetch,
        `https://graph.microsoft.com/v1.0/teams/${params.teamId}/channels`,
        bearer(secret),
        'Microsoft Teams'
      );
      return arr(json.value).map(c => ({ name: s(c.displayName), value: s(c.id) }));
    },
  },
  {
    id: 'jira.projects',
    provider: 'jira',
    params: {
      site: /^[a-z0-9][a-z0-9-]{0,62}(\.atlassian\.net)?$/i,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    async load({ secret, params, fetch }) {
      const site = params.site.replace(/\.atlassian\.net$/i, '');
      const json = await getJson(
        fetch,
        `https://${site}.atlassian.net/rest/api/3/project/search?maxResults=100`,
        {
          headers: {
            authorization: 'Basic ' + Buffer.from(`${params.email}:${secret}`).toString('base64'),
            accept: 'application/json',
          },
        },
        'Jira'
      );
      return arr(json.values).map(p => ({ name: `${s(p.key)} — ${s(p.name)}`, value: s(p.key) }));
    },
  },
];

const BY_ID = new Map(LOADERS.map(l => [l.id, l]));

export function optionLoader(id: string): OptionLoader | null {
  return BY_ID.get(id) ?? null;
}

export function validateParams(loader: OptionLoader, raw: unknown): Record<string, string> {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [name, pattern] of Object.entries(loader.params ?? {})) {
    const value = typeof input[name] === 'string' ? (input[name] as string).trim() : '';
    if (!pattern.test(value)) {
      throw new OptionLoaderError(`Fill in "${name}" first`, 400);
    }
    out[name] = value;
  }
  return out;
}

export async function loadOptions(
  loader: OptionLoader,
  secret: string,
  params: Record<string, string>,
  fetchImpl: FetchFn = fetch
): Promise<LoadedOption[]> {
  const options = await loader.load({ secret, params, fetch: fetchImpl });
  return options
    .filter(o => o.value)
    .slice(0, MAX_OPTIONS)
    .sort((a, b) => a.name.localeCompare(b.name));
}
