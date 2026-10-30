import { HttpExecutor } from '../../../runbook/executors/http.executor';
import { RedisExecutor } from '../../../runbook/executors/redis.executor';
import { ShellExecutor } from '../../../runbook/executors/shell.executor';
import type { Runner } from '../../../runbook/runners/runner.types';
import type { ExecutorContext } from '../../../runbook/types/executor.types';
import { guardedFetch } from '../../../security/ssrf-guard';

const ctx = (tenantId = 't-1'): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId,
});

const fakeRunner = (type: string) =>
  ({
    type,
    run: jest.fn(async () => ({ stdout: 'ok', stderr: '', exitCode: 0, durationMs: 1 })),
    cancel: jest.fn(),
  }) as unknown as Runner & { run: jest.Mock };

describe('local shell tenant allowlist', () => {
  afterEach(() => {
    delete process.env.OPERARI_LOCAL_SHELL_TENANTS;
  });

  it('allows everyone when unset (single-tenant self-host)', async () => {
    const runner = fakeRunner('local');
    const res = await new ShellExecutor(runner).execute({ command: 'true' }, ctx());
    expect(res.success).toBe(true);
  });

  it('blocks tenants that are not listed', async () => {
    process.env.OPERARI_LOCAL_SHELL_TENANTS = 'trusted';
    const runner = fakeRunner('local');
    const res = await new ShellExecutor(runner).execute(
      { command: 'cat /proc/1/environ' },
      ctx('stranger')
    );
    expect(res.success).toBe(false);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('allows listed tenants and blocks everyone with "none"', async () => {
    process.env.OPERARI_LOCAL_SHELL_TENANTS = 'a, trusted';
    expect(
      (await new ShellExecutor(fakeRunner('local')).execute({ command: 'true' }, ctx('trusted')))
        .success
    ).toBe(true);
    process.env.OPERARI_LOCAL_SHELL_TENANTS = 'none';
    expect(
      (await new ShellExecutor(fakeRunner('local')).execute({ command: 'true' }, ctx('trusted')))
        .success
    ).toBe(false);
  });

  it('does not restrict isolated runners', async () => {
    process.env.OPERARI_LOCAL_SHELL_TENANTS = 'none';
    const res = await new ShellExecutor(fakeRunner('docker')).execute({ command: 'true' }, ctx());
    expect(res.success).toBe(true);
  });
});

describe('private targets on a shared server', () => {
  beforeEach(() => {
    process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'false';
  });
  afterEach(() => {
    process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'true';
  });

  it('http step cannot reach loopback or metadata addresses', async () => {
    const fetchMock = jest.fn();
    for (const url of ['http://127.0.0.1:6379/', 'http://169.254.169.254/latest/meta-data']) {
      const res = await new HttpExecutor(fetchMock as never).execute({ method: 'GET', url }, ctx());
      expect(res.success).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redis step cannot reach a private address', async () => {
    const createClient = jest.fn();
    const res = await new RedisExecutor(createClient as never).execute(
      { url: 'redis://10.0.0.5:6379', operation: 'get', key: 'k' },
      ctx()
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/blocked/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('a redirect to an internal address is refused', async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })
    );
    await expect(guardedFetch(fetchMock as never, 'http://93.184.215.14/', {})).rejects.toThrow(
      /blocked/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
