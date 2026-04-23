import type { Plan } from '@prisma/client';
import type { NextFunction, Response } from 'express';

import { prisma } from '../server';
import type { AuthRequest } from './auth.middleware';

/**
 * Plan-gating middleware.
 *
 * Apply AFTER `authenticate` (or `anonymousFallback`) so `req.user`
 * is populated. Looks up the tenant's current plan and 402's when
 * it's below the required set. ENTERPRISE always passes because
 * enterprise customers are priced individually and might not carry
 * the specific enum value of the route they're hitting.
 *
 * Anonymous mode short-circuits: self-host single-tenant users have
 * no billing concept and trying to gate them would just break the
 * editor. The runtime check is identical to the one in
 * `anonymousFallback`.
 *
 * 402 Payment Required is the right status here (RFC 9110 reserves
 * it for exactly this case). The response body includes an
 * `upgrade` hint the frontend can map to /api/billing/checkout.
 */
export function requirePlan(
  ...allowedPlans: Plan[]
): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    if (process.env.NANORUN_ANONYMOUS_MODE === 'true') {
      return next();
    }
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { plan: true, planStatus: true },
    });
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Enterprise passes every gate unconditionally — they get
    // whatever was negotiated off-platform.
    if (tenant.plan === 'ENTERPRISE') return next();

    // past_due subscriptions keep access until Stripe fully
    // cancels (customer.subscription.deleted flips plan to FREE).
    // That matches the dunning grace period the user expects
    // and avoids a short outage when a card expires.
    if (allowedPlans.includes(tenant.plan)) return next();

    res.status(402).json({
      error: 'Plan upgrade required',
      currentPlan: tenant.plan,
      requiredPlans: allowedPlans,
      upgrade: '/api/billing/checkout',
    });
  };
}
