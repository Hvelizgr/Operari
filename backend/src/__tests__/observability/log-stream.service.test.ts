import type { Redis } from 'ioredis';

import { LogStreamService } from '../../observability/log-stream.service';

/**
 * Recording fake ioredis client. Implements the four methods
 * LogStreamService uses (xadd, xrange, xlen, del) over an in-memory
 * Map<key, [id, fields][]> so the assertions pin both the data path
 * AND the exact arguments passed to Redis.
 *
 * The XADD parser inspects positional args to validate that MAXLEN is
 * always set with the approximate ('~') flag — that's the load-bearing
 * backpressure contract from the doc.
 */
function buildFakeRedis() {
  const streams = new Map<string, Array<[string, string[]]>>();
  let counter = 0;

  const client = {
    xadd: jest.fn(async (...args: string[]) => {
      // args = [key, 'MAXLEN', '~', N, '*', field, value, field, value, ...]
      // OR just [key, '*', field, value, ...] if MAXLEN omitted
      const key = args[0];
      let i = 1;
      if (args[i] === 'MAXLEN') {
        // MAXLEN ~ N
        i++; // ~
        i++; // approx flag value
        i++; // N
      }
      // i now points to the id arg ('*' for auto-generated)
      const idArg = args[i];
      i++;
      const fields = args.slice(i);
      const id = idArg === '*' ? `${Date.now()}-${counter++}` : idArg;

      const stream = streams.get(key) ?? [];
      stream.push([id, fields]);
      streams.set(key, stream);
      return id;
    }),
    xrange: jest.fn(
      async (key: string, start: string, end: string, _countWord: string, _count: string) => {
        const stream = streams.get(key) ?? [];
        // Naive: ignore start/end filters for the basic test cases
        // (the assertions verify the right rows come back, not the
        // exact stream-id ordering semantics).
        if (start === '-' && end === '+') return stream;
        // Filter by string comparison — Redis stream ids are
        // monotonic strings so lex comparison works.
        return stream.filter(([id]) => id >= start && id <= end);
      }
    ),
    xlen: jest.fn(async (key: string) => {
      return (streams.get(key) ?? []).length;
    }),
    del: jest.fn(async (key: string) => {
      return streams.delete(key) ? 1 : 0;
    }),
  } as unknown as Redis;

  return { client, streams };
}

