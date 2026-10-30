import {
  apiNode,
  basic,
  baseUrl,
  type CatalogNode,
  type CatalogProperty,
  enc,
  MAIN,
} from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'monitoring',
  icon,
  color: 'bg-orange-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const base = (description: string): CatalogProperty => ({
  name: 'baseUrl',
  displayName: 'Base URL',
  type: 'string',
  required: true,
  description,
});

/** Optional bearer token or user:password, as most self-hosted stacks accept either. */
const auth: CatalogProperty[] = [
  {
    name: 'token',
    displayName: 'Bearer token',
    type: 'secret',
    description: 'Leave empty if the endpoint is open.',
  },
  { name: 'username', displayName: 'Basic auth user', type: 'string' },
  { name: 'password', displayName: 'Basic auth password', type: 'secret' },
];

function authHeader(t: { str(n: string): string }): Record<string, string> {
  if (t.str('token')) return { Authorization: `Bearer ${t.str('token')}` };
  if (t.str('username')) return { Authorization: basic(t.str('username'), t.str('password')) };
  return {};
}

/** RFC 3339 for absolute times, or "now-15m"-style relative offsets. */
function timeArg(raw: string, fallbackMsAgo: number): Date {
  const v = raw.trim();
  if (!v) return new Date(Date.now() - fallbackMsAgo);
  if (v === 'now') return new Date();
  const rel = /^now-(\d+)([smhd])$/.exec(v);
  if (rel) {
    const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[rel[2] as 's' | 'm' | 'h' | 'd'];
    return new Date(Date.now() - Number(rel[1]) * unit);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime()))
    throw new Error(`"${raw}" is not a time (use RFC 3339 or now-15m)`);
  return d;
}

