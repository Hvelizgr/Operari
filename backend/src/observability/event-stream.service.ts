import type { Redis } from 'ioredis';

/**
 * EventStreamService — durable live feed for ExecutionEvent rows on
 * top of Redis Streams. Mirrors the G.2 LogStreamService contract
 * one-for-one so the SSE endpoint implementation and test harness
 * can stay symmetrical across logs and events.
 *
 * Why a second stream (instead of multiplexing over logs):
 *   - Different schema: events carry a structured payload + seq,
 *     logs are plaintext lines. Co-locating would force consumers
 *     to branch on every read.
 *   - Independent backpressure: a chatty log run (10 MB/s printf)
 *     must not evict durable event transitions from the same stream.
 *
 * Key naming
 *   runs:{executionId}:events
 *
 * Write path contract
 *   - `publish` is best-effort (never throws). If Redis is not
 *     configured, every method is a no-op so dev loops without
 *     Redis keep working — consumers fall back to the polling
 *     endpoint `/api/runs/:id/events`.
 *   - Dual-write site is `ExecutionEventStore.append()`: Postgres
 *     is the source of truth, Redis is the live-tail mirror. The
 *     SSE client reconciles any Redis gap by refetching from the
 *     DB with an `?afterSeq` cursor.
 *
 * Read path contract — same as LogStreamService
 *   fetch    → XRANGE replay with optional cursor
 *   subscribe→ XREAD BLOCK async iterable, aborts via AbortSignal
 *
 * Multi-instance fanout
 *   Redis Streams are inherently shared state. When two backend nodes
 *   both point at the same Redis, XADD from node A is immediately
 *   visible to XREAD on node B — the stream IS the broadcast channel.
 *   No additional pub/sub plumbing is required for SSE clients across
 *   nodes. The Socket.IO side (node_status, execution_status) is NOT
 *   stream-backed and uses the Redis adapter for fanout instead (see
 *   socket.service.ts).
 */

export interface EventStreamEntry {
  /** Redis stream id, e.g. "1712515200000-0". Use as the Last-Event-ID cursor. */
  id: string;
  /** DB seq, stringified. Used by clients to reconcile with /events polling. */
  seq: string;
  type: string;
  /** Empty string preserved as null for the downstream client. */
  nodeId: string | null;
  /** Arbitrary JSON — parsed on read, opaque on write. */
  payload: unknown;
  createdAt: string;
}

export interface EventStreamPublishInput {
  seq: string;
  type: string;
  nodeId: string | null;
  payload: unknown;
  createdAt: string;
}

export interface EventFetchOptions {
  fromId?: string;
  toId?: string;
  count?: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_FETCH_COUNT = 1_000;

export class EventStreamService {
  private readonly maxEntries: number;

  constructor(
    private readonly redis: Redis | null,
    options: { maxEntries?: number } = {}
  ) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async publish(executionId: string, event: EventStreamPublishInput): Promise<string | null> {
    if (!this.redis) return null;
    const key = EventStreamService.streamKey(executionId);
    // Redis stream values must be strings. We serialise the structured
    // fields here so `parseEntry` can round-trip without re-deriving
    // the shape on read.
    const fields: string[] = [
      'seq',
      event.seq,
      'type',
      event.type,
      'nodeId',
      event.nodeId ?? '',
      'payload',
      JSON.stringify(event.payload ?? null),
      'createdAt',
      event.createdAt,
    ];
    try {
      const id = await this.redis.xadd(key, 'MAXLEN', '~', String(this.maxEntries), '*', ...fields);
      return id ?? null;
    } catch {
      // Best-effort: durable copy is the DB, live tail is the
      // degraded optional. Never propagate.
      return null;
    }
  }

  async fetch(executionId: string, opts: EventFetchOptions = {}): Promise<EventStreamEntry[]> {
    if (!this.redis) return [];
    const key = EventStreamService.streamKey(executionId);
    const fromId = opts.fromId ?? '-';
    const toId = opts.toId ?? '+';
    const count = opts.count ?? DEFAULT_FETCH_COUNT;
    try {
      const rows = await this.redis.xrange(key, fromId, toId, 'COUNT', count);
      return rows.map(EventStreamService.parseEntry);
    } catch {
      return [];
    }
  }

  async *subscribe(
    executionId: string,
    opts: { fromId?: string; signal?: AbortSignal; blockMs?: number } = {}
  ): AsyncGenerator<EventStreamEntry> {
    if (!this.redis) return;
    const key = EventStreamService.streamKey(executionId);
    const blockMs = opts.blockMs ?? 15_000;
    let cursor = opts.fromId ?? '$';

    while (!opts.signal?.aborted) {
      let result: Array<[string, Array<[string, string[]]>]> | null;
      try {
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
        return;
      }
      if (!result || result.length === 0) continue;
      for (const [, rows] of result) {
        for (const row of rows) {
          const entry = EventStreamService.parseEntry(row);
          cursor = entry.id;
          yield entry;
          if (opts.signal?.aborted) return;
        }
      }
    }
  }

  async length(executionId: string): Promise<number | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.xlen(EventStreamService.streamKey(executionId));
    } catch {
      return null;
    }
  }

  async drop(executionId: string): Promise<number | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.del(EventStreamService.streamKey(executionId));
    } catch {
      return null;
    }
  }

  static streamKey(executionId: string): string {
    return `runs:${executionId}:events`;
  }

  /**
   * XRANGE row → structured entry. Shape errors in the payload field
   * fall back to a `{ raw: string }` object so one malformed row can't
   * break the whole subscription. Mirrors LogStreamService's strategy.
   */
  static parseEntry(row: [string, string[]]): EventStreamEntry {
    const [id, fields] = row;
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }
    let payload: unknown = null;
    if (map.payload) {
      try {
        payload = JSON.parse(map.payload);
      } catch {
        payload = { raw: map.payload };
      }
    }
    return {
      id,
      seq: map.seq ?? '',
      type: map.type ?? '',
      nodeId: map.nodeId && map.nodeId.length > 0 ? map.nodeId : null,
      payload,
      createdAt: map.createdAt ?? '',
    };
  }
}

let eventStreamSingleton: EventStreamService | null = null;

export function getEventStream(): EventStreamService {
  if (!eventStreamSingleton) {
    const { redisConfig } = require('../config/redis.config');
    const maxEntries = process.env.NANORUN_EVENT_STREAM_MAX_ENTRIES
      ? parseInt(process.env.NANORUN_EVENT_STREAM_MAX_ENTRIES, 10)
      : undefined;
    eventStreamSingleton = new EventStreamService(redisConfig.getClient(), { maxEntries });
  }
  return eventStreamSingleton;
}

export function setEventStreamForTest(stream: EventStreamService): void {
  eventStreamSingleton = stream;
}

export function resetEventStreamForTest(): void {
  eventStreamSingleton = null;
}
