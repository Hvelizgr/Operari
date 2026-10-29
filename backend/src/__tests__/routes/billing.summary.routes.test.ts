import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => ({
  prisma: { tenant: { findUnique: jest.fn() } },
}));
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', tenantId: 't-1', role: 'ADMIN', email: 'a@x.com' };
    next();
  },
}));

import billingRoutes from '../../routes/billing.routes';
import { prisma } from '../../server';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRoutes);
  return app;
}

describe('GET /api/billing/summary', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    jest.clearAllMocks();
  });

  it('reports an unconfigured provider as a normal 200, not an error', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const res = await request(makeApp()).get('/api/billing/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false });
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('returns the tenant plan when Stripe is configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      plan: 'TEAM',
      planStatus: 'active',
      planCurrentPeriodEnd: null,
      stripeCustomerId: 'cus_1',
    });

    const res = await request(makeApp()).get('/api/billing/summary');

    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('TEAM');
  });
});
