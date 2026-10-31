import { spawn as nodeSpawn } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface PtyProcess {
  readonly pid: number;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface PtySpawnOptions {
  name: string;
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
}

export type PtySpawn = (file: string, args: string[], options: PtySpawnOptions) => PtyProcess;

export type TerminalRunnerType = 'local' | 'docker';

export interface TerminalOwner {
  tenantId: string;
  userId: string;
}

export interface TerminalClosedInfo {
  sessionId: string;
  owner: TerminalOwner;
  runner: TerminalRunnerType;
  reason: TerminalCloseReason;
  exitCode: number | null;
  durationMs: number;
  outputBytes: number;
  inputBytes: number;
  recording: { sha256: string; bytes: number; truncated: boolean; path: string | null };
}

export type TerminalCloseReason = 'exit' | 'client' | 'disconnect' | 'idle' | 'max_duration';

export interface TerminalSessionHooks {
  onData(data: string): void;
  onExit(info: TerminalClosedInfo): void;
}

export interface TerminalManagerOptions {
  runner: TerminalRunnerType;
  spawnPty?: PtySpawn;
  dockerBinary?: string;
  image?: string;
  network?: string;
  maxSessionsPerUser?: number;
  idleTimeoutMs?: number;
  maxDurationMs?: number;
  recordingsDir?: string | null;
  maxRecordingBytes?: number;
  killContainer?: (dockerBinary: string, name: string) => void;
  now?: () => number;
}

interface SessionConfig {
  runner: TerminalRunnerType;
  spawnPty: PtySpawn;
  dockerBinary: string;
  image: string;
  network: string;
  idleTimeoutMs: number;
  maxDurationMs: number;
  recordingsDir: string | null;
  maxRecordingBytes: number;
  killContainer: (dockerBinary: string, name: string) => void;
  now: () => number;
}

export class TerminalLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TerminalLimitError';
  }
}

const TERM_NAME = 'xterm-256color';
const PASSTHROUGH_ENV = ['PATH', 'LANG', 'LC_ALL', 'TZ'];

export function clampSize(cols: unknown, rows: unknown): { cols: number; rows: number } {
  const c = Number.isFinite(Number(cols)) ? Math.trunc(Number(cols)) : 80;
  const r = Number.isFinite(Number(rows)) ? Math.trunc(Number(rows)) : 24;
  return { cols: Math.min(500, Math.max(10, c)), rows: Math.min(200, Math.max(5, r)) };
}

function loadNodePty(): PtySpawn {
  // Lazy: node-pty is a native addon, so a missing or broken build must only
  // disable the terminal instead of failing the whole backend at boot.
  const pty = require('node-pty') as { spawn: PtySpawn };
  return pty.spawn;
}

function defaultKillContainer(dockerBinary: string, name: string): void {
  try {
    const proc = nodeSpawn(dockerBinary, ['kill', name], { stdio: 'ignore' });
    proc.on('error', () => undefined);
  } catch {
    // Container already gone.
  }
}

class Recorder {
  private readonly chunks: string[] = [];
  private bytes = 0;
  truncated = false;

  constructor(
    private readonly startedAt: number,
    private readonly maxBytes: number,
    cols: number,
    rows: number
  ) {
    this.push(
      JSON.stringify({
        version: 2,
        width: cols,
        height: rows,
        timestamp: Math.floor(startedAt / 1000),
        env: { TERM: TERM_NAME },
      })
    );
  }

  event(now: number, code: 'o' | 'r', data: string): void {
    this.push(JSON.stringify([Number(((now - this.startedAt) / 1000).toFixed(6)), code, data]));
  }

  private push(line: string): void {
    if (this.truncated) return;
    const size = Buffer.byteLength(line) + 1;
    if (this.bytes + size > this.maxBytes) {
      this.truncated = true;
      return;
    }
    this.chunks.push(line);
    this.bytes += size;
  }

  serialize(): string {
    return this.chunks.join('\n') + '\n';
  }
}

