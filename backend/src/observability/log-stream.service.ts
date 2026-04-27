import type { Redis } from 'ioredis';

/**
 * LogStreamService — durable log transport on Redis Streams.
 *
 * IMPLEMENTACION P1 #8 foundation. Today the runtime emits logs over
 * socket.io only: pure ephemeral, lost on client reconnect, no
 * backpressure (a runbook that prints 10 MB/s drowns the websocket
 * buffer or just gets dropped). This service is the durable copy
 * that survives reconnects, supports replay from any offset, and
 * caps memory via Redis Streams' built-in MAXLEN trim.
 *
 * Key naming
 *   runs:{executionId}:logs
 *
 * Why per-execution rather than per-tenant: the read path is "give
 * me every log line for this run". A per-tenant stream would force
 * consumers to filter, and Redis stream consumers cannot do server-
 * side filtering by field. One stream per execution is simple and
 * cheap (Redis handles millions of streams).
 *
 * Backpressure
 *   XADD ... MAXLEN ~ N
 * The `~` makes the trim approximate (Redis trims at chunk
 * boundaries) which is dramatically faster than exact trim and
 * enough for our purposes. Default cap = 10_000 entries per run.
 * Override via OPERARI_LOG_STREAM_MAX_ENTRIES.
 *
 * Best-effort semantics
 *   - If Redis is not configured (no REDIS_URL), every method is a
 *     no-op so dev environments without Redis keep working.
 *   - publish() never throws on a Redis error: it logs and returns.
 *     The socket.io path is the live UI fallback; the stream is
 *     the persistence + replay layer, both independent.
 *   - This is the same contract as RunTracer / SecretReader: the
 *     observability layer must never break the request path.
 *
 * Phase 1 (this commit) — write path + replay
 *   publish(executionId, line, metadata?)  → XADD MAXLEN
 *   fetch(executionId, opts?)              → XRANGE replay
 *
 * Phase 2 (G.2 sprint) — live tail
 *   subscribe(executionId, fromId='$', signal) → XREAD BLOCK async iterable
 * Yields every new entry as it lands, ends when the AbortSignal fires
 * or the Redis call errors permanently. Safe to consume from an SSE
 * handler (await-for and the HTTP write queue provide natural
 * backpressure).
 */

