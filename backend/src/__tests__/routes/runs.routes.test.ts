import express from 'express';
import request from 'supertest';

// Mock the prisma re-export from server before importing the router.
// `/api/runs/:id/events` reads from execution (for the tenant-scoped
// 404 check) and executionEvent (for the actual rows).
jest.mock('../../server', () => ({
  prisma: {
    execution: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    executionEvent: {
      findMany: jest.fn(),
    },
  },
}));

// The SSE route calls getEventStream() — stub fetch + subscribe via
// hoisting-safe `mock`-prefixed vars so individual tests can swap
// behaviour (backlog entries, tail shape, abort semantics). Jest
// permits `mockX` names inside factory scope.
var mockEventStreamFetch = jest.fn();
var mockEventStreamSubscribe = jest.fn();
jest.mock('../../observability/event-stream.service', () => ({
  getEventStream: () => ({
    fetch: mockEventStreamFetch,
    subscribe: mockEventStreamSubscribe,
  }),
}));

import {
  __resetSseConcurrencyForTests,
  sseConcurrencyGuard,
} from '../../middleware/ratelimit.middleware';
import runsRouter from '../../routes/runs.routes';
import { prisma as mockedPrisma } from '../../server';

type MockPrisma = {
  execution: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  executionEvent: { findMany: jest.Mock };
};
const m = mockedPrisma as unknown as MockPrisma;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  // Inject a tenant-scoped viewer so the route's `req.user!.tenantId`
  // read succeeds without going through anonymous fallback.
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = {
      id: 'u-1',
      email: 'u@x.com',
      role: 'USER',
      tenantId: 'tenant-1',
    };
    next();
  });
  app.use('/api/runs', runsRouter);
  return app;
};

const mkEvent = (over: Record<string, unknown> = {}) => ({
  // Prisma returns BigInt for seq; the route must stringify it
  // before JSON.stringify (BigInt is not serialisable by default).
  seq: BigInt((over.seq as number | bigint | undefined) ?? 1),
  id: 'evt-1',
  executionId: 'run-1',
  tenantId: 'tenant-1',
  type: 'step.started',
  nodeId: 'node-a',
  payload: { nodeName: 'Fetch', nodeType: 'http' },
  createdAt: new Date('2026-04-07T00:00:01Z'),
  ...over,
});

describe('GET /api/runs/:id/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when the run is not in the caller tenant', async () => {
    m.execution.findFirst.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/runs/run-x/events');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('run_not_found');
    expect(m.executionEvent.findMany).not.toHaveBeenCalled();
  });

  it('returns events in seq order, with seq stringified', async () => {
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
    m.executionEvent.findMany.mockResolvedValue([
      mkEvent({ seq: BigInt(1), type: 'run.started' }),
      mkEvent({ seq: BigInt(2), type: 'step.started', nodeId: 'node-a' }),
    ]);

    const res = await request(buildApp()).get('/api/runs/run-1/events');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].seq).toBe('1');
    expect(res.body.data[0].type).toBe('run.started');
    expect(res.body.data[1].seq).toBe('2');
    expect(res.body.nextAfterSeq).toBeNull();

    // Double-scoped: by tenantId + executionId.
    const args = m.executionEvent.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe('tenant-1');
    expect(args.where.executionId).toBe('run-1');
    expect(args.orderBy).toEqual({ seq: 'asc' });
  });

  it('?type=step.failed,run.failed narrows by type', async () => {
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
    m.executionEvent.findMany.mockResolvedValue([]);
    await request(buildApp()).get('/api/runs/run-1/events?type=step.failed,run.failed');
    const args = m.executionEvent.findMany.mock.calls[0][0];
    expect(args.where.type).toEqual({ in: ['step.failed', 'run.failed'] });
  });

  it('?afterSeq=5 translates to seq > 5n', async () => {
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
    m.executionEvent.findMany.mockResolvedValue([]);
    await request(buildApp()).get('/api/runs/run-1/events?afterSeq=5');
    const args = m.executionEvent.findMany.mock.calls[0][0];
    expect(args.where.seq).toEqual({ gt: BigInt(5) });
  });

  it('?afterSeq=not-a-number returns 400', async () => {
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
    const res = await request(buildApp()).get('/api/runs/run-1/events?afterSeq=abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_after_seq');
    expect(m.executionEvent.findMany).not.toHaveBeenCalled();
  });

  it('surfaces nextAfterSeq when the page fills the limit', async () => {
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
    const page = [mkEvent({ seq: BigInt(1) }), mkEvent({ seq: BigInt(2) })];
    m.executionEvent.findMany.mockResolvedValue(page);

    const res = await request(buildApp()).get('/api/runs/run-1/events?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.nextAfterSeq).toBe('2');
    const args = m.executionEvent.findMany.mock.calls[0][0];
    expect(args.take).toBe(2);
  });

  it('caps limit at 1000', async () => {
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
    m.executionEvent.findMany.mockResolvedValue([]);
    await request(buildApp()).get('/api/runs/run-1/events?limit=9999');
    const args = m.executionEvent.findMany.mock.calls[0][0];
    expect(args.take).toBe(1000);
  });
});

