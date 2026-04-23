import { FlyMachineRunner } from '../../../runbook/runners/fly-machine.runner';
import { RunnerError, type RunnerContext } from '../../../runbook/runners/runner.types';

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

interface ScriptedResponse {
  status: number;
  body: unknown;
  /** Optional delay before resolving — used to simulate slow APIs */
  delayMs?: number;
}

const buildFetch = (responses: ScriptedResponse[]) => {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : null;
    calls.push({ url, method, body });

    const scripted = responses[Math.min(i, responses.length - 1)];
    i++;
    if (scripted.delayMs) {
      await new Promise(r => setTimeout(r, scripted.delayMs));
    }
    return new Response(JSON.stringify(scripted.body), {
      status: scripted.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fn, calls };
};

const ctx = (over: Partial<RunnerContext> = {}): RunnerContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  tenantId: 'tenant-1',
  ...over,
});

const buildRunner = (
  fetchFn: typeof fetch,
  opts: { region?: string; defaultImage?: string } = {}
) =>
  new FlyMachineRunner({
    apiToken: 'fly-test-token',
    appName: 'nanorun-runners',
    region: opts.region,
    defaultImage: opts.defaultImage,
    fetchImpl: fetchFn,
    apiBase: 'https://api.machines.test',
  });

describe('FlyMachineRunner constructor', () => {
  it('throws without apiToken', () => {
    expect(() => new FlyMachineRunner({ apiToken: '', appName: 'a' })).toThrow(RunnerError);
  });
  it('throws without appName', () => {
    expect(() => new FlyMachineRunner({ apiToken: 'x', appName: '' })).toThrow(RunnerError);
  });
});

describe('FlyMachineRunner.buildCreateBody', () => {
  const runner = buildRunner(buildFetch([]).fn);

  it('encodes the command into init.exec', () => {
    const body = runner.buildCreateBody({ command: 'echo hi' }, ctx()) as {
      config: { init: { exec: string[] } };
    };
    expect(body.config.init.exec).toEqual(['sh', '-c', 'echo hi']);
  });

  it('uses the default image when none is provided', () => {
    const body = runner.buildCreateBody({ command: 'true' }, ctx()) as {
      config: { image: string };
    };
    expect(body.config.image).toBe('alpine:3.20');
  });

  it('honors a custom image, shell, and resources', () => {
    const body = runner.buildCreateBody(
      {
        command: 'echo $0',
        shell: 'bash',
        image: 'ghcr.io/nanorun/runner:1.2.3',
        resources: { memoryMb: 512, cpuMillis: 2000 },
      },
      ctx()
    ) as {
      config: {
        image: string;
        init: { exec: string[] };
        guest: { cpus: number; memory_mb: number };
      };
    };
    expect(body.config.image).toBe('ghcr.io/nanorun/runner:1.2.3');
    expect(body.config.init.exec).toEqual(['bash', '-c', 'echo $0']);
    expect(body.config.guest.cpus).toBe(2);
    expect(body.config.guest.memory_mb).toBe(512);
  });

  it('forces restart=no and disables auto_destroy so we can read state', () => {
    const body = runner.buildCreateBody({ command: 'true' }, ctx()) as {
      config: { restart: { policy: string }; auto_destroy: boolean };
    };
    expect(body.config.restart.policy).toBe('no');
    expect(body.config.auto_destroy).toBe(false);
  });

  it('attaches NanoRun audit metadata', () => {
    const body = runner.buildCreateBody(
      { command: 'true' },
      ctx({ runId: 'r-9', stepId: 's-9', tenantId: 't-9' })
    ) as { config: { metadata: Record<string, string> } };
    expect(body.config.metadata['nanorun.run.id']).toBe('r-9');
    expect(body.config.metadata['nanorun.step.id']).toBe('s-9');
    expect(body.config.metadata['nanorun.tenant.id']).toBe('t-9');
  });

  it('rejects malicious env var names', () => {
    expect(() =>
      runner.buildCreateBody({ command: 'true', env: { 'EVIL;rm -rf /': 'x' } }, ctx())
    ).toThrow(RunnerError);
  });

  it('emits region only when configured', () => {
    const body = runner.buildCreateBody({ command: 'true' }, ctx()) as { region?: string };
    expect(body.region).toBeUndefined();

    const regional = buildRunner(buildFetch([]).fn, { region: 'iad' });
    const body2 = regional.buildCreateBody({ command: 'true' }, ctx()) as { region?: string };
    expect(body2.region).toBe('iad');
  });
});

describe('FlyMachineRunner.extractExitCode', () => {
  it('reads state_obj.exit_code', () => {
    expect(
      FlyMachineRunner.extractExitCode({
        id: 'm',
        state: 'stopped',
        state_obj: { exit_code: 7 },
      })
    ).toBe(7);
  });
  it('reads state_obj.exit_event.exit_code', () => {
    expect(
      FlyMachineRunner.extractExitCode({
        id: 'm',
        state: 'stopped',
        state_obj: { exit_event: { exit_code: 3 } },
      })
    ).toBe(3);
  });
  it('falls back to the latest event with an exit_event', () => {
    expect(
      FlyMachineRunner.extractExitCode({
        id: 'm',
        state: 'stopped',
        events: [{ type: 'launch' }, { type: 'exit', request: { exit_event: { exit_code: 5 } } }],
      })
    ).toBe(5);
  });
  it('returns null when no exit code is found', () => {
    expect(FlyMachineRunner.extractExitCode({ id: 'm', state: 'stopped' })).toBeNull();
  });
});

