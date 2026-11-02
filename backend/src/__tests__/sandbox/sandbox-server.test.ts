import { AddressInfo } from 'net';

import type { DockerRunner } from '../../runbook/runners/docker.runner';
import type { RunnerContext, RunnerSpec } from '../../runbook/runners/runner.types';
import { SandboxRunner } from '../../runbook/runners/sandbox.runner';
import { SandboxClient } from '../../sandbox/client';
import { createSandboxServer, SandboxServer } from '../../sandbox/server';
import { RemotePty } from '../../terminal/remote-pty';
import type { PtyProcess, PtySpawnOptions } from '../../terminal/terminal-session';

const TOKEN = 'x'.repeat(40);

class FakePty implements PtyProcess {
  readonly pid = 1;
  written: string[] = [];
  resized: Array<[number, number]> = [];
  killed = false;
  private data: Array<(d: string) => void> = [];
  private exit: Array<(e: { exitCode: number }) => void> = [];
  constructor(
    readonly file: string,
    readonly args: string[],
    readonly options: PtySpawnOptions
  ) {}
  onData(l: (d: string) => void) {
    this.data.push(l);
    return { dispose: () => undefined };
  }
  onExit(l: (e: { exitCode: number }) => void) {
    this.exit.push(l);
    return { dispose: () => undefined };
  }
  write(d: string) {
    this.written.push(d);
  }
  resize(c: number, r: number) {
    this.resized.push([c, r]);
  }
  kill() {
    this.killed = true;
  }
  emit(d: string) {
    for (const l of this.data) l(d);
  }
  end(code: number) {
    for (const l of this.exit) l({ exitCode: code });
  }
}

interface Harness {
  server: SandboxServer;
  client: SandboxClient;
  ptys: FakePty[];
  killed: string[];
  prepared: string[];
  runs: Array<{ spec: RunnerSpec; context: RunnerContext }>;
  cancelled: string[];
}

const waitFor = async (check: () => boolean, ms = 2000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await new Promise(r => setTimeout(r, 5));
  }
};

