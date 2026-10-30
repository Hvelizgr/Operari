import { BUILTIN_CATALOG, CatalogExecutor, catalogMetadata } from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NODES: SEEDED } = require('../../../../prisma/seed-nodes') as {
  NODES: Array<{ type: string }>;
};

const FORM_TYPES = new Set(['string', 'number', 'boolean', 'options', 'secret']);
const byType = (type: string) => BUILTIN_CATALOG.find(n => n.type === type)!;

describe('built-in catalog definitions', () => {
  it('has unique types that do not shadow seeded steps', () => {
    const types = BUILTIN_CATALOG.map(n => n.type);
    expect(new Set(types).size).toBe(types.length);
    const seeded = new Set(SEEDED.map(n => n.type));
    expect(types.filter(t => seeded.has(t))).toEqual([]);
  });

  it.each(BUILTIN_CATALOG.map(n => [n.type, n] as const))(
    '%s has a well-formed form',
    (_type, node) => {
      expect(
        node.label.en && node.label.es && node.description.en && node.description.es
      ).toBeTruthy();
      const names = node.properties.map(p => p.name);
      expect(new Set(names).size).toBe(names.length);
      for (const p of node.properties) {
        expect(FORM_TYPES.has(p.type)).toBe(true);
        if (p.type === 'options') {
          expect(p.options?.length).toBeGreaterThan(0);
          if (p.default !== undefined) expect(p.options!.map(o => o.value)).toContain(p.default);
        }
        for (const [field, values] of Object.entries(p.displayOptions?.show ?? {})) {
          const dep = node.properties.find(q => q.name === field);
          expect(dep).toBeDefined();
          if (dep!.type === 'options') {
            for (const v of values) expect(dep!.options!.map(o => o.value)).toContain(v);
          }
        }
      }
    }
  );

  it('exposes metadata without the run function', () => {
    const meta = catalogMetadata();
    expect(meta).toHaveLength(BUILTIN_CATALOG.length);
    expect(meta.every(m => !('run' in m) && m.source === 'builtin')).toBe(true);
  });
});

describe('CatalogExecutor', () => {
  it('rejects a missing required field by its label', async () => {
    const res = await new CatalogExecutor(byType('operari.text')).execute({}, ctx());
    expect(res).toMatchObject({ success: false, error: 'Text is required' });
  });

  it('only requires fields shown for the chosen action', async () => {
    const res = await new CatalogExecutor(byType('operari.json')).execute(
      { action: 'parse', value: '{"a": 1}' },
      ctx()
    );
    expect(res).toMatchObject({ success: true, output: { value: { a: 1 } } });
  });

  it('applies form defaults the editor did not save', async () => {
    const res = await new CatalogExecutor(byType('operari.base64')).execute({ value: 'hi' }, ctx());
    expect(res.output).toEqual({ value: 'aGk=' });
  });

  it('turns a bad regex into a step failure', async () => {
    const res = await new CatalogExecutor(byType('operari.text')).execute(
      { action: 'extract', text: 'x', pattern: '(' },
      ctx()
    );
    expect(res.success).toBe(false);
  });
});

