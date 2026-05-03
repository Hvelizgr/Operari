import express from 'express';
import request from 'supertest';

// Mock the prisma re-export. The overview endpoint aggregates across
// execution / approval / runbook / webhook, so every model surface the
// route touches has to exist on the mock.
jest.mock('../../server', () => ({
  prisma: {
    execution: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    approval: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    runbook: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    webhook: {
      aggregate: jest.fn(),
    },
    monitor: {
      count: jest.fn(),
    },
  },
}));

import dashboardRouter from '../../routes/dashboard.routes';
import { prisma as mockedPrisma } from '../../server';

type MockPrisma = {
  execution: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
  approval: { count: jest.Mock; findMany: jest.Mock };
  runbook: { count: jest.Mock; findMany: jest.Mock };
  webhook: { aggregate: jest.Mock };
  monitor: { count: jest.Mock };
};
const m = mockedPrisma as unknown as MockPrisma;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = {
      id: 'u-1',
      email: 'u@x.com',
      role: 'USER',
      tenantId: 'tenant-1',
    };
    next();
  });
  app.use('/api/dashboard', dashboardRouter);
  return app;
};

/** Wire every prisma call the route fires in Promise.all to a sane
 *  empty default. Individual tests can override any single method
 *  after calling this — only the bits under test have to be set. */
const primeEmpty = () => {
  m.execution.count.mockResolvedValue(0);
  // Promise.all order: runs24hFinished, stuckRuns, recentFailures,
  // liveRuns, recentRuns, runs7d. Default them all to [].
  m.execution.findMany.mockResolvedValue([]);
  m.execution.groupBy.mockResolvedValue([]);
  m.approval.count.mockResolvedValue(0);
  m.approval.findMany.mockResolvedValue([]);
  m.runbook.count.mockResolvedValue(0);
  m.runbook.findMany.mockResolvedValue([]);
  m.webhook.aggregate.mockResolvedValue({
    _count: { _all: 0 },
    _max: { lastTriggeredAt: null },
  });
  m.monitor.count.mockResolvedValue(0);
};

describe('GET /api/dashboard/overview — recentStatuses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeEmpty();
  });

  it('hydrates recentStatuses onto each top runbook, chronological oldest→newest', async () => {
    // Two workflows come back from the groupBy top-N. We return the
    // recent-20 fan-out in desc order (newest first) from Prisma, and
    // the route must reverse so the sparkline reads left→right.
    m.execution.groupBy.mockResolvedValue([
      { runbookId: 'wf-a', _count: { _all: 10 } },
      { runbookId: 'wf-b', _count: { _all: 3 } },
    ]);
    m.runbook.findMany.mockResolvedValue([
      { id: 'wf-a', slug: 'wf-a-slug', name: 'Workflow A' },
      { id: 'wf-b', slug: 'wf-b-slug', name: 'Workflow B' },
    ]);

    // Per-call sequencing: perWorkflowExecs (aggregates) first, then
    // one findMany per runbook for the last-20 rows. The route runs
    // these in Promise.all inside the `if (topWorkflowIds.length > 0)`
    // branch — mock them in the order the call list will see.
    m.execution.findMany
      // runs24hFinished
      .mockResolvedValueOnce([])
      // stuckRuns
      .mockResolvedValueOnce([])
      // recentFailures
      .mockResolvedValueOnce([])
      // liveRuns
      .mockResolvedValueOnce([])
      // recentRuns
      .mockResolvedValueOnce([])
      // runs7d
      .mockResolvedValueOnce([])
      // perWorkflowExecs (aggregate source for successRate/avgDuration)
      .mockResolvedValueOnce([
        { runbookId: 'wf-a', status: 'SUCCESS', duration: 1000 },
        { runbookId: 'wf-a', status: 'FAILED', duration: 500 },
      ])
      // last-20 for wf-a (newest first)
      .mockResolvedValueOnce([{ status: 'FAILED' }, { status: 'SUCCESS' }, { status: 'SUCCESS' }])
      // last-20 for wf-b (newest first)
      .mockResolvedValueOnce([{ status: 'SUCCESS' }]);

    const res = await request(buildApp()).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.topRunbooks).toHaveLength(2);

    const a = res.body.topRunbooks[0];
    expect(a.slug).toBe('wf-a-slug');
    expect(a.name).toBe('Workflow A');
    expect(a.runs).toBe(10);
    // Reversed from [FAILED, SUCCESS, SUCCESS] → [SUCCESS, SUCCESS, FAILED]
    expect(a.recentStatuses).toEqual(['SUCCESS', 'SUCCESS', 'FAILED']);

    const b = res.body.topRunbooks[1];
    expect(b.recentStatuses).toEqual(['SUCCESS']);
  });

  it('emits empty recentStatuses for runbooks with no executions in the fan-out', async () => {
    m.execution.groupBy.mockResolvedValue([{ runbookId: 'wf-lonely', _count: { _all: 1 } }]);
    m.runbook.findMany.mockResolvedValue([{ id: 'wf-lonely', slug: null, name: 'Lonely' }]);
    m.execution.findMany
      .mockResolvedValueOnce([]) // runs24hFinished
      .mockResolvedValueOnce([]) // stuckRuns
      .mockResolvedValueOnce([]) // recentFailures
      .mockResolvedValueOnce([]) // liveRuns
      .mockResolvedValueOnce([]) // recentRuns
      .mockResolvedValueOnce([]) // runs7d
      .mockResolvedValueOnce([]) // perWorkflowExecs
      .mockResolvedValueOnce([]); // last-20 for wf-lonely (empty)

    const res = await request(buildApp()).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.topRunbooks[0].recentStatuses).toEqual([]);
  });

  it('skips the per-runbook fan-out entirely when no top runbooks exist', async () => {
    // groupBy returns [] → the if-branch never fires → recentStatuses
    // work never happens. Pinning this keeps the empty-tenant path
    // cheap (no extra round-trips for a brand-new account).
    const res = await request(buildApp()).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.topRunbooks).toEqual([]);
    // Only the 6 base findManys ran — no per-runbook fan-out.
    expect(m.execution.findMany).toHaveBeenCalledTimes(6);
    expect(m.runbook.findMany).not.toHaveBeenCalled();
  });

  it('requests last 20 executions per runbook ordered startedAt desc', async () => {
    // Pin the sparkline query shape so a refactor that drops the cap
    // or flips the ordering is caught here.
    m.execution.groupBy.mockResolvedValue([{ runbookId: 'wf-a', _count: { _all: 5 } }]);
    m.runbook.findMany.mockResolvedValue([{ id: 'wf-a', slug: 's', name: 'A' }]);
    m.execution.findMany
      .mockResolvedValueOnce([]) // runs24hFinished
      .mockResolvedValueOnce([]) // stuckRuns
      .mockResolvedValueOnce([]) // recentFailures
      .mockResolvedValueOnce([]) // liveRuns
      .mockResolvedValueOnce([]) // recentRuns
      .mockResolvedValueOnce([]) // runs7d
      .mockResolvedValueOnce([]) // perWorkflowExecs
      .mockResolvedValueOnce([{ status: 'SUCCESS' }]); // last-20 for wf-a

    await request(buildApp()).get('/api/dashboard/overview');

    // Call index 7 (0-based) is the per-runbook last-20 findMany.
    // The where clause carries tenantId alongside runbookId — without
    // it the runtime tenant-scope guard throws and poisons the
    // connection pool (see commit 497ed73 / pendiente.md cascading
    // hang root cause).
    const last20Args = m.execution.findMany.mock.calls[7][0];
    expect(last20Args.where).toEqual({ runbookId: 'wf-a', tenantId: 'tenant-1' });
    expect(last20Args.orderBy).toEqual({ startedAt: 'desc' });
    expect(last20Args.take).toBe(20);
    expect(last20Args.select).toEqual({ status: true });
  });
});

