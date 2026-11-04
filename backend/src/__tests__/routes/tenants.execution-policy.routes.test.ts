import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => ({
  prisma: {
    tenant: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockRejectedValue(new Error('no audit in tests')),
  },
}));
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

import tenantsRoutes from '../../routes/tenants.routes';
import { prisma } from '../../server';

const current = {
  sshPolicy: 'registered',
  sandboxEgress: 'open',
  egressAllowlist: [],
  privilegedApprovals: 1,
};

function makeApp(role: 'ADMIN' | 'USER') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'u1', role, tenantId: 't1' };
    next();
  });
  app.use('/api/tenants', tenantsRoutes);
  return app;
}

describe('/api/tenants/execution-policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(current);
    (prisma.tenant.update as jest.Mock).mockImplementation(async ({ data }: any) => data);
  });

  it('is readable by members and normalised', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      ...current,
      sandboxEgress: 'weird',
    });
    const res = await request(makeApp('USER')).get('/api/tenants/execution-policy').expect(200);
    expect(res.body.data.sandboxEgress).toBe('open');
  });

  it('only admins change it', async () => {
    await request(makeApp('USER'))
      .patch('/api/tenants/execution-policy')
      .send({ sshPolicy: 'any' })
      .expect(403);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('refuses an empty allowlist, bad hosts and other approver counts', async () => {
    const app = makeApp('ADMIN');
    await request(app)
      .patch('/api/tenants/execution-policy')
      .send({ sandboxEgress: 'allowlist' })
      .expect(400);
    await request(app)
      .patch('/api/tenants/execution-policy')
      .send({ sandboxEgress: 'allowlist', egressAllowlist: ['https://pypi.org/simple'] })
      .expect(400);
    await request(app)
      .patch('/api/tenants/execution-policy')
      .send({ egressAllowlist: ['10.0.0.1'] })
      .expect(400);
    await request(app)
      .patch('/api/tenants/execution-policy')
      .send({ privilegedApprovals: 3 })
      .expect(400);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('merges, lowercases and dedupes the allowlist', async () => {
    const res = await request(makeApp('ADMIN'))
      .patch('/api/tenants/execution-policy')
      .send({
        sandboxEgress: 'allowlist',
        egressAllowlist: ['PyPI.org', 'pypi.org', '*.GitHub.com'],
      })
      .expect(200);
    expect(res.body.data).toEqual({
      sshPolicy: 'registered',
      sandboxEgress: 'allowlist',
      egressAllowlist: ['pypi.org', '*.github.com'],
      privilegedApprovals: 1,
    });
    expect((prisma.tenant.update as jest.Mock).mock.calls[0][0].where).toEqual({ id: 't1' });
  });
});