describe('data steps', () => {
  const run = (type: string, config: Record<string, unknown>, context = ctx()) =>
    new CatalogExecutor(byType(type)).execute(config, context);
  const items = [
    { name: 'api', status: 'failed', ms: 30 },
    { name: 'web', status: 'ok', ms: 10 },
    { name: 'db', status: 'failed', ms: 20 },
  ];
  const withItems = ctx({ previousOutputs: { list: items } });

  it('filter keeps matching items from a {{path}}', async () => {
    const res = await run(
      'operari.filter',
      { items: '{{list}}', field: 'status', value: 'failed' },
      withItems
    );
    expect((res.output as { count: number }).count).toBe(2);
  });

  it('sort orders numerically and descending', async () => {
    const res = await run(
      'operari.sort',
      { items: '{{list}}', field: 'ms', order: 'desc' },
      withItems
    );
    expect((res.output as { items: typeof items }).items.map(i => i.ms)).toEqual([30, 20, 10]);
  });

  it('aggregate sums a field', async () => {
    const res = await run(
      'operari.aggregate',
      { items: '{{list}}', operation: 'sum', field: 'ms' },
      withItems
    );
    expect(res.output).toEqual({ value: 60 });
  });

  it('json queries with JSONPath', async () => {
    const res = await run(
      'operari.json',
      {
        action: 'query',
        value: JSON.stringify({ items }),
        path: '$.items[?(@.status=="failed")].name',
      },
      ctx()
    );
    expect((res.output as { matches: string[] }).matches).toEqual(['api', 'db']);
  });

  it('csv round-trips quoted cells', async () => {
    const parsed = await run(
      'operari.csv',
      { action: 'parse', value: 'name,note\napi,"a, ""b"""' },
      ctx()
    );
    expect((parsed.output as { items: unknown[] }).items).toEqual([
      { name: 'api', note: 'a, "b"' },
    ]);
    const back = await run(
      'operari.csv',
      { action: 'generate', value: '{{rows}}' },
      ctx({ previousOutputs: { rows: [{ name: 'api', note: 'a, "b"' }] } })
    );
    expect((back.output as { value: string }).value).toBe('name,note\napi,"a, ""b"""');
  });

  it('jwt signs and verifies', async () => {
    const signed = await run(
      'operari.jwt',
      { action: 'sign', payload: '{"sub": "x"}', secret: 's3cret' },
      ctx()
    );
    const token = (signed.output as { token: string }).token;
    const ok = await run('operari.jwt', { action: 'verify', token, secret: 's3cret' }, ctx());
    expect(ok.output).toMatchObject({ valid: true, payload: { sub: 'x' } });
    const bad = await run('operari.jwt', { action: 'verify', token, secret: 'nope' }, ctx());
    expect(bad.output).toMatchObject({ valid: false });
  });

  it('text slugifies accents', async () => {
    const res = await run(
      'operari.text',
      { action: 'slug', text: 'Caída del Servicio API' },
      ctx()
    );
    expect(res.output).toEqual({ value: 'caida-del-servicio-api' });
  });
});