export class TerminalSession {
  readonly id = randomUUID();
  readonly startedAt: number;
  private closed = false;
  private lastActivity: number;
  private outputBytes = 0;
  private inputBytes = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private maxTimer: NodeJS.Timeout | null = null;
  private readonly recorder: Recorder;
  private pty: PtyProcess | null = null;
  private workDir: string | null = null;
  private containerName: string | null = null;

  constructor(
    private readonly manager: TerminalSessionManager,
    readonly owner: TerminalOwner,
    private readonly hooks: TerminalSessionHooks,
    private readonly cfg: SessionConfig,
    size: { cols: number; rows: number }
  ) {
    this.startedAt = cfg.now();
    this.lastActivity = this.startedAt;
    this.recorder = new Recorder(this.startedAt, cfg.maxRecordingBytes, size.cols, size.rows);
  }

  get runner(): TerminalRunnerType {
    return this.cfg.runner;
  }

  start(size: { cols: number; rows: number }): void {
    const { file, args, cwd, env } = this.buildCommand();
    this.pty = this.cfg.spawnPty(file, args, { name: TERM_NAME, ...size, cwd, env });
    this.pty.onData(data => {
      if (this.closed) return;
      this.outputBytes += Buffer.byteLength(data);
      this.recorder.event(this.cfg.now(), 'o', data);
      this.hooks.onData(data);
    });
    this.pty.onExit(({ exitCode }) => this.finish('exit', exitCode));
    this.armTimers();
  }

  write(data: string): void {
    if (this.closed || !this.pty) return;
    this.inputBytes += Buffer.byteLength(data);
    this.touch();
    this.pty.write(data);
  }

  resize(cols: unknown, rows: unknown): void {
    if (this.closed || !this.pty) return;
    const size = clampSize(cols, rows);
    this.pty.resize(size.cols, size.rows);
    this.recorder.event(this.cfg.now(), 'r', `${size.cols}x${size.rows}`);
  }

  close(reason: Exclude<TerminalCloseReason, 'exit'>): void {
    if (this.closed) return;
    try {
      this.pty?.kill('SIGHUP');
    } catch {
      // Process already gone.
    }
    this.finish(reason, null);
  }

  private buildCommand(): {
    file: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
  } {
    const env: Record<string, string> = { TERM: TERM_NAME, COLORTERM: 'truecolor' };
    for (const key of PASSTHROUGH_ENV) {
      const value = process.env[key];
      if (value) env[key] = value;
    }

    if (this.cfg.runner === 'docker') {
      this.containerName = `operari-term-${this.id}`;
      return {
        file: this.cfg.dockerBinary,
        args: [
          'run',
          '--rm',
          '-it',
          '--name',
          this.containerName,
          '--label',
          `operari.tenant=${this.owner.tenantId}`,
          '--label',
          `operari.terminal=${this.id}`,
          '--network',
          this.cfg.network,
          '--memory',
          '512m',
          '--cpus',
          '1',
          '--pids-limit',
          '256',
          '--security-opt',
          'no-new-privileges',
          '-e',
          `TERM=${TERM_NAME}`,
          '-w',
          '/workspace',
          '--tmpfs',
          '/workspace:rw,exec,size=256m',
          this.cfg.image,
          'sh',
          '-c',
          'command -v bash >/dev/null && exec bash -l || exec sh -l',
        ],
        cwd: tmpdir(),
        env,
      };
    }

    this.workDir = mkdtempSync(join(tmpdir(), `operari-term-${this.id}-`));
    env.HOME = this.workDir;
    env.TMPDIR = this.workDir;
    env.PS1 = '\\[\\e[32m\\]operari\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]$ ';
    const shell = existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
    const args = shell === '/bin/bash' ? ['--noprofile', '--norc', '-i'] : ['-i'];
    return { file: shell, args, cwd: this.workDir, env };
  }

  private touch(): void {
    this.lastActivity = this.cfg.now();
  }

