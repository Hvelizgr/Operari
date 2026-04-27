import express from 'express';
import request from 'supertest';

/**
 * Cookie-session admin download of the audit log. Mirrors the
 * /api/v1/audit/export flow but uses session auth. Tests cover the
 * two gates (admin role + plan tier) and the streaming-body shape.
 */

const auditRecord = jest.fn().mockResolvedValue(undefined);
const streamEvents = jest.fn();

jest.mock('../../server', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

// Route constructs its own AuditService via `new AuditService(prisma)`.
// We patch the class so `getAudit()` inside the route returns a
// controllable stub instead of the real implementation.
jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    record: (...args: unknown[]) => auditRecord(...args),
    streamEvents: (...args: unknown[]) => streamEvents(...args),
  })),
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

import tenantsRoutes from '../../routes/tenants.routes';
import { prisma } from '../../server';

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

async function* yieldRows(rows: Array<Record<string, unknown>>) {
  for (const row of rows) yield row;
}

describe('GET /api/tenants/audit/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditRecord.mockResolvedValue(undefined);
  });

  it('returns 403 for non-admin callers', async () => {
    const app = makeApp({ id: 'u1', role: 'USER', tenantId: 't1' });
    const res = await request(app).get('/api/tenants/audit/export');
    expect(res.status).toBe(403);
    expect(streamEvents).not.toHaveBeenCalled();
  });

  it('returns 402 plan_gate for FREE-tier tenants', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ plan: 'FREE' });
    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).get('/api/tenants/audit/export');
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('plan_gate');
    expect(streamEvents).not.toHaveBeenCalled();
  });

  it('returns 402 for TEAM-tier tenants (export is BUSINESS+)', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ plan: 'TEAM' });
    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).get('/api/tenants/audit/export');
    expect(res.status).toBe(402);
  });

  it('streams NDJSON with the right headers on BUSINESS plans', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ plan: 'BUSINESS' });
    const rows = [
      {
        id: 'e1',
        seq: 1n,
        type: 'run.started',
        actorId: null,
        actorType: null,
        resource: null,
        payload: { runbookId: 'rb1' },
        hash: 'h1',
        prevHash: '',
        createdAt: new Date('2026-04-17T12:00:00Z'),
      },
      {
        id: 'e2',
        seq: 2n,
        type: 'run.completed',
        actorId: null,
        actorType: null,
        resource: null,
        payload: {},
        hash: 'h2',
        prevHash: 'h1',
        createdAt: new Date('2026-04-17T12:00:05Z'),
      },
    ];
    streamEvents.mockImplementation(() => yieldRows(rows));

    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).get('/api/tenants/audit/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="operari-audit-t1-\d{4}-\d{2}-\d{2}T\d{6}\.ndjson"$/
    );
    const lines = res.text.trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!);
    expect(first.type).toBe('run.started');
    // BigInt seq must serialize as a string — JSON has no bigint,
    // and SIEM parsers (Splunk/Datadog) expect a stable string
    // key rather than a number that might overflow.
    expect(first.seq).toBe('1');
    // Date must serialize as ISO string, not as the Date.toString() text.
    expect(first.createdAt).toBe('2026-04-17T12:00:00.000Z');
  });

  it('records an audit.exported event once the stream closes', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ plan: 'BUSINESS' });
    streamEvents.mockImplementation(() =>
      yieldRows([
        {
          id: 'e1',
          seq: 1n,
          type: 'run.started',
          actorId: null,
          actorType: null,
          resource: null,
          payload: {},
          hash: 'h1',
          prevHash: '',
          createdAt: new Date(),
        },
      ])
    );

    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    await request(app).get('/api/tenants/audit/export');

    // Flush the fire-and-forget audit write.
    await new Promise(r => setImmediate(r));
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        type: 'audit.exported',
        actorId: 'admin1',
        actorType: 'user',
        payload: expect.objectContaining({
          format: 'ndjson',
          count: 1,
        }),
      })
    );
  });

  it('validates fromSeq is a non-negative bigint', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ plan: 'BUSINESS' });
    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).get('/api/tenants/audit/export?fromSeq=-1');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_fromSeq');
  });
});
