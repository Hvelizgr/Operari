import { NotifyExecutor, NotifyConfig } from '../../../runbook/executors/notify.executor';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const execCtx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'notify-1',
  variables: {},
  previousOutputs: {},
  tenantId: 'tenant-1',
  ...overrides,
});

interface FakeFetchCall {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

interface FakeFetchResponse {
  status: number;
  statusText?: string;
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Builds a fake `fetch` that records every call and replays a queued
 * sequence of responses. The notify executor's retry path needs more
 * than one response per test, so the queue is FIFO with the last
 * response replayed indefinitely after the queue drains.
 */
function buildFakeFetch(responses: FakeFetchResponse[]): {
  fetch: typeof fetch;
  calls: FakeFetchCall[];
} {
  const calls: FakeFetchCall[] = [];
  let idx = 0;
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init: {
        method: init?.method,
        headers: init?.headers as Record<string, string> | undefined,
        body: init?.body as string | undefined,
      },
    });
    const response = responses[Math.min(idx, responses.length - 1)];
    idx++;
    const headers = new Headers(response.headers ?? {});
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText ?? '',
      headers,
      text: async () => response.body ?? '',
      json: async () => JSON.parse(response.body ?? '{}'),
    } as unknown as Response;
  }) as typeof fetch;
  return { fetch: fakeFetch, calls };
}

const baseConfig: NotifyConfig = {
  channel: 'slack',
  webhookUrl: 'https://hooks.slack.com/services/T000/B000/xxx',
  message: 'Deploy of {{vars.image}} succeeded',
};