describe('GET /api/runs/:id/events/stream (tenant gate)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventStreamFetch.mockReset();
    mockEventStreamSubscribe.mockReset();
    __resetSseConcurrencyForTests();
  });

  // The SSE body is an async xread-block loop we don't exercise here
  // — it's covered by EventStreamService tests directly. This suite
  // locks the tenant-scoped 404 so a route-order regression (e.g.
  // /:id accidentally matching /:id/events/stream) or a missing
  // tenant gate is caught by the unit suite before landing in prod.
  it('returns 404 when the run is not in the caller tenant', async () => {
    m.execution.findFirst.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/runs/run-x/events/stream');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('run_not_found');
    // The tenant check is scoped via runbook.tenantId — same pattern
    // as the detail and polling endpoints. Pins the invariant so a
    // refactor that swaps it for a loose id-only lookup breaks here.
    const args = m.execution.findFirst.mock.calls[0][0];
    expect(args.where.runbook.tenantId).toBe('tenant-1');
    expect(args.where.id).toBe('run-x');
  });
});

describe('GET /api/runs/:id/events/stream (backlog-then-tail)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventStreamFetch.mockReset();
    mockEventStreamSubscribe.mockReset();
    __resetSseConcurrencyForTests();
    // In-tenant by default for this suite.
    m.execution.findFirst.mockResolvedValue({ id: 'run-1' });
  });

  const mkEntry = (over: Partial<Record<string, unknown>> = {}) => ({
    id: '1712515200000-0',
    seq: '1',
    type: 'step.started',
    nodeId: 'node-a',
    payload: { nodeName: 'Fetch' },
    createdAt: '2026-04-07T00:00:01.000Z',
    ...over,
  });

  /** Build an async iterable that yields the given entries and then
   *  returns. The route's `for await` exits on return, which triggers
   *  res.end() and lets supertest resolve. */
  const asyncIter = (entries: unknown[]) => ({
    async *[Symbol.asyncIterator]() {
      for (const e of entries) yield e;
    },
  });

  it('replays backlog from Last-Event-ID header, then subscribes from the last backlog id', async () => {
    const backlog = [
      mkEntry({ id: '1000-0', seq: '1', type: 'run.started' }),
      mkEntry({ id: '1001-0', seq: '2', type: 'step.started', nodeId: 'a' }),
    ];
    const tail = [mkEntry({ id: '1002-0', seq: '3', type: 'step.succeeded', nodeId: 'a' })];
    mockEventStreamFetch.mockResolvedValue(backlog);
    mockEventStreamSubscribe.mockReturnValue(asyncIter(tail));

    const res = await request(buildApp())
      .get('/api/runs/run-1/events/stream')
      .set('Last-Event-ID', '999-0');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    // fetch was called with the resume cursor.
    expect(mockEventStreamFetch).toHaveBeenCalledWith('run-1', {
      fromId: '999-0',
      count: 10_000,
    });
    // subscribe resumed from the last backlog id (not the original
    // cursor) — otherwise we'd double-emit the last backlog row.
    expect(mockEventStreamSubscribe).toHaveBeenCalledWith('run-1', {
      fromId: '1001-0',
      signal: expect.any(Object),
    });

    // All three rows flushed in order, in SSE framing (id: … data: …).
    const frames = res.text.split('\n\n').filter(Boolean);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toContain('id: 1000-0');
    expect(frames[0]).toContain('"seq":"1"');
    expect(frames[0]).toContain('"type":"run.started"');
    expect(frames[2]).toContain('id: 1002-0');
    expect(frames[2]).toContain('"type":"step.succeeded"');
  });

  it('falls back to fromId query param when Last-Event-ID header is absent', async () => {
    mockEventStreamFetch.mockResolvedValue([]);
    mockEventStreamSubscribe.mockReturnValue(asyncIter([]));

    await request(buildApp()).get('/api/runs/run-1/events/stream?fromId=abc-0');
    expect(mockEventStreamFetch).toHaveBeenCalledWith('run-1', {
      fromId: 'abc-0',
      count: 10_000,
    });
    // Empty backlog → subscribe resumes from the same cursor
    // the client passed in.
    expect(mockEventStreamSubscribe).toHaveBeenCalledWith('run-1', {
      fromId: 'abc-0',
      signal: expect.any(Object),
    });
  });

  it('without cursor, skips replay and subscribes from the live edge "$"', async () => {
    mockEventStreamSubscribe.mockReturnValue(asyncIter([]));

    await request(buildApp()).get('/api/runs/run-1/events/stream');

    expect(mockEventStreamFetch).not.toHaveBeenCalled();
    expect(mockEventStreamSubscribe).toHaveBeenCalledWith('run-1', {
      fromId: '$',
      signal: expect.any(Object),
    });
  });

  it('sets SSE-appropriate headers for proxy buffering + keep-alive', async () => {
    mockEventStreamSubscribe.mockReturnValue(asyncIter([]));
    const res = await request(buildApp()).get('/api/runs/run-1/events/stream');
    expect(res.headers['cache-control']).toMatch(/no-cache/);
    // nginx hint: response must NOT be buffered or the client gets
    // events batched instead of in real-time.
    expect(res.headers['x-accel-buffering']).toBe('no');
  });

  it('frames every entry as id:<streamId> + data:<json> + blank line', async () => {
    mockEventStreamSubscribe.mockReturnValue(
      asyncIter([mkEntry({ id: 'z-1', seq: '42', type: 'run.completed', nodeId: null })])
    );
    const res = await request(buildApp()).get('/api/runs/run-1/events/stream');
    // Exact framing — regression would catch if someone swaps to a
    // different separator or drops the id line (breaks reconnect).
    expect(res.text).toBe(
      'id: z-1\n' +
        'data: {"id":"z-1","seq":"42","type":"run.completed","nodeId":null,"payload":{"nodeName":"Fetch"},"createdAt":"2026-04-07T00:00:01.000Z"}\n' +
        '\n'
    );
  });
});

