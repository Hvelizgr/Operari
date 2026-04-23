import { LocalRunner } from '../../../runbook/runners/local.runner';
import type { RunnerContext } from '../../../runbook/runners/runner.types';

const ctx = (): RunnerContext => ({
  runId: 'run-test',
  stepId: 'step-1',
  tenantId: 'tenant-test',
});

describe('LocalRunner', () => {
  const runner = new LocalRunner();

  it('captures stdout from a successful command', async () => {
    const result = await runner.run({ command: 'echo hello' }, ctx());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
    expect(result.stderr).toBe('');
    expect(result.timedOut).toBe(false);
  });

  it('captures stderr and non-zero exit codes', async () => {
    const result = await runner.run({ command: 'echo oops 1>&2; exit 7' }, ctx());
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe('oops');
  });

  it('respects timeoutMs', async () => {
    const result = await runner.run({ command: 'sleep 2', timeoutMs: 200 }, ctx());
    expect(result.timedOut).toBe(true);
    expect(result.durationMs).toBeLessThan(1500);
  });

  it('streams output via emit', async () => {
    const events: string[] = [];
    const result = await runner.run(
      { command: 'echo line1; echo line2' },
      { ...ctx(), emit: e => events.push(`${e.type}:${e.text.trim()}`) }
    );
    expect(result.exitCode).toBe(0);
    expect(events.some(e => e.startsWith('stdout:'))).toBe(true);
  });

  it('injects custom env vars', async () => {
    const result = await runner.run(
      {
        command: 'echo $NANORUN_TEST_VAR',
        env: { NANORUN_TEST_VAR: 'pong' },
      },
      ctx()
    );
    expect(result.stdout).toBe('pong');
  });

  describe('cancel', () => {
    it('returns 0 when no run is in flight for the given runId', async () => {
      const r = new LocalRunner();
      await expect(r.cancel('does-not-exist')).resolves.toBe(0);
    });

    it('kills an in-flight process and the run resolves with timedOut=false', async () => {
      const r = new LocalRunner();
      const runPromise = r.run({ command: 'sleep 30' }, ctx());

      // Give spawn() a tick to register in the in-flight map
      await new Promise(resolve => setImmediate(resolve));

      const cancelled = await r.cancel('run-test');
      expect(cancelled).toBe(1);

      const result = await runPromise;
      // SIGKILL → exitCode null
      expect(result.exitCode).toBeNull();
      expect(result.timedOut).toBe(false);
    });

    it('cleans the tracking table after the run finishes naturally', async () => {
      const r = new LocalRunner();
      await r.run({ command: 'echo done' }, ctx());
      await expect(r.cancel('run-test')).resolves.toBe(0);
    });
  });
});
