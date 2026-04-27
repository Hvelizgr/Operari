import {
  OperariConfig,
  RunbookSummary,
  TriggerOptions,
  TriggerResponse,
  Run,
  RunStatus,
  AuditVerifyOptions,
  AuditVerifyResult,
  ResolveApprovalOptions,
  ResolvedApproval,
  LogEntry,
  GetLogsOptions,
  GetLogsResponse,
  TailLogsOptions,
} from './types';
import {
  OperariError,
  OperariAuthError,
  OperariNotFoundError,
  OperariTimeoutError,
} from './errors';

const DEFAULT_BASE_URL = 'https://api.operari.dev';

/**
 * Official Node.js client for the Operari API.
 *
 * Quick start:
 *
 * ```ts
 * import { Operari } from '@operari/sdk';
 *
 * const client = new Operari({ apiKey: process.env.OPERARI_API_KEY! });
 *
 * // Trigger a runbook
 * const run = await client.trigger('deploy-frontend', {
 *   variables: { env: 'production' },
 * });
 *
 * // Wait for completion
 * const finalRun = await client.waitForCompletion(run.id);
 * console.log(finalRun.status); // SUCCESS
 * ```
 */
export class Operari {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OperariConfig) {
    if (!config.apiKey) {
      throw new OperariError('apiKey is required');
    }
    this.apiKey = config.apiKey;
    this.baseURL = (config.baseURL || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = config.fetch || fetch;
  }

  /** List all runbooks accessible to this API key. */
  async listRunbooks(): Promise<RunbookSummary[]> {
    const res = await this.request<{ data: RunbookSummary[] }>('GET', '/api/v1/runbooks');
    return res.data;
  }

  /**
   * Trigger a runbook by slug or id.
   * Returns immediately with the run record (async execution).
   * Use `waitForCompletion(run.id)` to block until done.
   */
  async trigger(runbookSlugOrId: string, options: TriggerOptions = {}): Promise<TriggerResponse> {
    return this.request<TriggerResponse>(
      'POST',
      `/api/v1/runbooks/${encodeURIComponent(runbookSlugOrId)}/trigger`,
      { variables: options.variables ?? {} }
    );
  }