describe('API steps send the documented request', () => {
  function capture() {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"ok": true, "success": true}', { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, fetchMock };
  }
  const send = async (type: string, config: Record<string, unknown>) => {
    const { calls, fetchMock } = capture();
    const res = await new CatalogExecutor(byType(type), fetchMock).execute(config, ctx());
    expect(res.error).toBeUndefined();
    const { url, init } = calls[0];
    const headers = init.headers as Record<string, string>;
    let body: unknown = init.body;
    if (typeof body === 'string' && headers['Content-Type']?.includes('json'))
      body = JSON.parse(body);
    return { url, method: init.method, headers, body };
  };

  it('slack.message posts chat.postMessage with the bot token', async () => {
    const r = await send('slack.message', {
      token: 'xoxb-1',
      channel: 'C1',
      text: 'hi',
      threadTs: '1.2',
    });
    expect(r.url).toBe('https://slack.com/api/chat.postMessage');
    expect(r.headers.Authorization).toBe('Bearer xoxb-1');
    expect(r.body).toEqual({ channel: 'C1', text: 'hi', thread_ts: '1.2' });
  });

  it('slack.message fails when Slack answers ok: false', async () => {
    const fetchMock = jest.fn(
      async () => new Response('{"ok": false, "error": "channel_not_found"}', { status: 200 })
    );
    const res = await new CatalogExecutor(byType('slack.message'), fetchMock as never).execute(
      { token: 'x', channel: 'C1', text: 'hi' },
      ctx()
    );
    expect(res).toMatchObject({ success: false });
    expect(res.error).toContain('channel_not_found');
  });

  it('twilio.sms sends a form with basic auth', async () => {
    const sid = `AC${'a'.repeat(32)}`;
    const r = await send('twilio.sms', {
      accountSid: sid,
      authToken: 'tok',
      from: '+1',
      to: '+2',
      text: 'down',
    });
    expect(r.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`);
    expect(r.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(r.body as string).get('Body')).toBe('down');
  });

  it('prometheus.query encodes the PromQL', async () => {
    const r = await send('prometheus.query', {
      baseUrl: 'https://prom.example.com/',
      query: 'up{job="api"}',
    });
    expect(r.url).toBe('https://prom.example.com/api/v1/query?query=up%7Bjob%3D%22api%22%7D');
  });

  it('alertmanager.silence parses matchers', async () => {
    const r = await send('alertmanager.silence', {
      baseUrl: 'https://am.example.com',
      matchers: 'alertname=HighLatency\nservice=~api|web',
      comment: 'deploy',
    });
    expect((r.body as { matchers: unknown[] }).matchers).toEqual([
      { name: 'alertname', value: 'HighLatency', isRegex: false, isEqual: true },
      { name: 'service', value: 'api|web', isRegex: true, isEqual: true },
    ]);
  });

  it('github.actions dispatches with KEY=value inputs', async () => {
    const r = await send('github.actions', {
      token: 't',
      owner: 'acme',
      repo: 'api',
      workflow: 'deploy.yml',
      inputs: 'env=prod\nversion=1.2.3',
    });
    expect(r.url).toBe(
      'https://api.github.com/repos/acme/api/actions/workflows/deploy.yml/dispatches'
    );
    expect(r.body).toEqual({ ref: 'main', inputs: { env: 'prod', version: '1.2.3' } });
  });

  it('gitlab.action triggers a pipeline with variables', async () => {
    const r = await send('gitlab.action', {
      token: 't',
      project: 'group/app',
      variables: '{"ENV": "prod"}',
    });
    expect(r.url).toBe('https://gitlab.com/api/v4/projects/group%2Fapp/pipeline');
    expect(r.headers['PRIVATE-TOKEN']).toBe('t');
    expect(r.body).toEqual({ ref: 'main', variables: [{ key: 'ENV', value: 'prod' }] });
  });

  it('jenkins.build uses buildWithParameters only when there are parameters', async () => {
    const plain = await send('jenkins.build', {
      baseUrl: 'https://ci.example.com',
      job: 'ops/deploy',
      username: 'u',
      apiToken: 'k',
    });
    expect(plain.url).toBe('https://ci.example.com/job/ops/job/deploy/build');
    const withParams = await send('jenkins.build', {
      baseUrl: 'https://ci.example.com',
      job: 'deploy',
      username: 'u',
      apiToken: 'k',
      parameters: 'ENV=prod',
    });
    expect(withParams.url).toBe('https://ci.example.com/job/deploy/buildWithParameters');
  });

  it('cloudflare.action purges everything when no URLs are given', async () => {
    const r = await send('cloudflare.action', { token: 't', zoneId: 'z1' });
    expect(r.url).toBe('https://api.cloudflare.com/client/v4/zones/z1/purge_cache');
    expect(r.body).toEqual({ purge_everything: true });
  });

  it('linear.issue sends the GraphQL mutation', async () => {
    const r = await send('linear.issue', {
      apiKey: 'lin',
      teamId: 'T',
      title: 'API down',
      priority: '1',
    });
    expect(r.headers.Authorization).toBe('lin');
    expect((r.body as { variables: { input: unknown } }).variables.input).toEqual({
      teamId: 'T',
      title: 'API down',
      description: '',
      priority: 1,
    });
  });

  it('statuspage.incident updates an incident by id', async () => {
    const r = await send('statuspage.incident', {
      action: 'update',
      apiKey: 'k',
      pageId: 'p',
      incidentId: 'i1',
      status: 'resolved',
    });
    expect(r.method).toBe('PATCH');
    expect(r.url).toBe('https://api.statuspage.io/v1/pages/p/incidents/i1');
    expect(r.headers.Authorization).toBe('OAuth k');
  });

  it('ntfy.publish sends plain text with headers', async () => {
    const r = await send('ntfy.publish', {
      topic: 'ops',
      text: 'disk full',
      title: 'db-1',
      priority: '5',
    });
    expect(r.url).toBe('https://ntfy.sh/ops');
    expect(r.body).toBe('disk full');
    expect(r.headers.Title).toBe('db-1');
    expect(r.headers.Priority).toBe('5');
  });

  it('dry run sends nothing', async () => {
    const { calls, fetchMock } = capture();
    const res = await new CatalogExecutor(byType('slack.message'), fetchMock).execute(
      { token: 't', channel: 'C', text: 'x' },
      ctx({ dryRun: true })
    );
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe('network checks', () => {
  it('tcpCheck reports an open local port and a closed one', async () => {
    const net = await import('node:net');
    const server = net.createServer().listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    const port = (server.address() as { port: number }).port;
    try {
      const open = await new CatalogExecutor(byType('operari.tcpCheck')).execute(
        { host: '127.0.0.1', port },
        ctx()
      );
      expect(open.output).toMatchObject({ up: true });
    } finally {
      server.close();
    }
    const closed = await new CatalogExecutor(byType('operari.tcpCheck')).execute(
      { host: '127.0.0.1', port, failWhenDown: true },
      ctx()
    );
    expect(closed.success).toBe(false);
  });

  it('httpCheck lists every reason a check failed', async () => {
    const fetchMock = jest.fn(async () => new Response('maintenance', { status: 503 }));
    const res = await new CatalogExecutor(byType('operari.httpCheck'), fetchMock as never).execute(
      { url: 'https://status.example.com', contains: 'ok' },
      ctx()
    );
    expect(res.output).toMatchObject({ up: false, status: 503 });
    expect((res.output as { reasons: string[] }).reasons).toHaveLength(2);
  });
});
