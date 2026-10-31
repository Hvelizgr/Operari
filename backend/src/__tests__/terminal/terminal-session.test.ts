import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  clampSize,
  PtyProcess,
  PtySpawnOptions,
  safeSegment,
  TerminalClosedInfo,
  TerminalLimitError,
  TerminalSessionManager,
} from '../../terminal/terminal-session';

class FakePty implements PtyProcess {
  readonly pid = 4242;
  written: string[] = [];
  resized: Array<[number, number]> = [];
  killed: string[] = [];
  private dataListeners: Array<(d: string) => void> = [];
  private exitListeners: Array<(e: { exitCode: number }) => void> = [];

  constructor(
    readonly file: string,
    readonly args: string[],
    readonly options: PtySpawnOptions
  ) {}

  onData(l: (d: string) => void) {
    this.dataListeners.push(l);
    return { dispose: () => undefined };
  }
  onExit(l: (e: { exitCode: number }) => void) {
    this.exitListeners.push(l);
    return { dispose: () => undefined };
  }
  write(d: string) {
    this.written.push(d);
  }
  resize(c: number, r: number) {
    this.resized.push([c, r]);
  }
  kill(signal?: string) {
    this.killed.push(signal ?? 'SIGTERM');
  }
  emitData(d: string) {
    this.dataListeners.forEach(l => l(d));
  }
  emitExit(code: number) {
    this.exitListeners.forEach(l => l({ exitCode: code }));
  }
}

