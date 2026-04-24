import type { Redis } from 'ioredis';

import { EventStreamService } from '../../observability/event-stream.service';

/**
 * Recording fake ioredis client for the event stream. Same shape as
 * the log-stream tests — keeps xadd/xrange/xlen/del in-memory and
 * exposes the recorded args so we pin the protocol details the SSE
 * route depends on (MAXLEN approximate, stream key, field order).
 */
function buildFakeRedis() {
  const streams = new Map<string, Array<[string, string[]]>>();
  let counter = 0;

  const client = {
    xadd: jest.fn(async (...args: string[]) => {
      const key = args[0];
      let i = 1;
      if (args[i] === 'MAXLEN') {
        i += 3; // skip '~' approx N
      }
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
        if (start === '-' && end === '+') return stream;
        return stream.filter(([id]) => id >= start && id <= end);
      }
    ),
    xlen: jest.fn(async (key: string) => (streams.get(key) ?? []).length),
    del: jest.fn(async (key: string) => (streams.delete(key) ? 1 : 0)),
  } as unknown as Redis;

  return { client, streams };
}

const sampleInput = () => ({
  seq: '17',
  type: 'step.completed',
  nodeId: 'node-a',
  payload: { nodeName: 'Fetch', durationMs: 240 },
  createdAt: '2026-04-24T12:00:00.000Z',
});

describe('EventStreamService', () => {
  describe('publish', () => {
    it('writes XADD with MAXLEN ~ N and the expected key', async () => {
      const { client, streams } = buildFakeRedis();
      const svc = new EventStreamService(client, { maxEntries: 50 });

      const id = await svc.publish('exec-1', sampleInput());

      expect(id).toBeDefined();
      const args = (client.xadd as jest.Mock).mock.calls[0];
      expect(args[0]).toBe('runs:exec-1:events');
      expect(args[1]).toBe('MAXLEN');
      expect(args[2]).toBe('~');
      expect(args[3]).toBe('50');
      expect(args[4]).toBe('*');
      expect(streams.get('runs:exec-1:events')).toHaveLength(1);
    });

    it('serialises payload as JSON and preserves seq/type/nodeId fields', async () => {
      const { client } = buildFakeRedis();
      const svc = new EventStreamService(client);

      await svc.publish('exec-1', sampleInput());

      const args = (client.xadd as jest.Mock).mock.calls[0];
      // Find the payload field — it's after key+maxlen+approx+N+*
      const payloadIdx = args.indexOf('payload');
      expect(payloadIdx).toBeGreaterThan(0);
      expect(JSON.parse(args[payloadIdx + 1])).toEqual({ nodeName: 'Fetch', durationMs: 240 });
      expect(args).toContain('seq');
      expect(args).toContain('17');
      expect(args).toContain('step.completed');
      expect(args).toContain('node-a');
    });

    it('stores nodeId as empty string when null so round-trip can restore it', async () => {
      const { client } = buildFakeRedis();
      const svc = new EventStreamService(client);

      await svc.publish('exec-1', { ...sampleInput(), nodeId: null });

      const args = (client.xadd as jest.Mock).mock.calls[0];
      const nodeIdx = args.indexOf('nodeId');
      expect(args[nodeIdx + 1]).toBe('');
    });

    it('returns null and is a no-op when redis is null', async () => {
      const svc = new EventStreamService(null);
      const id = await svc.publish('exec-1', sampleInput());
      expect(id).toBeNull();
    });

    it('swallows redis errors — publish is best-effort', async () => {
      const client = {
        xadd: jest.fn().mockRejectedValue(new Error('CONN_REFUSED')),
      } as unknown as Redis;
      const svc = new EventStreamService(client);
      const id = await svc.publish('exec-1', sampleInput());
      expect(id).toBeNull();
    });
  });

  describe('fetch', () => {
    it('returns parsed entries with payload re-hydrated', async () => {
      const { client } = buildFakeRedis();
      const svc = new EventStreamService(client);
      await svc.publish('exec-1', sampleInput());
      await svc.publish('exec-1', { ...sampleInput(), seq: '18', type: 'step.failed' });

      const entries = await svc.fetch('exec-1');
      expect(entries).toHaveLength(2);
      expect(entries[0].seq).toBe('17');
      expect(entries[0].type).toBe('step.completed');
      expect(entries[0].nodeId).toBe('node-a');
      expect(entries[0].payload).toEqual({ nodeName: 'Fetch', durationMs: 240 });
      expect(entries[1].type).toBe('step.failed');
    });

    it('preserves nodeId:null on round-trip (empty string → null)', async () => {
      const { client } = buildFakeRedis();
      const svc = new EventStreamService(client);
      await svc.publish('exec-1', { ...sampleInput(), nodeId: null });

      const entries = await svc.fetch('exec-1');
      expect(entries[0].nodeId).toBeNull();
    });

    it('returns {raw: ...} for a malformed payload string rather than crashing', async () => {
      const { client, streams } = buildFakeRedis();
      const svc = new EventStreamService(client);
      // Hand-craft a corrupt entry the way an older writer or hand-
      // edited stream might have left it.
      streams.set('runs:exec-1:events', [
        [
          '1-0',
          [
            'seq',
            '1',
            'type',
            'step.started',
            'nodeId',
            'node-a',
            'payload',
            '{not-valid-json',
            'createdAt',
            '2026-04-24T00:00:00.000Z',
          ],
        ],
      ]);

      const entries = await svc.fetch('exec-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].payload).toEqual({ raw: '{not-valid-json' });
    });

    it('returns empty array when redis is null', async () => {
      const svc = new EventStreamService(null);
      expect(await svc.fetch('exec-1')).toEqual([]);
    });
  });

  describe('streamKey', () => {
    it('uses per-execution key so tenants never collide', () => {
      expect(EventStreamService.streamKey('exec-42')).toBe('runs:exec-42:events');
    });
  });
});