describe('FlyMachineRunner.run', () => {
  it('executes the create → wait → state → destroy sequence happy path', async () => {
    const { fn, calls } = buildFetch([
      // 1. create
      { status: 200, body: { id: 'machine-abc', state: 'created' } },
      // 2. wait
      { status: 200, body: { id: 'machine-abc', state: 'stopped' } },
      // 3. state
      {
        status: 200,
        body: { id: 'machine-abc', state: 'stopped', state_obj: { exit_code: 0 } },
      },
      // 4. destroy
      { status: 200, body: { ok: true } },
    ]);
    const runner = buildRunner(fn);

    const result = await runner.run({ command: 'echo ok' }, ctx());

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.metadata?.backend).toBe('fly');
    expect(result.metadata?.machineId).toBe('machine-abc');

    expect(calls).toHaveLength(4);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/v1/apps/nanorun-runners/machines');
    expect(calls[1].method).toBe('GET');
    expect(calls[1].url).toContain('/wait?state=stopped');
    expect(calls[2].method).toBe('GET');
    expect(calls[2].url).toContain('/machines/machine-abc');
    expect(calls[3].method).toBe('DELETE');
    expect(calls[3].url).toContain('?force=true');
  });

  it('returns the actual non-zero exit code from state_obj', async () => {
    const { fn } = buildFetch([
      { status: 200, body: { id: 'm-1', state: 'created' } },
      { status: 200, body: { id: 'm-1', state: 'stopped' } },
      { status: 200, body: { id: 'm-1', state: 'stopped', state_obj: { exit_code: 42 } } },
      { status: 200, body: {} },
    ]);
    const runner = buildRunner(fn);
    const result = await runner.run({ command: 'false' }, ctx());
    expect(result.exitCode).toBe(42);
  });

  it('reports a timeout when wait returns 408', async () => {
    const { fn } = buildFetch([
      { status: 200, body: { id: 'm-1', state: 'created' } },
      { status: 408, body: { error: 'wait timeout' } },
      { status: 200, body: {} }, // destroy
    ]);
    const runner = buildRunner(fn);
    const result = await runner.run({ command: 'sleep 999', timeoutMs: 2000 }, ctx());
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  });

  it('returns failure when create fails and does NOT call destroy', async () => {
    const { fn, calls } = buildFetch([{ status: 401, body: { error: 'unauthorized' } }]);
    const runner = buildRunner(fn);
    const result = await runner.run({ command: 'true' }, ctx());
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain('Fly create failed');
    expect(calls).toHaveLength(1);
  });

  it('always destroys the machine even on a downstream failure', async () => {
    const { fn, calls } = buildFetch([
      { status: 200, body: { id: 'machine-xyz', state: 'created' } },
      { status: 200, body: { id: 'machine-xyz', state: 'stopped' } },
      // state read fails
      { status: 500, body: { error: 'internal' } },
      // destroy
      { status: 200, body: {} },
    ]);
    const runner = buildRunner(fn);
    const result = await runner.run({ command: 'true' }, ctx());
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain('state read failed');
    expect(calls[3].method).toBe('DELETE');
    expect(calls[3].url).toContain('machine-xyz');
  });
});

describe('FlyMachineRunner.cancel', () => {
  it('returns 0 when no run is in flight for the given runId', async () => {
    const { fn } = buildFetch([]);
    const runner = buildRunner(fn);
    await expect(runner.cancel('ghost')).resolves.toBe(0);
  });

  it('issues DELETE for an in-flight machine while run() is waiting', async () => {
    // Script: create succeeds, then wait hangs long enough for cancel
    // to fire its own DELETE, then wait returns 408 so run() resolves.
    const { fn, calls } = buildFetch([
      { status: 200, body: { id: 'machine-cancel', state: 'created' } },
      // wait — slow, gets pre-empted by cancel's DELETE
      { status: 408, body: { error: 'timeout' }, delayMs: 50 },
      // cancel's DELETE
      { status: 200, body: {} },
      // run()'s own destroy in finally{}
      { status: 200, body: {} },
    ]);
    const runner = buildRunner(fn);

    const runPromise = runner.run(
      { command: 'sleep 30', timeoutMs: 10_000 },
      ctx({ runId: 'r-cancel' })
    );

    // Yield once so the create POST resolves and the machineId is tracked
    await new Promise(resolve => setTimeout(resolve, 10));

    const cancelled = await runner.cancel('r-cancel');
    expect(cancelled).toBe(1);

    // The DELETE that came from cancel() should be in calls[]
    const deletes = calls.filter(c => c.method === 'DELETE');
    expect(deletes.length).toBeGreaterThanOrEqual(1);
    expect(deletes[0].url).toContain('machine-cancel');
    expect(deletes[0].url).toContain('force=true');

    await runPromise;
  });
});

describe('FlyMachineRunner.healthcheck', () => {
  it('passes on 200', async () => {
    const { fn } = buildFetch([{ status: 200, body: { name: 'nanorun-runners' } }]);
    const runner = buildRunner(fn);
    await expect(runner.healthcheck()).resolves.toBeUndefined();
  });

  it('throws RunnerError on non-2xx', async () => {
    const { fn } = buildFetch([{ status: 401, body: { error: 'bad token' } }]);
    const runner = buildRunner(fn);
    await expect(runner.healthcheck()).rejects.toThrow(RunnerError);
  });
});