function setup(overrides: Partial<ConstructorParameters<typeof TerminalSessionManager>[0]> = {}) {
  const ptys: FakePty[] = [];
  const killedContainers: string[] = [];
  let clock = 1_700_000_000_000;
  const manager = new TerminalSessionManager({
    runner: 'local',
    spawnPty: (file, args, options) => {
      const p = new FakePty(file, args, options);
      ptys.push(p);
      return p;
    },
    recordingsDir: null,
    workspacesDir: null,
    killContainer: (_bin, name) => killedContainers.push(name),
    now: () => clock,
    ...overrides,
  });
  return {
    manager,
    ptys,
    killedContainers,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const owner = { tenantId: 't1', userId: 'u1' };

describe('clampSize', () => {
  it('defaults and bounds terminal dimensions', () => {
    expect(clampSize(undefined, 'x')).toEqual({ cols: 80, rows: 24 });
    expect(clampSize(9999, 1)).toEqual({ cols: 500, rows: 5 });
    expect(clampSize(120.7, 40)).toEqual({ cols: 120, rows: 40 });
  });
});

describe('TerminalSessionManager — local runner', () => {
  it('spawns a shell with a scrubbed environment and a private home', () => {
    process.env.JWT_SECRET = 'super-secret';
    const { manager, ptys } = setup();
    const session = manager.open(
      owner,
      { cols: 100, rows: 30 },
      { onData: jest.fn(), onExit: jest.fn() }
    );

    const pty = ptys[0];
    expect(pty.options.cols).toBe(100);
    expect(pty.options.env.JWT_SECRET).toBeUndefined();
    expect(pty.options.env.TERM).toBe('xterm-256color');
    expect(pty.options.env.HOME).toBe(pty.options.cwd);
    expect(existsSync(pty.options.cwd)).toBe(true);

    session.close('client');
    expect(existsSync(pty.options.cwd)).toBe(false);
    delete process.env.JWT_SECRET;
  });

  it('streams output, forwards input and resizes', () => {
    const { manager, ptys } = setup();
    const onData = jest.fn();
    const session = manager.open(owner, {}, { onData, onExit: jest.fn() });

    ptys[0].emitData('hello\r\n');
    session.write('ls\r');
    session.resize(9999, 50);

    expect(onData).toHaveBeenCalledWith('hello\r\n');
    expect(ptys[0].written).toEqual(['ls\r']);
    expect(ptys[0].resized).toEqual([[500, 50]]);
    session.close('client');
  });

  it('reports exit with byte counts and an asciicast recording hash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'term-rec-test-'));
    const { manager, ptys, advance } = setup({ recordingsDir: dir });
    const onExit = jest.fn<void, [TerminalClosedInfo]>();
    const session = manager.open(owner, { cols: 80, rows: 24 }, { onData: jest.fn(), onExit });

    advance(1500);
    ptys[0].emitData('out');
    session.write('in');
    advance(500);
    ptys[0].emitExit(0);

    expect(onExit).toHaveBeenCalledTimes(1);
    const info = onExit.mock.calls[0][0];
    expect(info).toMatchObject({
      reason: 'exit',
      exitCode: 0,
      durationMs: 2000,
      outputBytes: 3,
      inputBytes: 2,
      runner: 'local',
    });

    const cast = readFileSync(info.recording.path as string, 'utf8');
    const lines = cast
      .trim()
      .split('\n')
      .map(l => JSON.parse(l));
    expect(lines[0]).toMatchObject({ version: 2, width: 80, height: 24 });
    expect(lines[1]).toEqual([1.5, 'o', 'out']);
    expect(info.recording.sha256).toBe(createHash('sha256').update(cast).digest('hex'));
    expect(manager.size).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('closes only once even if the process exits after a client close', () => {
    const { manager, ptys } = setup();
    const onExit = jest.fn();
    const session = manager.open(owner, {}, { onData: jest.fn(), onExit });
    session.close('client');
    ptys[0].emitExit(129);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit.mock.calls[0][0].reason).toBe('client');
    expect(ptys[0].killed).toEqual(['SIGHUP']);
  });

  it('marks the recording truncated instead of growing past the cap', () => {
    const { manager, ptys } = setup({ maxRecordingBytes: 200 });
    const onExit = jest.fn();
    const session = manager.open(owner, {}, { onData: jest.fn(), onExit });
    ptys[0].emitData('x'.repeat(500));
    session.close('client');
    expect(onExit.mock.calls[0][0].recording.truncated).toBe(true);
    expect(onExit.mock.calls[0][0].outputBytes).toBe(500);
  });

  it('enforces the per-user session limit', () => {
    const { manager } = setup({ maxSessionsPerUser: 1 });
    manager.open(owner, {}, { onData: jest.fn(), onExit: jest.fn() });
    expect(() => manager.open(owner, {}, { onData: jest.fn(), onExit: jest.fn() })).toThrow(
      TerminalLimitError
    );
    expect(() =>
      manager.open({ tenantId: 't1', userId: 'u2' }, {}, { onData: jest.fn(), onExit: jest.fn() })
    ).not.toThrow();
    manager.closeAll();
  });

  it('closes idle sessions', () => {
    jest.useFakeTimers();
    try {
      const { manager, advance } = setup({ idleTimeoutMs: 4000 });
      const onExit = jest.fn();
      manager.open(owner, {}, { onData: jest.fn(), onExit });
      advance(5000);
      jest.advanceTimersByTime(1000);
      expect(onExit).toHaveBeenCalledWith(expect.objectContaining({ reason: 'idle' }));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('TerminalSessionManager — persistent workspace', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'term-ws-test-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('uses one home per user that survives the session', () => {
    const { manager, ptys } = setup({ workspacesDir: root });
    const first = manager.open(owner, {}, { onData: jest.fn(), onExit: jest.fn() });
    const home = join(root, 't1', 'u1');
    expect(ptys[0].options.env.HOME).toBe(home);
    expect(ptys[0].options.cwd).toBe(home);
    expect(ptys[0].options.env.NPM_CONFIG_PREFIX).toBe(join(home, '.npm-global'));
    expect(ptys[0].options.env.TMPDIR).not.toBe(home);
    first.close('client');
    expect(existsSync(home)).toBe(true);

    manager.open(owner, {}, { onData: jest.fn(), onExit: jest.fn() });
    expect(ptys[1].options.env.HOME).toBe(home);
    manager.closeAll();
  });

  it('starts bash with an rc that loads the venv, the user bashrc and a localized welcome', () => {
    if (!existsSync('/bin/bash')) return;
    const { manager, ptys } = setup({ workspacesDir: root });
    manager.open(owner, { lang: 'es' }, { onData: jest.fn(), onExit: jest.fn() });
    const args = ptys[0].args;
    const rc = readFileSync(args[args.indexOf('--rcfile') + 1], 'utf8');
    expect(rc).toContain('.venv/bin/activate');
    expect(rc).toContain('. "$HOME/.bashrc"');
    expect(rc).toContain('Workspace persistente');
    manager.closeAll();
  });

  it('keeps hostile ids out of the path', () => {
    const { manager, ptys } = setup({ workspacesDir: root });
    manager.open(
      { tenantId: '../../etc', userId: 'u1' },
      {},
      { onData: jest.fn(), onExit: jest.fn() }
    );
    expect(ptys[0].options.env.HOME.startsWith(root + '/h')).toBe(true);
    manager.closeAll();
  });

  it('hashes ids that are not plain tokens', () => {
    expect(safeSegment('abc-123')).toBe('abc-123');
    expect(safeSegment('../x')).toMatch(/^h[0-9a-f]{32}$/);
    expect(safeSegment('')).toMatch(/^h[0-9a-f]{32}$/);
  });
});

describe('TerminalSessionManager — docker runner', () => {
  it('runs a hardened throwaway container and kills it on close', () => {
    const { manager, ptys, killedContainers } = setup({
      runner: 'docker',
      image: 'ghcr.io/acme/tools:1',
      network: 'none',
    });
    const session = manager.open(owner, {}, { onData: jest.fn(), onExit: jest.fn() });
    const { file, args } = ptys[0];

    expect(file).toBe('docker');
    expect(args.slice(0, 3)).toEqual(['run', '--rm', '-it']);
    expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--pids-limit', '256']));
    expect(args).toContain('operari.tenant=t1');
    expect(args).toContain('ghcr.io/acme/tools:1');

    session.close('disconnect');
    expect(killedContainers).toEqual([`operari-term-${session.id}`]);
  });

  it('mounts a per-user named volume when workspaces are persistent', () => {
    const { manager, ptys } = setup({ runner: 'docker', workspacesDir: '/unused' });
    manager.open(owner, {}, { onData: jest.fn(), onExit: jest.fn() });
    expect(ptys[0].args).toEqual(
      expect.arrayContaining(['-v', 'operari-ws-t1-u1:/workspace', '-e', 'HOME=/workspace'])
    );
    expect(ptys[0].args).not.toContain('--tmpfs');
    manager.closeAll();
  });
});