export const MONITORING_NODES: CatalogNode[] = [
  apiNode({
    ...meta(
      'prometheus.query',
      'Flame',
      ['Prometheus query', 'Consulta Prometheus'],
      [
        'Run a PromQL instant query and get the result vector',
        'Ejecutar una consulta PromQL instantánea y obtener el vector',
      ]
    ),
    properties: [
      base('e.g. https://prometheus.example.com'),
      {
        name: 'query',
        displayName: 'PromQL',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
        description: 'e.g. sum(rate(http_requests_total{status=~"5.."}[5m]))',
      },
      ...auth,
    ],
    request: t => ({
      method: 'GET',
      url: `${baseUrl(t.str('baseUrl'))}/api/v1/query?query=${enc(t.str('query'))}`,
      headers: authHeader(t),
      describe: `Prometheus query ${t.str('query').slice(0, 120)}`,
    }),
    bodyError: body => {
      const b = body as { status?: string; error?: string };
      return b?.status === 'error' ? (b.error ?? 'query failed') : null;
    },
    shape: (body, status) => {
      const data =
        (
          (body ?? {}) as {
            data?: { resultType?: string; result?: Array<{ value?: [number, string] }> };
          }
        ).data ?? {};
      const result = data.result ?? [];
      const first = result[0]?.value?.[1];
      return {
        status,
        resultType: data.resultType,
        result,
        count: result.length,
        value: first !== undefined ? Number(first) : null,
      };
    },
  }),
  apiNode({
    ...meta(
      'alertmanager.silence',
      'BellOff',
      ['Alertmanager silence', 'Silencio en Alertmanager'],
      [
        'Silence matching alerts for a while (maintenance windows, known incidents)',
        'Silenciar alertas coincidentes durante un tiempo (mantenimientos, incidentes conocidos)',
      ]
    ),
    properties: [
      base('e.g. https://alertmanager.example.com'),
      {
        name: 'matchers',
        displayName: 'Matchers',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
        description: 'One per line: label=value, label!=value, label=~regex',
      },
      { name: 'durationMinutes', displayName: 'Duration (minutes)', type: 'number', default: 60 },
      {
        name: 'comment',
        displayName: 'Comment',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      { name: 'createdBy', displayName: 'Created by', type: 'string', default: 'operari' },
      ...auth,
    ],
    request: t => {
      const matchers = t
        .str('matchers')
        .split(/\n|,/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
          const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*(.*)$/.exec(line);
          if (!m) throw new Error(`matcher "${line}" must look like label=value`);
          const [, name, op, value] = m;
          return {
            name,
            value: value.replace(/^"|"$/g, ''),
            isRegex: op.includes('~'),
            isEqual: !op.startsWith('!'),
          };
        });
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + Math.max(1, t.num('durationMinutes')) * 60_000);
      return {
        method: 'POST',
        url: `${baseUrl(t.str('baseUrl'))}/api/v2/silences`,
        headers: authHeader(t),
        body: {
          matchers,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          createdBy: t.str('createdBy') || 'operari',
          comment: t.str('comment'),
        },
        describe: `Alertmanager silence ${matchers.map(m => m.name).join(',')} until ${endsAt.toISOString()}`,
      };
    },
    shape: (body, status) => ({ status, silenceId: (body as { silenceID?: string })?.silenceID }),
  }),
  apiNode({
    ...meta(
      'loki.query',
      'ScrollText',
      ['Loki log query', 'Consulta de logs en Loki'],
      [
        'Fetch log lines matching a LogQL query over a time range',
        'Traer líneas de log que cumplen una consulta LogQL en un rango de tiempo',
      ]
    ),
    properties: [
      base('e.g. https://loki.example.com'),
      {
        name: 'query',
        displayName: 'LogQL',
        type: 'string',
        required: true,
        typeOptions: { rows: 2, expression: true },
        description: 'e.g. {app="api"} |= "error"',
      },
      {
        name: 'start',
        displayName: 'From',
        type: 'string',
        default: 'now-1h',
        description: 'RFC 3339 or now-15m / now-1h / now-1d',
      },
      { name: 'end', displayName: 'To', type: 'string', default: 'now' },
      { name: 'limit', displayName: 'Max lines', type: 'number', default: 100 },
      {
        name: 'orgId',
        displayName: 'Tenant (X-Scope-OrgID)',
        type: 'string',
        description: 'Only for multi-tenant Loki.',
      },
      ...auth,
    ],
    request: t => {
      const ns = (d: Date) => `${d.getTime()}000000`;
      const params = new URLSearchParams({
        query: t.str('query'),
        start: ns(timeArg(t.str('start'), 3_600_000)),
        end: ns(timeArg(t.str('end'), 0)),
        limit: String(Math.max(1, t.num('limit'))),
        direction: 'backward',
      });
      return {
        method: 'GET',
        url: `${baseUrl(t.str('baseUrl'))}/loki/api/v1/query_range?${params}`,
        headers: {
          ...authHeader(t),
          ...(t.str('orgId') ? { 'X-Scope-OrgID': t.str('orgId') } : {}),
        },
        describe: `Loki query ${t.str('query').slice(0, 120)}`,
      };
    },
    shape: (body, status) => {
      const streams =
        (
          (body ?? {}) as {
            data?: {
              result?: Array<{ stream: Record<string, string>; values: [string, string][] }>;
            };
          }
        ).data?.result ?? [];
      const lines = streams
        .flatMap(s =>
          s.values.map(([ts, line]) => ({
            ts: new Date(Number(ts) / 1e6).toISOString(),
            line,
            labels: s.stream,
          }))
        )
        .sort((a, b) => (a.ts < b.ts ? 1 : -1));
      return { status, lines, count: lines.length };
    },
  }),
  apiNode({
    ...meta(
      'elasticsearch.request',
      'Search',
      ['Elasticsearch', 'Elasticsearch'],
      [
        'Search an index, or index / fetch a document (also OpenSearch)',
        'Buscar en un índice, o indexar / leer un documento (también OpenSearch)',
      ]
    ),
    properties: [
      base('e.g. https://es.example.com:9200'),
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'search',
        options: [
          { name: 'Search', value: 'search' },
          { name: 'Index a document', value: 'index' },
          { name: 'Get a document', value: 'get' },
        ],
      },
      { name: 'index', displayName: 'Index', type: 'string', required: true },
      {
        name: 'query',
        displayName: 'Query (JSON body)',
        type: 'string',
        default: '{"query": {"match_all": {}}, "size": 10}',
        typeOptions: { rows: 5, expression: true },
        displayOptions: { show: { action: ['search'] } },
      },
      {
        name: 'document',
        displayName: 'Document (JSON)',
        type: 'string',
        required: true,
        typeOptions: { rows: 5, expression: true },
        displayOptions: { show: { action: ['index'] } },
      },
      {
        name: 'id',
        displayName: 'Document id',
        type: 'string',
        description: 'Required to get; optional when indexing.',
        displayOptions: { show: { action: ['index', 'get'] } },
      },
      {
        name: 'apiKey',
        displayName: 'API key',
        type: 'secret',
        description: 'Sent as ApiKey; or use basic auth below.',
      },
      { name: 'username', displayName: 'Basic auth user', type: 'string' },
      { name: 'password', displayName: 'Basic auth password', type: 'secret' },
    ],
    request: t => {
      const root = `${baseUrl(t.str('baseUrl'))}/${enc(t.str('index'))}`;
      const headers: Record<string, string> = t.str('apiKey')
        ? { Authorization: `ApiKey ${t.str('apiKey')}` }
        : t.str('username')
          ? { Authorization: basic(t.str('username'), t.str('password')) }
          : {};
      const action = t.str('action');
      if (action === 'get') {
        if (!t.str('id')) return 'Document id is required to get a document';
        return {
          method: 'GET',
          url: `${root}/_doc/${enc(t.str('id'))}`,
          headers,
          describe: `Elasticsearch get ${t.str('index')}/${t.str('id')}`,
        };
      }
      if (action === 'index') {
        return {
          method: t.str('id') ? 'PUT' : 'POST',
          url: t.str('id') ? `${root}/_doc/${enc(t.str('id'))}` : `${root}/_doc`,
          headers,
          body: t.json('document', {}),
          describe: `Elasticsearch index into ${t.str('index')}`,
        };
      }
      return {
        method: 'POST',
        url: `${root}/_search`,
        headers,
        body: t.json('query', {}),
        describe: `Elasticsearch search ${t.str('index')}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as {
        hits?: {
          total?: { value?: number } | number;
          hits?: Array<{ _id: string; _source: unknown }>;
        };
        _id?: string;
        _source?: unknown;
        result?: string;
        found?: boolean;
      };
      if (b.hits) {
        const total = typeof b.hits.total === 'number' ? b.hits.total : (b.hits.total?.value ?? 0);
        return {
          status,
          total,
          hits: (b.hits.hits ?? []).map(h => ({ id: h._id, ...((h._source as object) ?? {}) })),
        };
      }
      return { status, id: b._id, result: b.result, found: b.found, document: b._source };
    },
  }),
  apiNode({
    ...meta(
      'sentry.action',
      'Bug',
      ['Sentry', 'Sentry'],
      [
        'Create a release or resolve / ignore an issue in Sentry',
        'Crear un release o resolver / ignorar un issue en Sentry',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'createRelease',
        options: [
          { name: 'Create release', value: 'createRelease' },
          { name: 'Resolve issue', value: 'resolve' },
          { name: 'Ignore issue', value: 'ignore' },
        ],
      },
      { name: 'token', displayName: 'Auth token', type: 'secret', required: true },
      {
        name: 'baseUrl',
        displayName: 'Sentry URL',
        type: 'string',
        default: 'https://sentry.io',
        description: 'Change for self-hosted or EU (https://de.sentry.io).',
      },
      {
        name: 'org',
        displayName: 'Organization slug',
        type: 'string',
        required: true,
        displayOptions: { show: { action: ['createRelease'] } },
      },
      {
        name: 'version',
        displayName: 'Release version',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['createRelease'] } },
      },
      {
        name: 'projects',
        displayName: 'Projects',
        type: 'string',
        required: true,
        description: 'Comma-separated project slugs.',
        displayOptions: { show: { action: ['createRelease'] } },
      },
      {
        name: 'issueId',
        displayName: 'Issue id',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['resolve', 'ignore'] } },
      },
    ],
    request: t => {
      const root = baseUrl(t.str('baseUrl'));
      const headers = { Authorization: `Bearer ${t.str('token')}` };
      if (t.str('action') === 'createRelease') {
        return {
          method: 'POST',
          url: `${root}/api/0/organizations/${enc(t.str('org'))}/releases/`,
          headers,
          body: { version: t.str('version'), projects: t.list('projects').map(String) },
          describe: `Sentry release ${t.str('version')}`,
        };
      }
      const status = t.str('action') === 'resolve' ? 'resolved' : 'ignored';
      return {
        method: 'PUT',
        url: `${root}/api/0/issues/${enc(t.str('issueId'))}/`,
        headers,
        body: { status },
        describe: `Sentry mark issue ${t.str('issueId')} ${status}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { version?: string; status?: string; url?: string };
      return { status, version: b.version, issueStatus: b.status, url: b.url };
    },
  }),
  apiNode({
    ...meta(
      'statuspage.incident',
      'Megaphone',
      ['Statuspage incident', 'Incidente en Statuspage'],
      [
        'Open or update an incident on an Atlassian Statuspage',
        'Abrir o actualizar un incidente en un Atlassian Statuspage',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'create',
        options: [
          { name: 'Create incident', value: 'create' },
          { name: 'Update incident', value: 'update' },
        ],
      },
      { name: 'apiKey', displayName: 'API key', type: 'secret', required: true },
      { name: 'pageId', displayName: 'Page id', type: 'string', required: true },
      {
        name: 'incidentId',
        displayName: 'Incident id',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['update'] } },
      },
      {
        name: 'name',
        displayName: 'Title',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['create'] } },
      },
      {
        name: 'status',
        displayName: 'Status',
        type: 'options',
        default: 'investigating',
        options: ['investigating', 'identified', 'monitoring', 'resolved'].map(v => ({
          name: v,
          value: v,
        })),
      },
      {
        name: 'body',
        displayName: 'Message',
        type: 'string',
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'impact',
        displayName: 'Impact',
        type: 'options',
        default: 'minor',
        options: ['none', 'minor', 'major', 'critical'].map(v => ({ name: v, value: v })),
        displayOptions: { show: { action: ['create'] } },
      },
    ],
    request: t => {
      const root = `https://api.statuspage.io/v1/pages/${enc(t.str('pageId'))}/incidents`;
      const headers = { Authorization: `OAuth ${t.str('apiKey')}` };
      const incident = {
        status: t.str('status'),
        ...(t.str('body') ? { body: t.str('body') } : {}),
      };
      if (t.str('action') === 'update') {
        return {
          method: 'PATCH',
          url: `${root}/${enc(t.str('incidentId'))}`,
          headers,
          body: { incident },
          describe: `Statuspage incident ${t.str('incidentId')} → ${t.str('status')}`,
        };
      }
      return {
        method: 'POST',
        url: root,
        headers,
        body: { incident: { ...incident, name: t.str('name'), impact_override: t.str('impact') } },
        describe: `Statuspage incident "${t.str('name').slice(0, 80)}"`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: string; shortlink?: string; status?: string };
      return { status, incidentId: b.id, url: b.shortlink, incidentStatus: b.status };
    },
  }),
];
