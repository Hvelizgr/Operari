import express from 'express';
import request from 'supertest';

/**
 * Cookie-session inspector for the audit chain. Pairs with the
 * /api/tenants/audit/export endpoint but answers two narrower
 * questions for the Settings UI:
 *   - is the chain intact? (verify)
 *   - paginated read of recent events (events)
 *
 * Both are admin-only — the chain status is sensitive ops metadata.
 */

const verifyChain = jest.fn();
const streamEvents = jest.fn();

jest.mock('../../server', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    verifyChain: (...args: unknown[]) => verifyChain(...args),
    streamEvents: (...args: unknown[]) => streamEvents(...args),
    record: jest.fn(),
  })),
}));

jest.mock('../../audit/audit-redaction', () => ({
  buildDeletedActorSet: jest.fn().mockResolvedValue(new Set()),
  redactRow: (row: unknown) => row,
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

import tenantsRoutes from '../../routes/tenants.routes';

function makeApp(viewer: { id: string; role: 'ADMIN' | 'USER'; tenantId: string }) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = viewer;
    (req as any).log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use('/api/tenants', tenantsRoutes);
  return app;
}

async function* yieldRows<T>(rows: T[]) {
  for (const row of rows) yield row;
}

const ADMIN = { id: 'admin1', role: 'ADMIN' as const, tenantId: 't1' };
const USER = { id: 'u1', role: 'USER' as const, tenantId: 't1' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/tenants/audit/verify', () => {
  it('returns 403 for non-admin callers', async () => {
    const res = await request(makeApp(USER)).get('/api/tenants/audit/verify');
    expect(res.status).toBe(403);
    expect(verifyChain).not.toHaveBeenCalled();
  });

  it('returns the verify status with bigints serialized to strings', async () => {
    verifyChain.mockResolvedValue({
      tenantId: 't1',
      eventCount: 42,
      firstBrokenSeq: null,
      firstGapAfterSeq: null,
    });

    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/verify');

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('t1');
    expect(res.body.eventCount).toBe(42);
    expect(res.body.intact).toBe(true);
    expect(res.body.firstBrokenSeq).toBeNull();
    expect(res.body.firstGapAfterSeq).toBeNull();
    expect(typeof res.body.verifiedAt).toBe('string');
  });

  it('reports a broken chain with bigint seq serialized as string', async () => {
    verifyChain.mockResolvedValue({
      tenantId: 't1',
      eventCount: 100,
      firstBrokenSeq: 17n,
      firstGapAfterSeq: null,
    });

    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/verify');

    expect(res.status).toBe(200);
    expect(res.body.intact).toBe(false);
    expect(res.body.firstBrokenSeq).toBe('17');
  });

  it('rejects a non-numeric fromSeq with 400 invalid_fromSeq', async () => {
    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/verify?fromSeq=abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_fromSeq');
    expect(verifyChain).not.toHaveBeenCalled();
  });

  it('passes a valid fromSeq through as a bigint', async () => {
    verifyChain.mockResolvedValue({
      tenantId: 't1',
      eventCount: 0,
      firstBrokenSeq: null,
      firstGapAfterSeq: null,
    });
    await request(makeApp(ADMIN)).get('/api/tenants/audit/verify?fromSeq=42');
    expect(verifyChain).toHaveBeenCalledWith('t1', { fromSeq: 42n });
  });
});

describe('GET /api/tenants/audit/events', () => {
  it('returns 403 for non-admin callers', async () => {
    const res = await request(makeApp(USER)).get('/api/tenants/audit/events');
    expect(res.status).toBe(403);
    expect(streamEvents).not.toHaveBeenCalled();
  });

  it('returns the page with bigints + dates serialized as strings', async () => {
    streamEvents.mockReturnValue(
      yieldRows([
        {
          id: 'e1',
          seq: 1n,
          type: 'run.started',
          actorId: null,
          actorType: null,
          resource: 'rb-1',
          payload: { foo: 'bar' },
          hash: 'h1',
          prevHash: '',
          createdAt: new Date('2026-04-29T12:00:00Z'),
        },
        {
          id: 'e2',
          seq: 2n,
          type: 'run.completed',
          actorId: 'u1',
          actorType: 'user',
          resource: 'rb-1',
          payload: { exitCode: 0 },
          hash: 'h2',
          prevHash: 'h1',
          createdAt: new Date('2026-04-29T12:01:00Z'),
        },
      ])
    );

    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/events');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].seq).toBe('1');
    expect(res.body.data[0].createdAt).toBe('2026-04-29T12:00:00.000Z');
    expect(res.body.data[1].type).toBe('run.completed');
    expect(res.body.nextSeq).toBeNull();
  });

  it('returns nextSeq when the page is full plus one', async () => {
    // Route asks for pageSize+1 items to detect overflow. Yield 3 when
    // pageSize=2 to assert the cursor advances correctly.
    streamEvents.mockReturnValue(
      yieldRows(
        Array.from({ length: 3 }, (_, i) => ({
          id: `e${i + 1}`,
          seq: BigInt(i + 1),
          type: 'run.started',
          actorId: null,
          actorType: null,
          resource: null,
          payload: {},
          hash: `h${i + 1}`,
          prevHash: i === 0 ? '' : `h${i}`,
          createdAt: new Date('2026-04-29T12:00:00Z'),
        }))
      )
    );

    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/events?pageSize=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.nextSeq).toBe('3');
    // The route asks streamEvents for pageSize + 1 so it can decide.
    expect(streamEvents).toHaveBeenCalledWith('t1', expect.objectContaining({ pageSize: 3 }));
  });

  it('passes a single ?type=foo through as a one-element types array', async () => {
    streamEvents.mockReturnValue(yieldRows([]));
    await request(makeApp(ADMIN)).get('/api/tenants/audit/events?type=run.started');
    expect(streamEvents).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ types: ['run.started'] })
    );
  });

  it('passes repeated ?type=&type= through as an array of types', async () => {
    streamEvents.mockReturnValue(yieldRows([]));
    await request(makeApp(ADMIN)).get('/api/tenants/audit/events?type=run.started&type=run.failed');
    expect(streamEvents).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ types: ['run.started', 'run.failed'] })
    );
  });

  it('rejects pageSize > 200 with invalid_pageSize', async () => {
    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/events?pageSize=999');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_pageSize');
    expect(streamEvents).not.toHaveBeenCalled();
  });

  it('rejects negative fromSeq with invalid_fromSeq', async () => {
    const res = await request(makeApp(ADMIN)).get('/api/tenants/audit/events?fromSeq=-1');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_fromSeq');
    expect(streamEvents).not.toHaveBeenCalled();
  });
});
