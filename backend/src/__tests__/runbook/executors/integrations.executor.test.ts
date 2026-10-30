import { DatadogEventExecutor } from '../../../runbook/executors/datadog-event.executor';
import { EmailExecutor } from '../../../runbook/executors/email.executor';
import { GitHubIssueExecutor } from '../../../runbook/executors/github-issue.executor';
import { GrafanaAnnotationExecutor } from '../../../runbook/executors/grafana-annotation.executor';
import { createExecutorRegistry } from '../../../runbook/executors/index';
import { JiraExecutor } from '../../../runbook/executors/jira.executor';
import { OpsgenieExecutor } from '../../../runbook/executors/opsgenie.executor';
import { PagerDutyExecutor } from '../../../runbook/executors/pagerduty.executor';
import { RedisExecutor } from '../../../runbook/executors/redis.executor';
import { TeamsExecutor } from '../../../runbook/executors/teams.executor';
import { TelegramExecutor } from '../../../runbook/executors/telegram.executor';
import {
  CryptoExecutor,
  DateTimeExecutor,
  SetExecutor,
  StopAndErrorExecutor,
} from '../../../runbook/executors/transform.executor';
import { credentialSecret, ExecutorContext } from '../../../runbook/types/executor.types';

const ctx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: { service: 'checkout' },
  previousOutputs: {},
  tenantId: 'tenant-1',
  secrets: { 'acc-1': 'tok-123' },
  ...overrides,
});

function fakeFetch(status = 200, body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Bad Request',
    });
  }) as typeof fetch;
  return { fn, calls, sent: () => JSON.parse(String(calls[0].init.body)) };
}

describe('credentialSecret', () => {
  it('finds the secret for both the picker form and a bare id', () => {
    expect(credentialSecret('{{secrets.acc-1}}', ctx())).toBe('tok-123');
    expect(credentialSecret(' {{ secrets.acc-1 }} ', ctx())).toBe('tok-123');
    expect(credentialSecret('acc-1', ctx())).toBe('tok-123');
    expect(credentialSecret('missing', ctx())).toBeUndefined();
    expect(credentialSecret(undefined, ctx())).toBeUndefined();
  });
});