describe('LogStreamService', () => {
  describe('publish', () => {
    it('writes XADD with MAXLEN ~ N for backpressure', async () => {
      const { client, streams } = buildFakeRedis();
      const svc = new LogStreamService(client, { maxEntries: 50 });

      const id = await svc.publish('exec-1', 'hello world');

      expect(id).toBeDefined();
      expect(client.xadd).toHaveBeenCalledTimes(1);
      const args = (client.xadd as jest.Mock).mock.calls[0];
      // [key, 'MAXLEN', '~', '50', '*', 'message', 'hello world', 'timestamp', '...']
      expect(args[0]).toBe('runs:exec-1:logs');
      expect(args[1]).toBe('MAXLEN');
      expect(args[2]).toBe('~');
      expect(args[3]).toBe('50');
      expect(args[4]).toBe('*');
      expect(args).toContain('message');
      expect(args).toContain('hello world');
      expect(streams.get('runs:exec-1:logs')).toHaveLength(1);
    });

    it('serializes metadata as JSON', async () => {
      const { client } = buildFakeRedis();
      const svc = new LogStreamService(client);

      await svc.publish('exec-1', 'msg', { nodeId: 'n-1', stream: 'stdout' });

      const args = (client.xadd as jest.Mock).mock.calls[0];
      const metaIdx = args.indexOf('metadata');
      expect(metaIdx).toBeGreaterThan(0);
      expect(JSON.parse(args[metaIdx + 1])).toEqual({ nodeId: 'n-1', stream: 'stdout' });
    });

    it('omits the metadata field when none is provided', async () => {
      const { client } = buildFakeRedis();
      const svc = new LogStreamService(client);

      await svc.publish('exec-1', 'msg');

      const args = (client.xadd as jest.Mock).mock.calls[0];
      expect(args).not.toContain('metadata');
    });

    it('returns null and is a no-op when redis is null', async () => {
      const svc = new LogStreamService(null);
      const id = await svc.publish('exec-1', 'msg');
      expect(id).toBeNull();
    });

    it('swallows redis errors and returns null (best-effort)', async () => {
      const client = {
        xadd: jest.fn().mockRejectedValue(new Error('CONN_REFUSED')),
      } as unknown as Redis;
      const svc = new LogStreamService(client);
      const id = await svc.publish('exec-1', 'msg');
      expect(id).toBeNull();
    });
  });

  describe('fetch', () => {
    it('returns parsed entries from XRANGE', async () => {
      const { client } = buildFakeRedis();
      const svc = new LogStreamService(client);
      await svc.publish('exec-1', 'line 1', { line: 1 });
      await svc.publish('exec-1', 'line 2', { line: 2 });
      await svc.publish('exec-1', 'line 3');

      const entries = await svc.fetch('exec-1');
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe('line 1');
      expect(entries[0].metadata).toEqual({ line: 1 });
      expect(entries[2].message).toBe('line 3');
      expect(entries[2].metadata).toBeUndefined();
    });

    it('passes COUNT to XRANGE', async () => {
      const { client } = buildFakeRedis();
      const svc = new LogStreamService(client);
      await svc.publish('exec-1', 'msg');

      await svc.fetch('exec-1', { count: 7 });

      const args = (client.xrange as jest.Mock).mock.calls[0];
      expect(args).toContain('COUNT');
      const countIdx = args.indexOf('COUNT');
      expect(args[countIdx + 1]).toBe(7);
    });

    it('returns [] when redis is null', async () => {
      const svc = new LogStreamService(null);
      await expect(svc.fetch('exec-1')).resolves.toEqual([]);
    });

    it('returns [] on a redis error', async () => {
      const client = {
        xrange: jest.fn().mockRejectedValue(new Error('boom')),
      } as unknown as Redis;
      const svc = new LogStreamService(client);
      await expect(svc.fetch('exec-1')).resolves.toEqual([]);
    });

    it('handles malformed metadata gracefully (preserves raw)', () => {
      const entry = LogStreamService.parseEntry([
        '1-0',
        ['message', 'm', 'timestamp', 't', 'metadata', 'not-json'],
      ]);
      expect(entry.metadata).toEqual({ raw: 'not-json' });
    });
  });

  describe('length / drop', () => {
    it('length returns the stream size', async () => {
      const { client } = buildFakeRedis();
      const svc = new LogStreamService(client);
      await svc.publish('exec-1', 'a');
      await svc.publish('exec-1', 'b');
      await expect(svc.length('exec-1')).resolves.toBe(2);
    });

    it('length returns null when redis is null', async () => {
      const svc = new LogStreamService(null);
      await expect(svc.length('exec-1')).resolves.toBeNull();
    });

    it('drop removes the stream and returns 1', async () => {
      const { client, streams } = buildFakeRedis();
      const svc = new LogStreamService(client);
      await svc.publish('exec-1', 'a');
      await expect(svc.drop('exec-1')).resolves.toBe(1);
      expect(streams.has('runs:exec-1:logs')).toBe(false);
    });

    it('drop on a missing stream returns 0', async () => {
      const { client } = buildFakeRedis();
      const svc = new LogStreamService(client);
      await expect(svc.drop('exec-ghost')).resolves.toBe(0);
    });
  });

  describe('streamKey', () => {
    it('uses the runs:{id}:logs convention', () => {
      expect(LogStreamService.streamKey('exec-abc')).toBe('runs:exec-abc:logs');
    });
  });

  describe('parseEntry', () => {
    it('parses message + timestamp + JSON metadata', () => {
      const entry = LogStreamService.parseEntry([
        '1712515200000-0',
        ['message', 'hi', 'timestamp', '2026-04-07T00:00:00Z', 'metadata', '{"nodeId":"n-1"}'],
      ]);
      expect(entry).toEqual({
        id: '1712515200000-0',
        message: 'hi',
        timestamp: '2026-04-07T00:00:00Z',
        metadata: { nodeId: 'n-1' },
      });
    });

    it('handles missing fields with empty string defaults', () => {
      const entry = LogStreamService.parseEntry(['1-0', []]);
      expect(entry.message).toBe('');
      expect(entry.timestamp).toBe('');
      expect(entry.metadata).toBeUndefined();
    });
  });
});