  private armTimers(): void {
    const checkEvery = Math.max(1000, Math.min(60_000, Math.floor(this.cfg.idleTimeoutMs / 4)));
    this.idleTimer = setInterval(() => {
      if (this.cfg.now() - this.lastActivity >= this.cfg.idleTimeoutMs) this.close('idle');
    }, checkEvery);
    this.idleTimer.unref?.();
    this.maxTimer = setTimeout(() => this.close('max_duration'), this.cfg.maxDurationMs);
    this.maxTimer.unref?.();
  }

  private finish(reason: TerminalCloseReason, exitCode: number | null): void {
    if (this.closed) return;
    this.closed = true;
    if (this.idleTimer) clearInterval(this.idleTimer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    if (this.containerName) this.cfg.killContainer(this.cfg.dockerBinary, this.containerName);
    if (this.workDir) {
      try {
        rmSync(this.workDir, { recursive: true, force: true });
      } catch {
        // Best effort; tmp is reaped by the OS eventually.
      }
    }
    this.manager.release(this);

    const recording = this.recorder.serialize();
    const sha256 = createHash('sha256').update(recording).digest('hex');
    let path: string | null = null;
    if (this.cfg.recordingsDir) {
      try {
        mkdirSync(this.cfg.recordingsDir, { recursive: true, mode: 0o700 });
        path = join(this.cfg.recordingsDir, `${this.id}.cast`);
        writeFileSync(path, recording, { mode: 0o600 });
      } catch {
        path = null;
      }
    }

    this.hooks.onExit({
      sessionId: this.id,
      owner: this.owner,
      runner: this.cfg.runner,
      reason,
      exitCode,
      durationMs: this.cfg.now() - this.startedAt,
      outputBytes: this.outputBytes,
      inputBytes: this.inputBytes,
      recording: {
        sha256,
        bytes: Buffer.byteLength(recording),
        truncated: this.recorder.truncated,
        path,
      },
    });
  }
}

export class TerminalSessionManager {
  private readonly sessions = new Map<string, TerminalSession>();
  private readonly cfg: SessionConfig;
  private readonly maxSessionsPerUser: number;

  constructor(options: TerminalManagerOptions) {
    this.maxSessionsPerUser = options.maxSessionsPerUser ?? 3;
    this.cfg = {
      runner: options.runner,
      spawnPty: options.spawnPty ?? loadNodePty(),
      dockerBinary: options.dockerBinary ?? 'docker',
      image: options.image ?? 'alpine:3.20',
      network: options.network ?? 'bridge',
      idleTimeoutMs: options.idleTimeoutMs ?? 15 * 60_000,
      maxDurationMs: options.maxDurationMs ?? 4 * 60 * 60_000,
      recordingsDir:
        options.recordingsDir === undefined
          ? join(tmpdir(), 'operari-terminal-recordings')
          : options.recordingsDir,
      maxRecordingBytes: options.maxRecordingBytes ?? 10 * 1024 * 1024,
      killContainer: options.killContainer ?? defaultKillContainer,
      now: options.now ?? Date.now,
    };
  }

  open(
    owner: TerminalOwner,
    size: { cols?: unknown; rows?: unknown },
    hooks: TerminalSessionHooks
  ): TerminalSession {
    const active = this.countFor(owner.userId);
    if (active >= this.maxSessionsPerUser) {
      throw new TerminalLimitError(
        `You already have ${active} open terminals (limit ${this.maxSessionsPerUser}). Close one first.`
      );
    }
    const clamped = clampSize(size.cols, size.rows);
    const session = new TerminalSession(this, owner, hooks, this.cfg, clamped);
    this.sessions.set(session.id, session);
    try {
      session.start(clamped);
    } catch (err) {
      this.sessions.delete(session.id);
      throw err;
    }
    return session;
  }

  release(session: TerminalSession): void {
    this.sessions.delete(session.id);
  }

  countFor(userId: string): number {
    let n = 0;
    for (const s of this.sessions.values()) if (s.owner.userId === userId) n++;
    return n;
  }

  get size(): number {
    return this.sessions.size;
  }

  closeAll(): void {
    for (const s of Array.from(this.sessions.values())) s.close('disconnect');
  }
}