describe('GET /api/dashboard/overview — changes24h', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeEmpty();
  });

  it('returns zeros for an empty tenant', async () => {
    const res = await request(buildApp()).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.changes24h).toEqual({
      newRunbooks: 0,
      newApprovals: 0,
      newlyFiredMonitors: 0,
      runsDelta: { current: 0, prior: 0, change: 0 },
    });
  });

  it('surfaces counts + signed delta when data is present', async () => {
    // execution.count is called 3 times in order: runs24hCount,
    // runs24hSuccess, priorRuns24h. Wire the three explicitly so the
    // delta math is provable.
    m.execution.count
      .mockResolvedValueOnce(42) // runs24hCount
      .mockResolvedValueOnce(40) // runs24hSuccess (not under test here)
      .mockResolvedValueOnce(30); // priorRuns24h
    m.runbook.count.mockResolvedValue(3);
    m.approval.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    // ^ first approval.count is the pendingApprovals widget; second
    // is newApprovals24h. Order matters per the Promise.all call site.
    m.monitor.count.mockResolvedValue(2);

    const res = await request(buildApp()).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.changes24h).toEqual({
      newRunbooks: 3,
      newApprovals: 5,
      newlyFiredMonitors: 2,
      runsDelta: { current: 42, prior: 30, change: 12 },
    });
  });

  it('exposes a negative delta when the current window dropped below prior', async () => {
    m.execution.count
      .mockResolvedValueOnce(10) // runs24hCount
      .mockResolvedValueOnce(10) // runs24hSuccess
      .mockResolvedValueOnce(25); // priorRuns24h

    const res = await request(buildApp()).get('/api/dashboard/overview');
    expect(res.body.changes24h.runsDelta).toEqual({
      current: 10,
      prior: 25,
      change: -15,
    });
  });

  it('scopes every delta query to the caller tenant', async () => {
    await request(buildApp()).get('/api/dashboard/overview');
    // runbook.count is the new-runbooks query — its where clause
    // must carry tenantId or we'd leak across tenants.
    const newRunbookArgs = m.runbook.count.mock.calls[0][0];
    expect(newRunbookArgs.where.tenantId).toBe('tenant-1');
    expect(newRunbookArgs.where.createdAt.gte).toBeInstanceOf(Date);

    // monitor.count scopes the same way.
    const monitorArgs = m.monitor.count.mock.calls[0][0];
    expect(monitorArgs.where.tenantId).toBe('tenant-1');
    expect(monitorArgs.where.lastFiredAt.gte).toBeInstanceOf(Date);
  });
});
