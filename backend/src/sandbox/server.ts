import { spawn as nodeSpawn } from 'child_process';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { ZodSchema } from 'zod';

import { DockerRunner } from '../runbook/runners/docker.runner';
import type { RunnerSpec } from '../runbook/runners/runner.types';
import { assertSandboxNetwork } from '../runbook/runners/sandbox-profile';
import { PtyProcess, PtySpawn, workspaceVolumeName } from '../terminal/terminal-session';
import {
  cancelRequestSchema,
  LIMITS,
  runRequestSchema,
  RunStreamLine,
  terminalInputSchema,
  terminalOpenSchema,
  terminalResizeSchema,
  TerminalStreamLine,
} from './protocol';
import { buildTerminalDockerArgs } from './terminal-args';

export interface SandboxServerConfig {
  token: string;
  /** Allowed images; the first one is the default for runs. */
  images: string[];
  terminalImage?: string;
  network: string;
  runtime?: string;
  dockerBinary?: string;
  maxTerminals?: number;
  maxRuns?: number;
  /** A terminal nobody is reading is killed after this long. */
  orphanMs?: number;
  spawnPty: PtySpawn;
  prepareVolume: (dockerBinary: string, volume: string, image: string) => void;
  killContainer?: (dockerBinary: string, name: string) => void;
  runner?: DockerRunner;
}

interface TerminalEntry {
  id: string;
  containerName: string;
  pty: PtyProcess;
  buffer: string[];
  bufferBytes: number;
  consumer: ServerResponse | null;
  exitCode: number | null | undefined;
  orphanTimer: NodeJS.Timeout | null;
}

const MAX_BODY = 2 * 1024 * 1024;
const MAX_BUFFER = 1024 * 1024;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function defaultKill(dockerBinary: string, name: string): void {
  try {
    nodeSpawn(dockerBinary, ['kill', name], { stdio: 'ignore' }).on('error', () => undefined);
  } catch {
    // Already gone.
  }
}

function readJson<T>(req: IncomingMessage, schema: ZodSchema<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        return reject(new HttpError(400, 'invalid json'));
      }
      const result = schema.safeParse(parsed);
      if (!result.success) return reject(new HttpError(400, result.error.issues[0].message));
      resolve(result.data);
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function writeLine(res: ServerResponse, line: RunStreamLine | TerminalStreamLine): void {
  res.write(JSON.stringify(line) + '\n');
}

export interface SandboxServer extends Server {
  /** Kills every terminal; streams end so `close()` can finish. */
  closeTerminals(): void;
}

