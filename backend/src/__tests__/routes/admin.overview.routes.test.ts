import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
    customRole: { findMany: jest.fn() },
    runbook: { count: jest.fn() },
    execution: { count: jest.fn() },
    apiKey: { count: jest.fn() },
    webhook: { count: jest.fn() },
    scheduledJob: { count: jest.fn() },
    eventAgent: { count: jest.fn() },
    monitor: { count: jest.fn() },
    auditEvent: { count: jest.fn() },
    keyRotationJob: { findFirst: jest.fn() },
  },
}));

// The admin routes module constructs KeyRotationService + AuditService
// lazily on the rotation endpoints. /overview doesn't touch them but
// the imports still resolve at module-load, so stub the constructors.
jest.mock('../../security/key-rotation.service', () => ({
  KeyRotationService: jest.fn().mockImplementation(() => ({})),
  KeyRotationError: class extends Error {},
}));
jest.mock('../../security/secret-cipher', () => ({
  secretCipherFromEnv: jest.fn(() => ({ hasLegacyKeys: () => false })),
}));
jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({})),
}));

import adminRoutes from '../../routes/admin.routes';
import { prisma } from '../../server';

function makeApp(viewer: { id: string; role: 'ADMIN' | 'USER'; tenantId: string; email: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = viewer;
    (req as any).log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use('/api/admin', adminRoutes);
  return app;
}

const USER_VIEWER = {
  id: 'u-1',
  role: 'USER' as const,
  tenantId: 't-1',
  email: 'u@x.com',
};

describe('GET /api/admin/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function stubCounts(values: number[]) {
    const models = [
      'runbook',
      'execution',
      'apiKey',
      'webhook',
      'scheduledJob',
      'eventAgent',
      'monitor',
      'auditEvent',
    ] as const;
    models.forEach((m, i) => {
      (prisma[m].count as jest.Mock).mockResolvedValue(values[i] ?? 0);
    });
  }

  it('returns tenant + users + custom roles + counts for the caller tenant', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      id: 't-1',
      name: 'Acme',
      slug: 'acme',
      plan: 'TEAM',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      workosOrganizationId: null,
      stripeCustomerId: null,
    });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'u-1', email: 'a@x.com', name: 'Admin', role: 'ADMIN', createdAt: new Date() },
      { id: 'u-2', email: 'b@x.com', name: 'User', role: 'USER', createdAt: new Date() },
    ]);
    (prisma.customRole.findMany as jest.Mock).mockResolvedValue([
      { id: 'r-1', name: 'oncall', description: null, permissions: [], createdAt: new Date() },
    ]);
    stubCounts([12, 340, 3, 2, 1, 0, 5, 200]);

    const res = await request(makeApp(USER_VIEWER)).get('/api/admin/overview');

    expect(res.status).toBe(200);
    expect(res.body.tenant).toMatchObject({ id: 't-1', slug: 'acme', plan: 'TEAM' });
    expect(res.body.users).toHaveLength(2);
    expect(res.body.customRoles).toHaveLength(1);
    expect(res.body.counts).toEqual({
      runbooks: 12,
      runs: 340,
      apiKeys: 3,
      webhooks: 2,
      schedules: 1,
      agents: 0,
      monitors: 5,
      auditEvents: 200,
    });
  });

  it('scopes every query to the caller tenantId', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.customRole.findMany as jest.Mock).mockResolvedValue([]);
    stubCounts([0, 0, 0, 0, 0, 0, 0, 0]);

    await request(makeApp(USER_VIEWER)).get('/api/admin/overview');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't-1' } })
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1' } })
    );
    expect(prisma.customRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1' } })
    );
    expect(prisma.scheduledJob.count).toHaveBeenCalledWith({
      where: { runbook: { tenantId: 't-1' } },
    });
  });

  it('returns 200 with tenant=null when the record was deleted under the caller', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.customRole.findMany as jest.Mock).mockResolvedValue([]);
    stubCounts([0, 0, 0, 0, 0, 0, 0, 0]);

    const res = await request(makeApp(USER_VIEWER)).get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.tenant).toBeNull();
  });
});