async function start(overrides: { orphanMs?: number } = {}): Promise<Harness> {
  const h = {
    ptys: [] as FakePty[],
    killed: [] as string[],
    prepared: [] as string[],
    runs: [] as Harness['runs'],
    cancelled: [] as string[],
  };
  const runner = {
    healthcheck: async () => undefined,
    cancel: async (runId: string) => {
      h.cancelled.push(runId);
      return 1;
    },
    run: async (spec: RunnerSpec, context: RunnerContext) => {
      h.runs.push({ spec, context });
      context.emit?.({ type: 'stdout', text: 'hello ', timestamp: new Date() });
      context.emit?.({ type: 'stderr', text: 'warn', timestamp: new Date() });
      return { exitCode: 3, stdout: 'hello', stderr: 'warn', timedOut: false, durationMs: 7 };
    },
  } as unknown as DockerRunner;
  const server = createSandboxServer({
    token: TOKEN,
    images: ['alpine:3.20', 'python:3.12-alpine'],
    network: 'operari-sandbox',
    spawnPty: (file, args, options) => {
      const p = new FakePty(file, args, options);
      h.ptys.push(p);
      return p;
    },
    prepareVolume: (_b, volume) => h.prepared.push(volume),
    killContainer: (_b, name) => h.killed.push(name),
    runner,
    ...overrides,
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const client = new SandboxClient({ url: `http://127.0.0.1:${port}`, token: TOKEN });
  return { server, client, ...h };
}

let h: Harness;
afterEach(async () => {
  h.server.closeTerminals();
  h.server.closeAllConnections();
  await new Promise(r => h.server.close(r));
});

describe('sandbox-runner server', () => {
  it('rejects requests without the token', async () => {
    h = await start();
    const { port } = h.server.address() as AddressInfo;
    const bad = new SandboxClient({ url: `http://127.0.0.1:${port}`, token: 'y'.repeat(40) });
    await expect(bad.health()).rejects.toMatchObject({ status: 401 });
    await expect(h.client.health()).resolves.toMatchObject({
      ok: true,
      network: 'operari-sandbox',
    });
  });

  it('refuses a short token and dangerous networks at startup', () => {
    const base = {
      images: ['alpine:3.20'],
      spawnPty: () => {
        throw new Error('unused');
      },
      prepareVolume: () => undefined,
    };
    expect(() =>
      createSandboxServer({ ...base, token: 'short', network: 'operari-sandbox' })
    ).toThrow();
    expect(() => createSandboxServer({ ...base, token: TOKEN, network: 'host' })).toThrow();
  });

  it('streams a run through SandboxRunner and clamps limits', async () => {
    h = await start();
    const events: string[] = [];
    const result = await new SandboxRunner(h.client).run(
      {
        command: 'echo hello',
        network: 'open',
        timeoutMs: 999 * 60 * 60_000,
        resources: { memoryMb: 99_999, cpuMillis: 99_999 },
      },
      { runId: 'r1', stepId: 's1', tenantId: 't1', emit: e => events.push(`${e.type}:${e.text}`) }
    );
    expect(result).toMatchObject({ exitCode: 3, stdout: 'hello', stderr: 'warn', timedOut: false });
    expect(events).toEqual(['stdout:hello ', 'stderr:warn']);
    const { spec, context } = h.runs[0];
    expect(spec.image).toBe('alpine:3.20');
    expect(spec.timeoutMs).toBe(60 * 60_000);
    expect(spec.resources).toEqual({ memoryMb: 2048, cpuMillis: 2000 });
    expect(context).toMatchObject({ runId: 'r1', stepId: 's1', tenantId: 't1' });
  });

  it('refuses images outside the allowlist and unknown shells', async () => {
    h = await start();
    const runner = new SandboxRunner(h.client);
    const ctx = { runId: 'r', stepId: 's', tenantId: 't' };
    const result = await runner.run({ command: 'id', image: 'ubuntu:latest' }, ctx);
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toMatch(/image not allowed/);
    await expect(runner.run({ command: 'id', shell: 'zsh' }, ctx)).rejects.toThrow(/shell/);
    expect(h.runs).toHaveLength(0);
  });

  it('forwards cancel', async () => {
    h = await start();
    await expect(new SandboxRunner(h.client).cancel('r9')).resolves.toBe(1);
    expect(h.cancelled).toEqual(['r9']);
  });

  it('runs a terminal end to end through RemotePty', async () => {
    h = await start();
    const pty = new RemotePty(
      h.client,
      { tenantId: 't1', userId: 'u1' },
      { cols: 90, rows: 30 },
      true
    );
    const output: string[] = [];
    let exitCode: number | null = null;
    pty.onData(d => output.push(d));
    pty.onExit(e => (exitCode = e.exitCode));
    pty.write('a');
    pty.write('b');
    pty.write('c');

    await waitFor(() => h.ptys.length === 1);
    const remote = h.ptys[0];
    expect(remote.file).toBe('docker');
    expect(remote.options).toMatchObject({ cols: 90, rows: 30 });
    expect(remote.args).toEqual(
      expect.arrayContaining([
        '--cap-drop=ALL',
        '--network',
        'operari-sandbox',
        '--mount',
        'type=volume,source=operari-ws-t1-u1,target=/workspace,volume-nocopy=true',
      ])
    );
    expect(h.prepared).toEqual(['operari-ws-t1-u1']);

    remote.emit('prompt$ ');
    await waitFor(() => output.join('') === 'prompt$ ');
    await waitFor(() => remote.written.length === 3);
    expect(remote.written).toEqual(['a', 'b', 'c']);

    pty.resize(100, 40);
    await waitFor(() => remote.resized.length === 1);
    expect(remote.resized).toEqual([[100, 40]]);

    remote.end(0);
    await waitFor(() => exitCode !== null);
    expect(exitCode).toBe(0);
  });

  it('kills the container when the backend closes the terminal', async () => {
    h = await start();
    const pty = new RemotePty(
      h.client,
      { tenantId: 't1', userId: 'u1' },
      { cols: 80, rows: 24 },
      false
    );
    await waitFor(() => h.ptys.length === 1);
    expect(h.prepared).toEqual([]);
    expect(h.ptys[0].args.some(a => a.startsWith('/workspace:rw'))).toBe(true);
    pty.kill();
    await waitFor(() => h.killed.length === 1);
    expect(h.killed[0]).toMatch(/^operari-term-/);
    expect(h.ptys[0].killed).toBe(true);
  });

  it('kills a terminal nobody reads', async () => {
    h = await start({ orphanMs: 30 });
    await h.client.openTerminal({
      tenantId: 't',
      userId: 'u',
      cols: 80,
      rows: 24,
      persistent: false,
    });
    await waitFor(() => h.killed.length === 1);
  });

  it('reports an unreachable sandbox as terminal output instead of throwing', async () => {
    h = await start();
    const dead = new SandboxClient({ url: 'http://127.0.0.1:1', token: TOKEN });
    const pty = new RemotePty(dead, { tenantId: 't', userId: 'u' }, { cols: 80, rows: 24 }, false);
    const output: string[] = [];
    let exitCode: number | null = null;
    pty.onData(d => output.push(d));
    pty.onExit(e => (exitCode = e.exitCode));
    await waitFor(() => exitCode !== null);
    expect(exitCode).toBe(1);
    expect(output.join('')).toMatch(/sandbox unreachable/);
  });
});
