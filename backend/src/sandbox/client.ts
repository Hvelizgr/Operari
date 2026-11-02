import { request, RequestOptions } from 'http';

import type {
  RunRequest,
  RunStreamLine,
  TerminalOpenRequest,
  TerminalStreamLine,
} from './protocol';

export interface SandboxClientOptions {
  /** `http://host:port` or `unix:///path/to/socket`. */
  url: string;
  token: string;
}

export class SandboxError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

interface Target {
  socketPath?: string;
  host?: string;
  port?: number;
}

function parseTarget(url: string): Target {
  if (url.startsWith('unix://')) return { socketPath: url.slice('unix://'.length) };
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:') throw new SandboxError(`unsupported sandbox url: ${url}`);
  return { host: parsed.hostname, port: Number(parsed.port || 80) };
}

export class SandboxClient {
  private readonly target: Target;

  constructor(private readonly options: SandboxClientOptions) {
    if (!options.token) throw new SandboxError('OPERARI_SANDBOX_TOKEN is required');
    this.target = parseTarget(options.url);
  }

  private requestOptions(method: string, path: string, body?: string): RequestOptions {
    return {
      ...this.target,
      method,
      path,
      headers: {
        authorization: `Bearer ${this.options.token}`,
        ...(body !== undefined
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
          : {}),
      },
    };
  }

  private json<T>(method: string, path: string, payload?: unknown): Promise<T> {
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
      const req = request(this.requestOptions(method, path, body), res => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          if (status >= 400) {
            let message = text;
            try {
              message = (JSON.parse(text) as { error?: string }).error ?? text;
            } catch {
              // Not JSON.
            }
            return reject(new SandboxError(`sandbox ${status}: ${message}`, status));
          }
          resolve((text ? JSON.parse(text) : undefined) as T);
        });
      });
      req.on('error', err => reject(new SandboxError(`sandbox unreachable: ${err.message}`)));
      req.end(body);
    });
  }

  /**
   * POST that answers with newline-delimited JSON. Returns an abort
   * function; `onEnd` fires once, with an error if the stream broke.
   */
  private stream<L>(
    method: string,
    path: string,
    payload: unknown,
    onLine: (line: L) => void,
    onEnd: (err?: Error) => void
  ): () => void {
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    let done = false;
    const end = (err?: Error) => {
      if (done) return;
      done = true;
      onEnd(err);
    };
    const req = request(this.requestOptions(method, path, body), res => {
      const status = res.statusCode ?? 0;
      let pending = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        if (status >= 400) {
          pending += chunk;
          return;
        }
        pending += chunk;
        let nl: number;
        while ((nl = pending.indexOf('\n')) >= 0) {
          const raw = pending.slice(0, nl);
          pending = pending.slice(nl + 1);
          if (raw) onLine(JSON.parse(raw) as L);
        }
      });
      res.on('end', () => {
        if (status >= 400) return end(new SandboxError(`sandbox ${status}: ${pending}`, status));
        end();
      });
      res.on('error', err => end(err));
    });
    req.on('error', err => end(new SandboxError(`sandbox unreachable: ${err.message}`)));
    req.end(body);
    return () => {
      req.destroy();
      end(new SandboxError('aborted'));
    };
  }

  health(): Promise<{ ok: boolean; network: string; runtime: string | null }> {
    return this.json('GET', '/v1/health');
  }

  run(payload: RunRequest, onLine: (line: RunStreamLine) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream<RunStreamLine>('POST', '/v1/runs', payload, onLine, err =>
        err ? reject(err) : resolve()
      );
    });
  }

  async cancel(runId: string): Promise<number> {
    const res = await this.json<{ cancelled: number }>('POST', '/v1/runs/cancel', { runId });
    return res.cancelled;
  }

  async openTerminal(payload: TerminalOpenRequest): Promise<string> {
    const res = await this.json<{ id: string }>('POST', '/v1/terminals', payload);
    return res.id;
  }

  attachTerminal(
    id: string,
    onLine: (line: TerminalStreamLine) => void,
    onEnd: (err?: Error) => void
  ): () => void {
    return this.stream(
      'GET',
      `/v1/terminals/${encodeURIComponent(id)}/output`,
      undefined,
      onLine,
      onEnd
    );
  }

  async input(id: string, data: string): Promise<void> {
    await this.json('POST', `/v1/terminals/${encodeURIComponent(id)}/input`, { data });
  }

  async resize(id: string, cols: number, rows: number): Promise<void> {
    await this.json('POST', `/v1/terminals/${encodeURIComponent(id)}/resize`, { cols, rows });
  }

  async closeTerminal(id: string): Promise<void> {
    await this.json('DELETE', `/v1/terminals/${encodeURIComponent(id)}`);
  }
}