describe('NotifyExecutor', () => {
  describe('happy path', () => {
    it('sends a Slack message and reports success', async () => {
      const { fetch: f, calls } = buildFakeFetch([{ status: 200, body: 'ok' }]);
      const exec = new NotifyExecutor(f);

      const result = await exec.execute(
        baseConfig,
        execCtx({ variables: { image: 'api:v2.1.4' } })
      );

      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(baseConfig.webhookUrl);
      expect(calls[0].init.method).toBe('POST');
      const body = JSON.parse(calls[0].init.body!);
      expect(body.text).toBe('Deploy of api:v2.1.4 succeeded');
      expect(result.output).toMatchObject({ channel: 'slack', sent: true, truncated: false });
    });

    it('builds a Slack attachment when title is provided', async () => {
      const { fetch: f, calls } = buildFakeFetch([{ status: 200, body: 'ok' }]);
      const exec = new NotifyExecutor(f);

      await exec.execute({ ...baseConfig, title: 'Deploy failed', color: 'danger' }, execCtx());

      const body = JSON.parse(calls[0].init.body!);
      expect(body.attachments).toEqual([
        expect.objectContaining({ title: 'Deploy failed', color: 'danger' }),
      ]);
    });

    it('sends a Discord message with the bold-title format', async () => {
      const { fetch: f, calls } = buildFakeFetch([{ status: 204 }]);
      const exec = new NotifyExecutor(f);

      await exec.execute(
        {
          channel: 'discord',
          webhookUrl: 'https://discord.com/api/webhooks/1/xxx',
          title: 'Migration done',
          message: 'rows: 12345',
        },
        execCtx()
      );

      const body = JSON.parse(calls[0].init.body!);
      expect(body.content).toBe('**Migration done**\nrows: 12345');
    });

    it('resolves vars and previous-step outputs in the message', async () => {
      const { fetch: f, calls } = buildFakeFetch([{ status: 200, body: 'ok' }]);
      const exec = new NotifyExecutor(f);

      await exec.execute(
        {
          ...baseConfig,
          message: 'Step {{steps.deploy.duration}}ms in {{vars.env}}',
        },
        execCtx({
          variables: { env: 'prod' },
          previousOutputs: { deploy: { duration: 4521 } },
        })
      );

      const body = JSON.parse(calls[0].init.body!);
      expect(body.text).toBe('Step 4521ms in prod');
    });
  });

  describe('error mapping', () => {
    it('treats Slack 200 with body "invalid_token" as failure', async () => {
      const { fetch: f } = buildFakeFetch([{ status: 200, body: 'invalid_token' }]);
      const exec = new NotifyExecutor(f);

      const result = await exec.execute(baseConfig, execCtx());

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid_token/);
    });

    it('treats Slack 200 with empty body as failure', async () => {
      const { fetch: f } = buildFakeFetch([{ status: 200, body: '' }]);
      const exec = new NotifyExecutor(f);
      const result = await exec.execute(baseConfig, execCtx());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/empty body/);
    });

    it('returns the http status when Slack rejects with 4xx', async () => {
      const { fetch: f } = buildFakeFetch([
        { status: 404, statusText: 'Not Found', body: 'no_service' },
      ]);
      const exec = new NotifyExecutor(f);
      const result = await exec.execute(baseConfig, execCtx());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/HTTP 404/);
      expect(result.error).toMatch(/no_service/);
    });

    it('treats Discord 4xx as failure with body included', async () => {
      const { fetch: f } = buildFakeFetch([
        { status: 400, statusText: 'Bad Request', body: '{"message":"invalid webhook"}' },
      ]);
      const exec = new NotifyExecutor(f);
      const result = await exec.execute(
        {
          channel: 'discord',
          webhookUrl: 'https://discord.com/api/webhooks/1/xxx',
          message: 'hi',
        },
        execCtx()
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid webhook/);
    });
  });

  describe('rate limiting', () => {
    it('retries on 429 honouring the Retry-After header', async () => {
      const { fetch: f, calls } = buildFakeFetch([
        { status: 429, headers: { 'Retry-After': '0' } },
        { status: 429, headers: { 'Retry-After': '0' } },
        { status: 200, body: 'ok' },
      ]);
      const exec = new NotifyExecutor(f);

      const result = await exec.execute(baseConfig, execCtx());

      expect(result.success).toBe(true);
      expect(calls).toHaveLength(3);
    });

    it('gives up after MAX_RETRIES of 429 in a row', async () => {
      const { fetch: f, calls } = buildFakeFetch([
        { status: 429, headers: { 'Retry-After': '0' } },
      ]);
      const exec = new NotifyExecutor(f);
      const result = await exec.execute(baseConfig, execCtx());
      expect(result.success).toBe(false);
      // Three attempts (initial + two retries — the third hop
      // does not retry because attempt === MAX_RETRIES).
      expect(calls).toHaveLength(3);
    });
  });

  describe('url validation', () => {
    it('rejects an empty webhookUrl', async () => {
      const exec = new NotifyExecutor(buildFakeFetch([]).fetch);
      const result = await exec.execute({ ...baseConfig, webhookUrl: '' }, execCtx());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/required/);
    });

    it('rejects an http (non-https) webhookUrl', async () => {
      const exec = new NotifyExecutor(buildFakeFetch([]).fetch);
      const result = await exec.execute(
        { ...baseConfig, webhookUrl: 'http://hooks.slack.com/services/T/B/x' },
        execCtx()
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/https/);
    });

    it('rejects a Slack channel pointed at a non-slack host', async () => {
      const exec = new NotifyExecutor(buildFakeFetch([]).fetch);
      const result = await exec.execute(
        { ...baseConfig, webhookUrl: 'https://example.com/hook' },
        execCtx()
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/slack\.com/);
    });

    it('rejects a Discord channel pointed at a non-discord host', async () => {
      const exec = new NotifyExecutor(buildFakeFetch([]).fetch);
      const result = await exec.execute(
        {
          channel: 'discord',
          webhookUrl: 'https://example.com/hook',
          message: 'x',
        },
        execCtx()
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/discord/);
    });

    it('allows any https host for the generic webhook channel', async () => {
      const { fetch: f } = buildFakeFetch([{ status: 200 }]);
      const exec = new NotifyExecutor(f);
      const result = await exec.execute(
        {
          channel: 'webhook',
          webhookUrl: 'https://example.com/hook',
          message: 'x',
        },
        execCtx()
      );
      expect(result.success).toBe(true);
    });
  });

  describe('truncation', () => {
    it('flags messages over 35KB as truncated and appends a marker', async () => {
      const huge = 'A'.repeat(40 * 1024);
      const { fetch: f, calls } = buildFakeFetch([{ status: 200, body: 'ok' }]);
      const exec = new NotifyExecutor(f);

      const result = await exec.execute({ ...baseConfig, message: huge }, execCtx());

      expect(result.success).toBe(true);
      expect((result.output as Record<string, unknown>).truncated).toBe(true);
      const body = JSON.parse(calls[0].init.body!);
      expect(body.text).toMatch(/truncated by NanoRun notify step/);
      expect(Buffer.byteLength(body.text, 'utf-8')).toBeLessThanOrEqual(35 * 1024);
    });

    it('does not mark short messages as truncated', async () => {
      const { fetch: f } = buildFakeFetch([{ status: 200, body: 'ok' }]);
      const exec = new NotifyExecutor(f);
      const result = await exec.execute(baseConfig, execCtx());
      expect((result.output as Record<string, unknown>).truncated).toBe(false);
    });
  });

  describe('network errors', () => {
    it('catches a thrown fetch error and returns it as step failure', async () => {
      const exploding = (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch;
      const exec = new NotifyExecutor(exploding);
      const result = await exec.execute(baseConfig, execCtx());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/ECONNREFUSED/);
    });
  });
});