describe('HTTP integration steps', () => {
  it('PagerDuty triggers with the resolved routing key and returns the dedup key', async () => {
    const f = fakeFetch(202, { status: 'success', dedup_key: 'dk-1' });
    const res = await new PagerDutyExecutor(f.fn).execute(
      { action: 'trigger', routingKey: '{{secrets.acc-1}}', summary: '{{vars.service}} down' },
      ctx()
    );
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ dedupKey: 'dk-1' });
    expect(f.calls[0].url).toBe('https://events.pagerduty.com/v2/enqueue');
    expect(f.sent()).toMatchObject({
      routing_key: 'tok-123',
      event_action: 'trigger',
      payload: { summary: 'checkout down', severity: 'error', source: 'operari' },
    });
  });

  it('PagerDuty refuses to resolve without a dedup key', async () => {
    const f = fakeFetch();
    const res = await new PagerDutyExecutor(f.fn).execute(
      { action: 'resolve', routingKey: 'k' },
      ctx()
    );
    expect(res).toMatchObject({ success: false, error: 'dedupKey is required to resolve' });
    expect(f.calls).toHaveLength(0);
  });

  it('Opsgenie closes by alias against the EU endpoint', async () => {
    const f = fakeFetch(202, { requestId: 'r1', result: 'Request will be processed' });
    const res = await new OpsgenieExecutor(f.fn).execute(
      { action: 'close', apiKey: 'k', region: 'eu', alias: 'checkout/latency' },
      ctx()
    );
    expect(res.success).toBe(true);
    expect(f.calls[0].url).toBe(
      'https://api.eu.opsgenie.com/v2/alerts/checkout%2Flatency/close?identifierType=alias'
    );
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe('GenieKey k');
  });

  it('Jira creates an issue with basic auth and returns its key', async () => {
    const f = fakeFetch(201, { id: '10', key: 'OPS-7', self: 'https://x/rest/api/2/issue/10' });
    const res = await new JiraExecutor(f.fn).execute(
      {
        action: 'create',
        baseUrl: 'https://acme.atlassian.net/',
        email: 'oncall@acme.dev',
        apiToken: 't',
        projectKey: 'OPS',
        summary: 'Rollback {{vars.service}}',
        labels: 'incident, sev2',
      },
      ctx()
    );
    expect(res.output).toMatchObject({ key: 'OPS-7' });
    expect(f.calls[0].url).toBe('https://acme.atlassian.net/rest/api/2/issue');
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('oncall@acme.dev:t').toString('base64')}`
    );
    expect(f.sent().fields).toMatchObject({
      project: { key: 'OPS' },
      issuetype: { name: 'Task' },
      summary: 'Rollback checkout',
      labels: ['incident', 'sev2'],
    });
  });

  it('GitHub closes an issue with a PATCH', async () => {
    const f = fakeFetch(200, { number: 4, html_url: 'https://github.com/a/b/issues/4' });
    const res = await new GitHubIssueExecutor(f.fn).execute(
      { action: 'close', token: 't', owner: 'a', repo: 'b', issueNumber: '#4' },
      ctx()
    );
    expect(res.output).toMatchObject({ number: 4 });
    expect(f.calls[0].init.method).toBe('PATCH');
    expect(f.calls[0].url).toBe('https://api.github.com/repos/a/b/issues/4');
  });

  it('Teams posts an adaptive card and rejects non-https webhooks', async () => {
    const f = fakeFetch(202, '');
    const ok = await new TeamsExecutor(f.fn).execute(
      { webhookUrl: 'https://prod.workflows.example/hook', title: 'Deploy', text: 'done' },
      ctx()
    );
    expect(ok.success).toBe(true);
    expect(f.sent().attachments[0].content.body.map((b: { text: string }) => b.text)).toEqual([
      'Deploy',
      'done',
    ]);
    const bad = await new TeamsExecutor(f.fn).execute({ webhookUrl: 'http://x', text: 'x' }, ctx());
    expect(bad).toMatchObject({ success: false, error: 'webhookUrl must use https' });
  });

  it('Telegram keeps the bot token out of the logs', async () => {
    const f = fakeFetch(200, { ok: true, result: { message_id: 9 } });
    const lines: string[] = [];
    const res = await new TelegramExecutor(f.fn).execute(
      { botToken: '{{secrets.acc-1}}', chatId: '-100', text: 'hi' },
      ctx({ emit: e => lines.push(e.text) })
    );
    expect(res.output).toMatchObject({ messageId: 9 });
    expect(f.calls[0].url).toBe('https://api.telegram.org/bottok-123/sendMessage');
    expect(lines.join('\n')).not.toContain('tok-123');
  });

  it('Datadog posts to the configured site', async () => {
    const f = fakeFetch(202, { event: { id: 1, url: 'u' } });
    await new DatadogEventExecutor(f.fn).execute(
      { apiKey: 'k', site: 'datadoghq.eu', title: 'Scaled', tags: 'env:prod' },
      ctx()
    );
    expect(f.calls[0].url).toBe('https://api.datadoghq.eu/api/v1/events');
    expect(f.sent().tags).toEqual(['source:operari', 'env:prod']);
  });

  it('Grafana annotates with a bearer token', async () => {
    const f = fakeFetch(200, { id: 33 });
    const res = await new GrafanaAnnotationExecutor(f.fn).execute(
      { baseUrl: 'https://g.acme.dev', apiToken: 't', text: 'rollback', dashboardUid: 'abc' },
      ctx()
    );
    expect(res.output).toMatchObject({ annotationId: 33 });
    expect(f.sent()).toMatchObject({ text: 'rollback', dashboardUID: 'abc' });
  });

  it('turns a non-2xx answer into a failed step with the response body', async () => {
    const f = fakeFetch(400, { errors: ['bad key'] });
    const res = await new DatadogEventExecutor(f.fn).execute({ apiKey: 'k', title: 't' }, ctx());
    expect(res.success).toBe(false);
    expect(res.error).toContain('HTTP 400');
    expect(res.error).toContain('bad key');
  });

  it('dry-run sends nothing', async () => {
    const f = fakeFetch();
    const res = await new PagerDutyExecutor(f.fn).execute(
      { action: 'trigger', routingKey: 'k', summary: 's' },
      ctx({ dryRun: true })
    );
    expect(res.output).toMatchObject({ dryRun: true });
    expect(f.calls).toHaveLength(0);
  });
});

describe('Redis step', () => {
  const fakeClient = () => {
    const calls: unknown[][] = [];
    const rec =
      (name: string, ret: unknown) =>
      async (...args: unknown[]) => {
        calls.push([name, ...args]);
        return ret;
      };
    const client = {
      connect: rec('connect', undefined),
      disconnect: jest.fn(),
      get: rec('get', 'on'),
      set: rec('set', 'OK'),
      del: rec('del', 1),
      incr: rec('incr', 2),
      expire: rec('expire', 1),
      publish: rec('publish', 3),
    };
    return { client, calls };
  };

  it('sets a key with a TTL and always disconnects', async () => {
    const { client, calls } = fakeClient();
    const res = await new RedisExecutor(() => client as never).execute(
      {
        url: 'redis://h:6379',
        operation: 'set',
        key: 'flag:{{vars.service}}',
        value: 'off',
        ttl: 60,
      },
      ctx()
    );
    expect(res).toMatchObject({ success: true, output: { key: 'flag:checkout', result: 'OK' } });
    expect(calls).toContainEqual(['set', 'flag:checkout', 'off', 'EX', 60]);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('validates the url and skips the connection on dry-run', async () => {
    const factory = jest.fn();
    const exec = new RedisExecutor(factory);
    expect(
      await exec.execute({ url: 'http://h', operation: 'get', key: 'k' }, ctx())
    ).toMatchObject({
      success: false,
    });
    expect(
      await exec.execute({ url: 'redis://h', operation: 'del', key: 'k' }, ctx({ dryRun: true }))
    ).toMatchObject({ success: true, output: { dryRun: true } });
    expect(factory).not.toHaveBeenCalled();
  });
});

describe('Email step', () => {
  it('sends through the transport built from the SMTP url', async () => {
    const sendMail = jest
      .fn()
      .mockResolvedValue({ messageId: 'm1', accepted: ['a@x'], rejected: [] });
    const factory = jest.fn().mockReturnValue({ sendMail });
    const res = await new EmailExecutor(factory).execute(
      {
        smtpUrl: 'smtps://u:p@mail:465',
        from: 'ops@x',
        to: 'a@x',
        subject: '{{vars.service}} recovered',
        body: 'ok',
      },
      ctx()
    );
    expect(factory).toHaveBeenCalledWith('smtps://u:p@mail:465');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@x', subject: 'checkout recovered', text: 'ok' })
    );
    expect(res.output).toMatchObject({ messageId: 'm1' });
  });

  it('fails clearly when no SMTP server is configured', async () => {
    const res = await new EmailExecutor(() => null).execute(
      { to: 'a@x', subject: 's', body: '' },
      ctx()
    );
    expect(res.error).toMatch(/no SMTP server/);
  });
});

describe('data steps', () => {
  it('Set resolves templates inside the JSON fields', async () => {
    const res = await new SetExecutor().execute(
      { fields: '{"svc":"{{vars.service}}","n":3,"nested":{"k":"{{vars.service}}-db"}}' },
      ctx()
    );
    expect(res.output).toEqual({ svc: 'checkout', n: 3, nested: { k: 'checkout-db' } });
    expect((await new SetExecutor().execute({ fields: '[1]' }, ctx())).success).toBe(false);
    expect((await new SetExecutor().execute({ fields: '{' }, ctx())).success).toBe(false);
  });

  it('Crypto hashes and signs deterministically', async () => {
    const c = new CryptoExecutor();
    expect((await c.execute({ action: 'hash', value: 'abc' }, ctx())).output?.value).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(
      (await c.execute({ action: 'hmac', value: 'abc', secret: 'k', encoding: 'base64' }, ctx()))
        .output?.value
    ).toBe('NC5RnOCtbAOja5jus/HRMNtIE7nfTRFg7aSI1xLceO4=');
    expect((await c.execute({ action: 'uuid' }, ctx())).output?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect((await c.execute({ action: 'hmac', value: 'x' }, ctx())).success).toBe(false);
  });

  it('Date & time subtracts windows and measures differences', async () => {
    const d = new DateTimeExecutor();
    const sub = await d.execute(
      {
        action: 'subtract',
        date: '2026-01-01T00:15:00Z',
        amount: 15,
        unit: 'minutes',
        timezone: 'America/Guatemala',
      },
      ctx()
    );
    expect(sub.output).toMatchObject({
      iso: '2026-01-01T00:00:00.000Z',
      unix: 1767225600,
      local: '2025-12-31T18:00:00',
    });
    const diff = await d.execute(
      { action: 'diff', date: '1767225600', compareTo: '2026-01-01T02:00:00Z', unit: 'hours' },
      ctx()
    );
    expect(diff.output).toMatchObject({ seconds: 7200, hours: 2 });
    expect((await d.execute({ action: 'now', date: 'nope' }, ctx())).success).toBe(false);
  });

  it('Stop and error fails the step with the resolved message', async () => {
    const res = await new StopAndErrorExecutor().execute(
      { message: '{{vars.service}} is not ours' },
      ctx()
    );
    expect(res).toMatchObject({ success: false, error: 'checkout is not ours' });
  });
});

describe('catalog ↔ registry', () => {
  it('every runnable node type in the seed catalog has a registered executor', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NODES } = require('../../../../prisma/seed-nodes.js') as {
      NODES: { type: string; inputs: unknown[] }[];
    };
    const registry = createExecutorRegistry({} as never, {
      runner: { name: 'fake' } as never,
    });
    const handledElsewhere = new Set([
      'custom.frame',
      'custom.note',
      'operari.webhook',
      'operari.cron',
      'operari.if',
      'operari.switch',
      'operari.loop',
    ]);
    const missing = NODES.map(n => n.type).filter(
      t => !handledElsewhere.has(t) && !registry.has(t)
    );
    expect(missing).toEqual([]);
  });
});
