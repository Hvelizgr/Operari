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
    },
    executionEvent: {
      findMany: jest.fn(),
    },
  },
}));

// The SSE route calls getEventStream() — stub it with a no-op service
// so the test doesn't pull in the Redis config singleton. The gate
// test (404) short-circuits before this is touched, but importing
// the route requires the module graph to resolve cleanly.
jest.mock('../../observability/event-stream.service', () => ({
  getEventStream: () => ({
    fetch: jest.fn(async () => []),
    subscribe: async function* () {
      /* empty iterator — the gate path never enters this */
    },
  }),
}));

import runsRouter from '../../routes/runs.routes';
import { prisma as mockedPrisma } from '../../server';

type MockPrisma = {
  execution: { findFirst: jest.Mock; findMany: jest.Mock };
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
    // The tenant check is scoped via workflow.tenantId — same pattern
    // as the detail and polling endpoints. Pins the invariant so a
    // refactor that swaps it for a loose id-only lookup breaks here.
    const args = m.execution.findFirst.mock.calls[0][0];
    expect(args.where.workflow.tenantId).toBe('tenant-1');
    expect(args.where.id).toBe('run-x');
  });
});
