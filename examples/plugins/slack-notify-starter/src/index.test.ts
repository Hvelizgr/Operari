import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import slackNotify from './index';

// Minimal ExecutorContext stub. Real Operari hands a richer object
// (variables, previousOutputs, secrets, runId, stepId, …); this
// covers only what the slack-notify step actually reads.
const baseCtx = {
  runId: 'run_test',
  stepId: 'step_test',
  variables: {},
  previousOutputs: {},
  tenantId: 'tenant_test',
  emit: vi.fn(),
};

describe('slack-notify plugin', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('rejects an empty message at config-validation time', () => {
    expect(() =>
      slackNotify.configSchema.parse({
        webhookUrl: 'https://hooks.slack.com/abc',
        message: '',
      })
    ).toThrow();
  });

  it('rejects a non-URL webhook', () => {
    expect(() =>
      slackNotify.configSchema.parse({ webhookUrl: 'not-a-url', message: 'hi' })
    ).toThrow();
  });

  it('returns success when slack returns 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const cfg = slackNotify.configSchema.parse({
      webhookUrl: 'https://hooks.slack.com/abc',
      message: 'hello',
    });
    const res = await slackNotify.execute(cfg, baseCtx as never);
    expect(res.success).toBe(true);
    expect((res.output as { status: number }).status).toBe(200);
  });

  it('returns failure with status when slack returns 4xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    const cfg = slackNotify.configSchema.parse({
      webhookUrl: 'https://hooks.slack.com/abc',
      message: 'hello',
    });
    const res = await slackNotify.execute(cfg, baseCtx as never);
    expect(res.success).toBe(false);
    expect(res.error).toContain('429');
  });

  it('surfaces a clear timeout message when the request aborts', async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    const cfg = slackNotify.configSchema.parse({
      webhookUrl: 'https://hooks.slack.com/abc',
      message: 'hello',
      timeoutMs: 50,
    });
    const res = await slackNotify.execute(cfg, baseCtx as never);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/timed out/);
  });
});