  /** Get the current state of a run. */
  async getRun(runId: string): Promise<Run> {
    return this.request<Run>('GET', `/api/v1/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * Poll a run until it reaches a terminal state (SUCCESS, FAILED, CANCELLED).
   *
   * @param runId The run id to poll
   * @param options.timeoutMs Maximum time to wait (default: 5 minutes)
   * @param options.pollIntervalMs Polling interval (default: 1 second)
   */
  async waitForCompletion(
    runId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<Run> {
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    const pollIntervalMs = options.pollIntervalMs ?? 1000;
    const terminalStates: RunStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED'];

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const run = await this.getRun(runId);
      if (terminalStates.includes(run.status)) {
        return run;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    throw new OperariTimeoutError(`Run ${runId} did not complete within ${timeoutMs}ms`);
  }

  /**
   * Convenience: trigger a runbook AND wait for it to finish.
   * Throws if the run fails.
   */
  async run(
    runbookSlugOrId: string,
    options: TriggerOptions & { timeoutMs?: number } = {}
  ): Promise<Run> {
    const triggered = await this.trigger(runbookSlugOrId, options);
    const final = await this.waitForCompletion(triggered.id, { timeoutMs: options.timeoutMs });
    if (final.status === 'FAILED') {
      throw new OperariError(
        `Run failed: ${final.error || 'unknown error'}`,
        500,
        'run_failed',
        final
      );
    }
    return final;
  }

  /**
   * Grant a pending approval and resume its paused execution.
   *
   * Requires API key scope `approvals:resolve`. Throws
   * `OperariNotFoundError` if the approval id does not exist (also used
   * when it belongs to another tenant — by design).
   */
  async grantApproval(
    approvalId: string,
    options: ResolveApprovalOptions = {}
  ): Promise<ResolvedApproval> {
    return this.request<ResolvedApproval>(
      'POST',
      `/api/v1/approvals/${encodeURIComponent(approvalId)}/grant`,
      { comment: options.comment }
    );
  }

  /**
   * Reject a pending approval. The matching execution is cancelled —
   * downstream steps will NOT run. Requires scope `approvals:resolve`.
   */
  async rejectApproval(
    approvalId: string,
    options: ResolveApprovalOptions = {}
  ): Promise<ResolvedApproval> {
    return this.request<ResolvedApproval>(
      'POST',
      `/api/v1/approvals/${encodeURIComponent(approvalId)}/reject`,
      { comment: options.comment }
    );
  }

  /**
   * Verify the audit chain for the tenant owning this API key.
   *
   * Operari stores tamper-evident audit events in a hash chain. This
   * method walks the chain and reports whether every hash recomputes
   * correctly and whether the seq column is contiguous. Use it from
   * compliance automation, or directly from the CLI:
   *
   *   operari audit verify
   *
   * Requires an API key with scope `audit:read`.
   */
  /**
   * Fetch a bounded page of log entries for a run. Use the returned
   * `nextFromId` as `options.fromId` on the next call to paginate
   * through a finished run's full log; pass nothing to start from
   * the beginning.
   *
   * For a LIVE tail that yields entries as the runtime emits them,
   * use `tailLogs()` instead.
   */
  async getLogs(runId: string, options: GetLogsOptions = {}): Promise<GetLogsResponse> {
    const params = new URLSearchParams();
    if (options.fromId) params.set('fromId', options.fromId);
    if (options.count !== undefined) params.set('count', String(options.count));
    const qs = params.toString();
    const path = `/api/executions/${encodeURIComponent(runId)}/logs${qs ? `?${qs}` : ''}`;
    return this.request<GetLogsResponse>('GET', path);
  }

  /**
   * Subscribe to a run's log stream as a live tail. Returns an
   * AsyncIterable that yields every new entry as the runtime emits
   * it. Consume it with `for await` and stop by aborting the signal
   * (typically on Ctrl-C in a CLI or `res.on('close')` in a route).
   *
   * ```ts
   * const controller = new AbortController();
   * process.on('SIGINT', () => controller.abort());
   * for await (const entry of client.tailLogs(runId, { signal: controller.signal })) {
   *   console.log(entry.message);
   * }
   * ```
   *
   * Notes:
   * - The server replays the backlog before switching to live tail,
   *   so a fresh connection to an in-flight run sees everything from
   *   the ring-buffer window (default 10k entries).
   * - If the HTTP connection drops mid-stream, the iterable ends
   *   without throwing. Reconnect by calling tailLogs() again with
   *   `fromId` set to the last entry id you received.
   */
  async *tailLogs(runId: string, options: TailLogsOptions = {}): AsyncIterable<LogEntry> {
    const params = new URLSearchParams({ follow: 'true' });
    if (options.fromId) params.set('fromId', options.fromId);
    const url = `${this.baseURL}/api/executions/${encodeURIComponent(runId)}/logs?${params.toString()}`;

    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
        'User-Agent': '@operari/sdk/0.1.0',
      },
      signal: options.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const message = text || `tailLogs failed: ${response.status}`;
      if (response.status === 401) throw new OperariAuthError(message);
      if (response.status === 404) throw new OperariNotFoundError(message);
      throw new OperariError(message, response.status);
    }
    if (!response.body) {
      // Implementations without streaming bodies (very old fetch
      // polyfills) can't honor SSE — fail clearly rather than hang.
      throw new OperariError(
        'Response body is not a readable stream; SSE requires streaming fetch'
      );
    }

    // Minimal SSE parser: concatenate chunks into a buffer, split on
    // blank lines, pick the last `data:` line in each event, JSON-
    // parse as a LogEntry. Ignores heartbeats (:comments) and
    // unnamed events. Enough for the server format we emit.
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx = buffer.indexOf('\n\n');
        while (sepIdx !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const entry = parseSseEvent(rawEvent);
          if (entry) yield entry;
          sepIdx = buffer.indexOf('\n\n');
        }
      }
    } finally {
      // Releasing the reader allows fetch/undici to close the
      // underlying socket promptly on consumer abort.
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }

  async verifyAudit(options: AuditVerifyOptions = {}): Promise<AuditVerifyResult> {
    const params = new URLSearchParams();
    if (options.fromSeq !== undefined) {
      params.set('fromSeq', String(options.fromSeq));
    }
    if (options.pageSize !== undefined) {
      params.set('pageSize', String(options.pageSize));
    }
    const qs = params.toString();
    const path = qs ? `/api/v1/audit/verify?${qs}` : '/api/v1/audit/verify';
    return this.request<AuditVerifyResult>('GET', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': '@operari/sdk/0.1.0',
    };

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const errPayload = (data as { error?: string; code?: string; details?: unknown }) || {};
      const message = errPayload.error || `Request failed: ${response.status}`;

      if (response.status === 401) throw new OperariAuthError(message);
      if (response.status === 404) throw new OperariNotFoundError(message);
      throw new OperariError(message, response.status, errPayload.code, errPayload.details);
    }

    return data as T;
  }
}

/**
 * Parse one SSE event text block (everything between two "\n\n"
 * separators) into a LogEntry. Returns null when the block has no
 * `data:` line (heartbeat, comment, unknown event) so the caller
 * can skip it silently.
 */
function parseSseEvent(raw: string): LogEntry | null {
  let dataLine: string | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue; // SSE comment / heartbeat
    if (line.startsWith('data:')) {
      // SSE allows multiple `data:` lines per event — concat with \n.
      // Our server writes one, but the parser is tolerant.
      const piece = line.slice(5).replace(/^\s/, '');
      dataLine = dataLine === null ? piece : `${dataLine}\n${piece}`;
    }
  }
  if (dataLine === null) return null;
  try {
    return JSON.parse(dataLine) as LogEntry;
  } catch {
    return null;
  }
}