export function createSandboxServer(config: SandboxServerConfig): SandboxServer {
  if (config.token.length < 32) throw new Error('sandbox token must be at least 32 characters');
  if (config.images.length === 0) throw new Error('at least one sandbox image is required');
  const network = assertSandboxNetwork(config.network);
  const dockerBinary = config.dockerBinary ?? 'docker';
  const terminalImage = config.terminalImage ?? config.images[0];
  const maxTerminals = config.maxTerminals ?? 20;
  const maxRuns = config.maxRuns ?? 20;
  const orphanMs = config.orphanMs ?? 60_000;
  const kill = config.killContainer ?? defaultKill;
  const runner =
    config.runner ??
    new DockerRunner({
      defaultImage: config.images[0],
      dockerBinary,
      sandboxNetwork: network,
      runtime: config.runtime,
    });
  const tokenDigest = digest(config.token);
  const terminals = new Map<string, TerminalEntry>();
  const preparedVolumes = new Set<string>();
  let activeRuns = 0;

  function authorized(req: IncomingMessage): boolean {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) return false;
    return timingSafeEqual(digest(header.slice(7)), tokenDigest);
  }

  function terminal(id: string): TerminalEntry {
    const entry = terminals.get(id);
    if (!entry) throw new HttpError(404, 'terminal not found');
    return entry;
  }

  function armOrphan(entry: TerminalEntry): void {
    if (entry.orphanTimer) clearTimeout(entry.orphanTimer);
    entry.orphanTimer = setTimeout(() => closeTerminal(entry), orphanMs);
    entry.orphanTimer.unref?.();
  }

  function closeTerminal(entry: TerminalEntry): void {
    if (entry.orphanTimer) clearTimeout(entry.orphanTimer);
    terminals.delete(entry.id);
    if (entry.exitCode === undefined) {
      try {
        entry.pty.kill('SIGHUP');
      } catch {
        // Already gone.
      }
      kill(dockerBinary, entry.containerName);
    }
    entry.consumer?.end();
  }

  async function handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readJson(req, runRequestSchema);
    const image = body.spec.image ?? config.images[0];
    if (!config.images.includes(image)) throw new HttpError(400, `image not allowed: ${image}`);
    if (activeRuns >= maxRuns) throw new HttpError(429, 'too many concurrent runs');

    const spec: RunnerSpec = {
      command: body.spec.command,
      shell: body.spec.shell,
      cwd: body.spec.cwd,
      env: body.spec.env,
      image,
      network: body.spec.network,
      timeoutMs: Math.min(body.spec.timeoutMs ?? 60_000, LIMITS.maxTimeoutMs),
      resources: {
        memoryMb: Math.min(body.spec.resources?.memoryMb ?? 512, LIMITS.maxMemoryMb),
        cpuMillis: Math.min(body.spec.resources?.cpuMillis ?? 1000, LIMITS.maxCpuMillis),
      },
    };

    activeRuns++;
    let finished = false;
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    res.on('close', () => {
      if (!finished) void runner.cancel(body.context.runId);
    });
    try {
      const result = await runner.run(spec, {
        ...body.context,
        emit: event => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            writeLine(res, { t: event.type, d: String(event.text ?? '') });
          }
        },
      });
      writeLine(res, {
        t: 'result',
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
      });
    } catch (err) {
      writeLine(res, { t: 'error', message: (err as Error).message });
    } finally {
      finished = true;
      activeRuns--;
      res.end();
    }
  }

  async function handleTerminalOpen(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readJson(req, terminalOpenSchema);
    if (terminals.size >= maxTerminals) throw new HttpError(429, 'too many open terminals');
    const id = randomUUID();
    const containerName = `operari-term-${id}`;
    let volume: string | null = null;
    if (body.persistent) {
      volume = workspaceVolumeName({ tenantId: body.tenantId, userId: body.userId });
      if (!preparedVolumes.has(volume)) {
        config.prepareVolume(dockerBinary, volume, terminalImage);
        preparedVolumes.add(volume);
      }
    }
    const args = buildTerminalDockerArgs({
      containerName,
      tenantId: body.tenantId,
      sessionId: id,
      network,
      image: terminalImage,
      volume,
      runtime: config.runtime,
    });
    const pty = config.spawnPty(dockerBinary, args, {
      name: 'xterm-256color',
      cols: body.cols,
      rows: body.rows,
      cwd: '/',
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', TERM: 'xterm-256color' },
    });
    const entry: TerminalEntry = {
      id,
      containerName,
      pty,
      buffer: [],
      bufferBytes: 0,
      consumer: null,
      exitCode: undefined,
      orphanTimer: null,
    };
    terminals.set(id, entry);
    pty.onData(data => {
      if (entry.consumer) {
        writeLine(entry.consumer, { t: 'data', d: data });
        return;
      }
      entry.buffer.push(data);
      entry.bufferBytes += Buffer.byteLength(data);
      while (entry.bufferBytes > MAX_BUFFER && entry.buffer.length > 1) {
        entry.bufferBytes -= Buffer.byteLength(entry.buffer.shift() as string);
      }
    });
    pty.onExit(({ exitCode }) => {
      entry.exitCode = exitCode;
      if (entry.consumer) {
        writeLine(entry.consumer, { t: 'exit', code: exitCode });
        entry.consumer.end();
        terminals.delete(id);
        if (entry.orphanTimer) clearTimeout(entry.orphanTimer);
      }
    });
    armOrphan(entry);
    sendJson(res, 201, { id });
  }

  function handleTerminalOutput(entry: TerminalEntry, res: ServerResponse): void {
    if (entry.consumer) throw new HttpError(409, 'terminal already attached');
    if (entry.orphanTimer) clearTimeout(entry.orphanTimer);
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    entry.consumer = res;
    for (const chunk of entry.buffer) writeLine(res, { t: 'data', d: chunk });
    entry.buffer = [];
    entry.bufferBytes = 0;
    if (entry.exitCode !== undefined) {
      writeLine(res, { t: 'exit', code: entry.exitCode });
      res.end();
      terminals.delete(entry.id);
      return;
    }
    res.on('close', () => {
      if (entry.consumer !== res) return;
      entry.consumer = null;
      if (terminals.has(entry.id)) armOrphan(entry);
    });
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!authorized(req)) throw new HttpError(401, 'unauthorized');
    const url = new URL(req.url ?? '/', 'http://sandbox');
    const parts = url.pathname.split('/').filter(Boolean);
    const method = req.method ?? 'GET';

    if (method === 'GET' && url.pathname === '/v1/health') {
      await runner.healthcheck();
      return sendJson(res, 200, {
        ok: true,
        network,
        runtime: config.runtime ?? null,
        images: config.images,
        terminals: terminals.size,
        runs: activeRuns,
      });
    }
    if (method === 'POST' && url.pathname === '/v1/runs') return handleRun(req, res);
    if (method === 'POST' && url.pathname === '/v1/runs/cancel') {
      const body = await readJson(req, cancelRequestSchema);
      return sendJson(res, 200, { cancelled: await runner.cancel(body.runId) });
    }
    if (method === 'POST' && url.pathname === '/v1/terminals') return handleTerminalOpen(req, res);

    if (parts[0] === 'v1' && parts[1] === 'terminals' && parts[2]) {
      const entry = terminal(parts[2]);
      const action = parts[3];
      if (method === 'GET' && action === 'output') return handleTerminalOutput(entry, res);
      if (method === 'POST' && action === 'input') {
        const body = await readJson(req, terminalInputSchema);
        if (entry.exitCode === undefined) entry.pty.write(body.data);
        res.writeHead(204).end();
        return;
      }
      if (method === 'POST' && action === 'resize') {
        const body = await readJson(req, terminalResizeSchema);
        if (entry.exitCode === undefined) entry.pty.resize(body.cols, body.rows);
        res.writeHead(204).end();
        return;
      }
      if (method === 'DELETE' && !action) {
        closeTerminal(entry);
        res.writeHead(204).end();
        return;
      }
    }
    throw new HttpError(404, 'not found');
  }

  const server = createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof HttpError ? err.message : 'internal error';
      if (!res.headersSent) sendJson(res, status, { error: message });
      else res.end();
    });
  });
  return Object.assign(server, {
    closeTerminals: () => {
      for (const entry of Array.from(terminals.values())) closeTerminal(entry);
    },
  });
}
