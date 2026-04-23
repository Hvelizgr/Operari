import type { NextFunction, Response } from 'express';

jest.mock('../../server', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

import type { AuthRequest } from '../../middleware/auth.middleware';
import { requirePlan } from '../../middleware/plan.middleware';
import { prisma } from '../../server';

const findUnique = prisma.tenant.findUnique as jest.Mock;

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

function makeReq(tenantId = 't-1'): AuthRequest {
  return {
    user: { id: 'u-1', email: 'a@b.co', role: 'USER', tenantId },
  } as AuthRequest;
}

describe('requirePlan', () => {
  beforeEach(() => {
    findUnique.mockReset();
    delete process.env.NANORUN_ANONYMOUS_MODE;
  });

  it('bypasses the gate entirely in anonymous mode', async () => {
    process.env.NANORUN_ANONYMOUS_MODE = 'true';
    const next = jest.fn() as unknown as NextFunction;
    const { res } = makeRes();
    await requirePlan('TEAM')(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('401s when req.user is missing', async () => {
    const next = jest.fn() as unknown as NextFunction;
    const { res, status, json } = makeRes();
    await requirePlan('TEAM')({} as AuthRequest, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes ENTERPRISE unconditionally', async () => {
    findUnique.mockResolvedValue({ plan: 'ENTERPRISE', planStatus: null });
    const next = jest.fn() as unknown as NextFunction;
    const { res } = makeRes();
    // Deliberately ask for a plan the tenant does NOT have
    await requirePlan('TEAM')(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes when tenant plan is in the allowed list', async () => {
    findUnique.mockResolvedValue({ plan: 'TEAM', planStatus: 'active' });
    const next = jest.fn() as unknown as NextFunction;
    const { res } = makeRes();
    await requirePlan('TEAM', 'BUSINESS')(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('402s with upgrade hint when tenant plan is below', async () => {
    findUnique.mockResolvedValue({ plan: 'FREE', planStatus: null });
    const next = jest.fn() as unknown as NextFunction;
    const { res, status, json } = makeRes();
    await requirePlan('TEAM', 'BUSINESS')(makeReq(), res, next);
    expect(status).toHaveBeenCalledWith(402);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPlan: 'FREE',
        requiredPlans: ['TEAM', 'BUSINESS'],
        upgrade: '/api/billing/checkout',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('404s when the tenant row is missing', async () => {
    findUnique.mockResolvedValue(null);
    const next = jest.fn() as unknown as NextFunction;
    const { res, status, json } = makeRes();
    await requirePlan('TEAM')(makeReq('t-missing'), res, next);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Tenant not found' });
    expect(next).not.toHaveBeenCalled();
  });
});
