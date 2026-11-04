import express from 'express';
import request from 'supertest';

import { createRunnerLogsRouter } from '../../../routes/runner-logs.routes';
import { FlyMachineRunner } from '../../../runbook/runners/fly-machine.runner';
import { LOG_WRAPPER_SCRIPT, LogCallbackRegistry } from '../../../runbook/runners/log-callbacks';
import type { RunnerContext } from '../../../runbook/runners/runner.types';

const ctx = (emitted: string[] = []): RunnerContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  tenantId: 't-1',
  emit: e => emitted.push(`${e.type}:${e.text}`),
});

/**
 * Fake Fly API. While the runner waits for the machine to stop, the
 * "machine" delivers its lines through the registry, out of order, with
 * one duplicate, the way retried POSTs could arrive.
 */
function flyApi(registry: LogCallbackRegistry) {
  const created: Array<Record<string, unknown>> = [];
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (method === 'POST') {
      created.push(JSON.parse(String(init?.body)));
      return json({ id: 'm-1' });
    }
    if (url.includes('/wait')) {
      const env = (created[0].config as { env: Record<string, string> }).env;
      const token = env.OPERARI_LOG_URL.split('/').pop()!;
      registry.deliver(token, { stream: 'stdout', seq: 2, text: 'second\n' });
      registry.deliver(token, { stream: 'stderr', seq: 1, text: 'warn\n' });
      registry.deliver(token, { stream: 'stdout', seq: 1, text: 'first\n' });
      registry.deliver(token, { stream: 'stdout', seq: 1, text: 'first\n' });
      return json({ ok: true });
    }
    if (method === 'DELETE') return json({ ok: true });
    return json({
      id: 'm-1',
      state: 'stopped',
      events: [{ type: 'exit', request: { exit_event: { exit_code: 4 } } }],
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, created };
}

describe('Fly output capture', () => {
  it('runs the command through the wrapper and returns the lines in order', async () => {
    const registry = new LogCallbackRegistry();
    const api = flyApi(registry);
    const emitted: string[] = [];
    const runner = new FlyMachineRunner({
      apiToken: 't',
      appName: 'a',
      apiBase: 'https://api.machines.test',
      fetchImpl: api.fetchImpl,
      logCallbackUrl: 'https://operari.example.com/',
      logRegistry: registry,
      logGraceMs: 0,
    });
    const result = await runner.run({ command: 'echo "a b"; exit 4', shell: 'bash' }, ctx(emitted));

    const config = api.created[0].config as {
      init: { exec: string[] };
      env: Record<string, string>;
      files: Array<{ guest_path: string; raw_value: string }>;
    };
    expect(config.init.exec).toEqual(['/bin/sh', '/operari/run.sh']);
    expect(Buffer.from(config.files[0].raw_value, 'base64').toString()).toBe(LOG_WRAPPER_SCRIPT);
    expect(Buffer.from(config.env.OPERARI_COMMAND_B64, 'base64').toString()).toBe(
      'echo "a b"; exit 4'
    );
    expect(config.env.OPERARI_SHELL).toBe('bash');
    expect(config.env.OPERARI_LOG_URL).toMatch(
      /^https:\/\/operari\.example\.com\/webhook\/runner-logs\/[A-Za-z0-9_-]{43}$/
    );

    expect(result.stdout).toBe('first\nsecond');
    expect(result.stderr).toBe('warn');
    expect(result.exitCode).toBe(4);
    expect(emitted).toEqual(['stdout:second\n', 'stderr:warn\n', 'stdout:first\n']);
    expect(registry.size).toBe(0);
  });

  it('keeps the plain exec and empty output without a callback URL', async () => {
    const registry = new LogCallbackRegistry();
    const runner = new FlyMachineRunner({
      apiToken: 't',
      appName: 'a',
      fetchImpl: flyApi(registry).fetchImpl,
    });
    const body = runner.buildCreateBody({ command: 'id' }, ctx()) as {
      config: { init: { exec: string[] }; files?: unknown };
    };
    expect(body.config.init.exec).toEqual(['sh', '-c', 'id']);
    expect(body.config.files).toBeUndefined();
  });
});

describe('POST /webhook/runner-logs/:token', () => {
  const app = (registry: LogCallbackRegistry) => {
    const a = express();
    a.use('/webhook/runner-logs', createRunnerLogsRouter(registry));
    return a;
  };

  it('delivers a line for a live token and 404s otherwise', async () => {
    const registry = new LogCallbackRegistry();
    const got: unknown[] = [];
    const { token, close } = registry.register(c => got.push(c), 60_000);
    await request(app(registry))
      .post(`/webhook/runner-logs/${token}?stream=stdout&seq=1`)
      .set('content-type', 'text/plain')
      .send('hello\n')
      .expect(204);
    expect(got).toEqual([{ stream: 'stdout', seq: 1, text: 'hello\n' }]);
    close();
    await request(app(registry))
      .post(`/webhook/runner-logs/${token}?stream=stdout&seq=2`)
      .send('late')
      .expect(404);
    await request(app(registry))
      .post('/webhook/runner-logs/guess?stream=stdout&seq=1')
      .send('x')
      .expect(404);
  });

  it('rejects bad stream or sequence values', async () => {
    const registry = new LogCallbackRegistry();
    const { token } = registry.register(() => undefined, 60_000);
    await request(app(registry))
      .post(`/webhook/runner-logs/${token}?stream=env&seq=1`)
      .send('x')
      .expect(400);
    await request(app(registry))
      .post(`/webhook/runner-logs/${token}?stream=stdout&seq=0`)
      .send('x')
      .expect(400);
  });

  it('expires tokens', () => {
    let now = 1000;
    const registry = new LogCallbackRegistry(() => now);
    const { token } = registry.register(() => undefined, 50);
    now += 51;
    expect(registry.deliver(token, { stream: 'stdout', seq: 1, text: 'x' })).toBe(false);
  });
});