export interface LogStreamEntry {
  /** Redis stream id, e.g. "1712515200000-0". Use as the cursor for replay. */
  id: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface FetchOptions {
  /** Starting stream id (inclusive). Default '-' = beginning of stream. */
  fromId?: string;
  /** Ending stream id (inclusive). Default '+' = end of stream. */
  toId?: string;
  /** Max entries to return. Default 1000. */
  count?: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_FETCH_COUNT = 1_000;

export class LogStreamService {
  private readonly maxEntries: number;

  /**
   * Construct with an injected Redis client (or null when Redis is
   * not configured). Tests pass a fake client; production passes
   * the singleton from `redisConfig.getClient()`.
   */
  constructor(
    private readonly redis: Redis | null,
    options: { maxEntries?: number } = {}
  ) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  /**
   * Append a log line to the run's stream. Returns the assigned
   * stream id, or null if Redis is not configured / the publish
   * failed (the caller should not branch on the return value —
   * publish is fire-and-forget).
   *
   * The MAXLEN trim caps memory at maxEntries per stream. Approx
   * trim (`~`) is used so Redis can drop entries at chunk
   * boundaries — much faster than exact trim and good enough for
   * our backpressure goal.
   */
  async publish(
    executionId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<string | null> {
    if (!this.redis) return null;
    const key = LogStreamService.streamKey(executionId);
    const fields: string[] = ['message', message, 'timestamp', new Date().toISOString()];
    if (metadata) {
      fields.push('metadata', JSON.stringify(metadata));
    }
    try {
      // XADD key MAXLEN ~ N * field value [field value ...]
      const id = await this.redis.xadd(key, 'MAXLEN', '~', String(this.maxEntries), '*', ...fields);
      return id ?? null;
    } catch {
      // Best-effort — never break the caller. The socket.io path
      // is the live UI fallback.
      return null;
    }
  }

  /**
   * Replay log entries from the run's stream. Default returns up
   * to 1000 entries from the beginning. To page, pass `fromId`
   * = the last id from the previous page + '-1'... easier: the
   * Redis stream id is monotonic, so the next page starts at the
   * id immediately after the last returned one.
   *
   * Returns an empty array if Redis is not configured, the stream
   * does not exist, or the call fails.
   */
  async fetch(executionId: string, opts: FetchOptions = {}): Promise<LogStreamEntry[]> {
    if (!this.redis) return [];
    const key = LogStreamService.streamKey(executionId);
    const fromId = opts.fromId ?? '-';
    const toId = opts.toId ?? '+';
    const count = opts.count ?? DEFAULT_FETCH_COUNT;
    try {
      // XRANGE key start end COUNT N
      const rows = await this.redis.xrange(key, fromId, toId, 'COUNT', count);
      return rows.map(LogStreamService.parseEntry);
    } catch {
      return [];
    }
  }

  /**
   * Subscribe to new entries as they arrive. Returns an async
   * generator that yields each entry in order; ends when the
   * AbortSignal fires, when Redis is not configured (yields nothing),
   * or when a Redis error terminates the loop.
   *
   * Contract notes
   * - `fromId` is the starting cursor. Pass the last id from a prior
   *   `fetch()` call to avoid gaps; pass '$' (default) to start at
   *   "only entries newer than this call".
   * - The XREAD BLOCK timeout caps each read at `blockMs` so the
   *   loop periodically returns control to the event loop and can
   *   react to signal abortion. Default 15s.
   * - The caller is expected to consume via `for await` and stop by
   *   aborting the signal (typically on `res.on('close')`). Throwing
   *   out of the consumer also unwinds the loop via async iterator
   *   protocol.
   */
  async *subscribe(
    executionId: string,
    opts: { fromId?: string; signal?: AbortSignal; blockMs?: number } = {}
  ): AsyncGenerator<LogStreamEntry> {
    if (!this.redis) return;
    const key = LogStreamService.streamKey(executionId);
    const blockMs = opts.blockMs ?? 15_000;
    let cursor = opts.fromId ?? '$';

    while (!opts.signal?.aborted) {
      let result: Array<[string, Array<[string, string[]]>]> | null;
      try {
        // XREAD COUNT 500 BLOCK <ms> STREAMS <key> <id>
        // ioredis typing returns a slightly tighter shape; cast at
        // the boundary so this line is the one place that deals
        // with ioredis's variadic command signature.
        result = (await this.redis.xread(
          'COUNT',
          500,
          'BLOCK',
          blockMs,
          'STREAMS',
          key,
          cursor
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        )) as any;
      } catch {
        // Permanent transport error — end the subscription. The
        // consumer can retry by re-calling subscribe().
        return;
      }

      if (!result || result.length === 0) {
        // BLOCK timeout with no new entries. Loop around so we can
        // observe the abort signal and resume waiting.
        continue;
      }

      for (const [, rows] of result) {
        for (const row of rows) {
          const entry = LogStreamService.parseEntry(row);
          cursor = entry.id;
          yield entry;
          if (opts.signal?.aborted) return;
        }
      }
    }
  }

  /**
   * Approximate stream length. Useful for dashboards (".. of N
   * lines"). Returns null if Redis is not configured.
   */
  async length(executionId: string): Promise<number | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.xlen(LogStreamService.streamKey(executionId));
    } catch {
      return null;
    }
  }

  /**
   * Delete the stream entirely. Used by retention sweeps and tests.
   * Returns the number of keys deleted (0 or 1) or null if Redis
   * is not configured.
   */
  async drop(executionId: string): Promise<number | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.del(LogStreamService.streamKey(executionId));
    } catch {
      return null;
    }
  }

  /** Per-execution stream key. Centralized so a future rename has one site. */
  static streamKey(executionId: string): string {
    return `runs:${executionId}:logs`;
  }

  /**
   * Convert a single XRANGE row [id, [field, value, field, value, ...]]
   * to a typed entry. Centralized so the field-pair walk lives in
   * one place.
   */
  static parseEntry(row: [string, string[]]): LogStreamEntry {
    const [id, fields] = row;
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }
    const entry: LogStreamEntry = {
      id,
      message: map.message ?? '',
      timestamp: map.timestamp ?? '',
    };
    if (map.metadata) {
      try {
        entry.metadata = JSON.parse(map.metadata);
      } catch {
        // Stored as string by an older writer or hand-edited; preserve raw
        entry.metadata = { raw: map.metadata };
      }
    }
    return entry;
  }
}

/**
 * Process-wide singleton built lazily from `redisConfig.getClient()`.
 * Tests can override via `setLogStreamForTest`.
 */
let logStreamSingleton: LogStreamService | null = null;

export function getLogStream(): LogStreamService {
  if (!logStreamSingleton) {
    // Lazy import to avoid pulling redisConfig into test environments
    // that mock this module entirely.
    const { redisConfig } = require('../config/redis.config');
    const maxEntries = process.env.OPERARI_LOG_STREAM_MAX_ENTRIES
      ? parseInt(process.env.OPERARI_LOG_STREAM_MAX_ENTRIES, 10)
      : undefined;
    logStreamSingleton = new LogStreamService(redisConfig.getClient(), { maxEntries });
  }
  return logStreamSingleton;
}

export function setLogStreamForTest(stream: LogStreamService): void {
  logStreamSingleton = stream;
}

export function resetLogStreamForTest(): void {
  logStreamSingleton = null;
}