describe('sseConcurrencyGuard (unit)', () => {
  beforeEach(() => {
    __resetSseConcurrencyForTests();
  });

  /** Build the minimum req/res shape the guard actually reads. IP
   *  drives the identifier fallback; headers.authorization is absent
   *  so the guard keys on ip:<ip>. */
  const mkReqRes = (ip = '10.0.0.1') => {
    const resCloseCallbacks: Array<() => void> = [];
    const res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'close') resCloseCallbacks.push(cb);
      }),
    };
    const req = {
      ip,
      socket: { remoteAddress: ip },
      headers: {},
    };
    return {
      req: req as unknown as Parameters<typeof sseConcurrencyGuard>[0],
      res: res as unknown as Parameters<typeof sseConcurrencyGuard>[1],
      fireClose: () => resCloseCallbacks.forEach(cb => cb()),
    };
  };

  it('allows up to 10 concurrent streams per identifier', () => {
    for (let i = 0; i < 10; i++) {
      const { req, res } = mkReqRes();
      const next = jest.fn();
      sseConcurrencyGuard(req, res, next);
      // First 10 opens all succeed → next() is called, no 429.
      expect(next).toHaveBeenCalledTimes(1);
      expect((res as unknown as { status: jest.Mock }).status).not.toHaveBeenCalledWith(429);
    }
  });

  it('rejects the 11th concurrent open with 429 + sse_concurrency_exceeded', () => {
    for (let i = 0; i < 10; i++) {
      const { req, res } = mkReqRes();
      sseConcurrencyGuard(req, res, jest.fn());
    }
    const { req, res } = mkReqRes();
    const next = jest.fn();
    sseConcurrencyGuard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    const resMock = res as unknown as { status: jest.Mock; json: jest.Mock; set: jest.Mock };
    expect(resMock.status).toHaveBeenCalledWith(429);
    expect(resMock.set).toHaveBeenCalledWith('Retry-After', '30');
    const body = resMock.json.mock.calls[0][0];
    expect(body.code).toBe('sse_concurrency_exceeded');
    expect(body.cap).toBe(10);
  });

  it('decrements on res close and lets new opens through again', () => {
    const handles: Array<ReturnType<typeof mkReqRes>> = [];
    for (let i = 0; i < 10; i++) {
      const h = mkReqRes();
      sseConcurrencyGuard(h.req, h.res, jest.fn());
      handles.push(h);
    }
    // Release one — its close handler must decrement the counter so a
    // new open is admitted. Without this, a legitimate browser that
    // navigates away and reconnects would get stuck at the cap.
    handles[0].fireClose();

    const { req, res } = mkReqRes();
    const next = jest.fn();
    sseConcurrencyGuard(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps counters per identifier, not global (tenant isolation)', () => {
    // Fill the cap for IP A, then confirm IP B can still open.
    for (let i = 0; i < 10; i++) {
      const { req, res } = mkReqRes('10.0.0.1');
      sseConcurrencyGuard(req, res, jest.fn());
    }
    const { req, res } = mkReqRes('10.0.0.2');
    const next = jest.fn();
    sseConcurrencyGuard(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/runs/:id/tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('appends new tags, deduplicates against existing, and returns the merged set', async () => {
    m.execution.findFirst.mockResolvedValueOnce({ tags: ['env:prod'] });
    m.execution.update.mockResolvedValueOnce({});
    const res = await request(buildApp())
      .post('/api/runs/run-1/tags')
      .send({ tags: ['env:prod', 'user:42', 'incident:INC-217'] });
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(
      expect.arrayContaining(['env:prod', 'user:42', 'incident:inc-217'])
    );
    // Update call carries the merged unique set.
    expect(m.execution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { tags: expect.arrayContaining(['env:prod', 'user:42', 'incident:inc-217']) },
      })
    );
  });

  it('caps the merged tag set at 16 entries', async () => {
    const existing = Array.from({ length: 12 }, (_, i) => `t${i}`);
    m.execution.findFirst.mockResolvedValueOnce({ tags: existing });
    m.execution.update.mockResolvedValueOnce({});
    const incoming = Array.from({ length: 10 }, (_, i) => `n${i}`);
    const res = await request(buildApp()).post('/api/runs/run-1/tags').send({ tags: incoming });
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toHaveLength(16);
  });

  it('drops malformed tag entries silently and 400s when nothing valid remains', async () => {
    const res = await request(buildApp())
      .post('/api/runs/run-1/tags')
      .send({ tags: ['', '  ', '!!invalid', 'A'.repeat(80)] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_tags');
    expect(m.execution.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the run does not belong to this tenant', async () => {
    m.execution.findFirst.mockResolvedValueOnce(null);
    const res = await request(buildApp())
      .post('/api/runs/foreign/tags')
      .send({ tags: ['env:prod'] });
    expect(res.status).toBe(404);
    expect(m.execution.update).not.toHaveBeenCalled();
  });
});
