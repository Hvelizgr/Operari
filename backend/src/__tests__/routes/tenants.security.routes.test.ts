import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => {
  return {
    prisma: {
      tenant: { findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      auditEvent: { create: jest.fn(), findFirst: jest.fn() },
    },
  };
});

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => next(),
}));

// Inject the viewer profile the /security handlers read from req.user.
// Each test re-wires this before invoking the endpoint.
import tenantsRoutes from '../../routes/tenants.routes';
import { prisma } from '../../server';

function makeApp(viewer: { id: string; role: 'ADMIN' | 'USER'; tenantId: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = viewer;
    (req as any).log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use('/api/tenants', tenantsRoutes);
  return app;
}

describe('GET /api/tenants/security', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the current mfaRequired flag for any authed member', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ mfaRequired: true });
    const app = makeApp({ id: 'u1', role: 'USER', tenantId: 't1' });
    const res = await request(app).get('/api/tenants/security');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mfaRequired: true });
  });
});

describe('PATCH /api/tenants/security', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects non-admin callers', async () => {
    const app = makeApp({ id: 'u1', role: 'USER', tenantId: 't1' });
    const res = await request(app).patch('/api/tenants/security').send({ mfaRequired: true });
    expect(res.status).toBe(403);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('blocks enabling when the calling admin has no MFA enrolled (self-lockout guard)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ mfaEnabled: false });
    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).patch('/api/tenants/security').send({ mfaRequired: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('admin_mfa_required');
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('allows enabling when the admin has MFA + persists the toggle', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ mfaEnabled: true });
    (prisma.tenant.update as jest.Mock).mockResolvedValue({ mfaRequired: true });
    // Audit record is fire-and-forget (void .catch()), so a
    // missing chain mock doesn't fail the response. We don't
    // assert on it here — dedicated audit-service tests cover
    // the hash-chain plumbing.
    (prisma.auditEvent.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.auditEvent.create as jest.Mock).mockResolvedValue({});

    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).patch('/api/tenants/security').send({ mfaRequired: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mfaRequired: true });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { mfaRequired: true },
      select: { mfaRequired: true },
    });
  });

  it('lets admins DISABLE without the MFA self-check (disabling never locks anyone out)', async () => {
    (prisma.tenant.update as jest.Mock).mockResolvedValue({ mfaRequired: false });
    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).patch('/api/tenants/security').send({ mfaRequired: false });
    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('validates the body shape', async () => {
    const app = makeApp({ id: 'admin1', role: 'ADMIN', tenantId: 't1' });
    const res = await request(app).patch('/api/tenants/security').send({ somethingElse: true });
    expect(res.status).toBe(400);
  });
});
