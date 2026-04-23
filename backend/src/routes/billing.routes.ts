import type { Plan } from '@prisma/client';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';

import { getTenantUsage } from '../billing/quotas';
import {
  createCheckoutSession,
  createPortalSession,
  StripeHttpError,
} from '../billing/stripe-checkout-client';
import { StripeSignatureError, verifyStripeWebhook } from '../billing/stripe-webhook';
import { logger } from '../config/logger.config';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';
import { recordWebhookEvent } from '../utils/webhook-dedup';

const router = Router();

/**
 * Stripe price id lookup. Operators set these in the env per plan
 * and period. An unset price id means that plan/period combo is
 * not offered — the route returns 400 with a clear message rather
 * than redirecting to a broken checkout.
 */
function priceIdFor(plan: 'TEAM' | 'BUSINESS', period: 'monthly' | 'yearly'): string | undefined {
  const key = `STRIPE_PRICE_${plan}_${period.toUpperCase()}`;
  return process.env[key];
}

function stripeConfigured(): { secretKey: string } | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return { secretKey };
}

const checkoutSchema = z.object({
  plan: z.enum(['TEAM', 'BUSINESS']),
  period: z.enum(['monthly', 'yearly']),
});

/**
 * GET /api/billing/usage
 *
 * Current usage vs plan limits. Returned to the settings "Plan &
 * billing" section so the user sees "2/3 runbooks" without a custom
 * count query. Does not require Stripe to be configured — quotas
 * still apply on self-host + cloud unconfigured.
 */
router.get('/usage', authenticate, async (req: AuthRequest, res: Response) => {
  const usage = await getTenantUsage(prisma, req.user!.tenantId);
  if (!usage) return res.status(404).json({ error: 'Tenant not found' });
  return res.json({ data: usage });
});

/**
 * GET /api/billing/summary
 *
 * Cheap read for the settings panel — returns the plan-relevant
 * columns on the tenant row. Returns 501 when Stripe isn't
 * configured so the panel can render the "self-host = free forever"
 * message without a second round-trip to probe the provider.
 */
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  if (!stripeConfigured()) {
    return res.status(501).json({ error: 'Billing is not configured on this server' });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: {
      plan: true,
      planStatus: true,
      planCurrentPeriodEnd: true,
      stripeCustomerId: true,
    },
  });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  return res.json({ data: tenant });
});

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the caller's tenant and
 * returns its hosted-page URL. The client redirects the browser to
 * that URL; Stripe redirects back to the `success_url` on payment.
 * The webhook handler is what actually flips the tenant's plan to
 * paid — this endpoint only mints the session.
 */
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  const config = stripeConfigured();
  if (!config) {
    return res.status(501).json({ error: 'Billing is not configured on this server' });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid checkout payload', issues: parsed.error.issues });
  }
  const priceId = priceIdFor(parsed.data.plan, parsed.data.period);
  if (!priceId) {
    return res
      .status(400)
      .json({ error: `No Stripe price configured for ${parsed.data.plan}/${parsed.data.period}` });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { id: true, stripeCustomerId: true },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await createCheckoutSession(config, {
      priceId,
      customerId: tenant.stripeCustomerId ?? undefined,
      customerEmail: tenant.stripeCustomerId ? undefined : req.user!.email,
      successUrl: `${frontendUrl}/en/settings?checkout=success`,
      cancelUrl: `${frontendUrl}/en/settings?checkout=canceled`,
      metadata: { tenantId: tenant.id, plan: parsed.data.plan, period: parsed.data.period },
    });

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    if (err instanceof StripeHttpError) {
      req.log.error({ status: err.status, body: err.body }, 'stripe checkout failed');
      return res.status(502).json({ error: 'Checkout provider rejected the request' });
    }
    req.log.error({ err }, 'checkout failed');
    return res.status(500).json({ error: 'Checkout failed' });
  }
});

/**
 * POST /api/billing/portal
 *
 * Opens a Stripe Billing Portal session so the user can update their
 * payment method, change the plan, cancel, or download invoices —
 * all hosted by Stripe. Requires the tenant to already have a
 * `stripeCustomerId` (i.e. they paid at least once).
 */
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  const config = stripeConfigured();
  if (!config) {
    return res.status(501).json({ error: 'Billing is not configured on this server' });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant?.stripeCustomerId) {
    return res.status(409).json({ error: 'This tenant has no active Stripe customer yet' });
  }
  try {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await createPortalSession(config, {
      customerId: tenant.stripeCustomerId,
      returnUrl: `${frontendUrl}/en/settings`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, 'portal failed');
    return res.status(502).json({ error: 'Portal provider rejected the request' });
  }
});

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  items: { data: Array<{ price: { id: string } }> };
  metadata: Record<string, string>;
};

function planFromPriceId(priceId: string): Plan | null {
  const envMap: Array<[string, Plan]> = [
    ['STRIPE_PRICE_TEAM_MONTHLY', 'TEAM'],
    ['STRIPE_PRICE_TEAM_YEARLY', 'TEAM'],
    ['STRIPE_PRICE_BUSINESS_MONTHLY', 'BUSINESS'],
    ['STRIPE_PRICE_BUSINESS_YEARLY', 'BUSINESS'],
  ];
  for (const [key, plan] of envMap) {
    if (process.env[key] === priceId) return plan;
  }
  return null;
}

/**
 * POST /api/billing/webhook
 *
 * Stripe → NanoRun. Raw body signature-verified with the endpoint
 * secret. Only three event types move the needle on our state:
 *
 *   - checkout.session.completed: first successful payment. We pull
 *     the subscription id, look up the customer's metadata.tenantId,
 *     write the plan/status/period to the tenant row.
 *   - customer.subscription.updated: renewals, plan changes, status
 *     transitions (active → past_due, etc).
 *   - customer.subscription.deleted: cancellation / lapse. We wipe
 *     the subscription id and drop the tenant back to FREE.
 *
 * Any other event is logged and 200'd so Stripe does not retry it.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(501).json({ error: 'Webhook secret not configured' });
  }
  const header = req.get('stripe-signature');
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!header || !rawBody) {
    return res.status(400).json({ error: 'Missing signature or body' });
  }
  try {
    verifyStripeWebhook({ secret, header, rawBody });
  } catch (err) {
    if (err instanceof StripeSignatureError) {
      logger.warn({ msg: 'stripe webhook signature rejected', reason: err.message });
      return res.status(400).json({ error: 'Invalid signature' });
    }
    throw err;
  }

  const event = JSON.parse(rawBody.toString('utf8')) as {
    id: string;
    type: string;
    data: { object: unknown };
  };

  // Idempotency gate. Stripe retries delivery on any non-2xx and can
  // also legitimately re-deliver in edge cases (network flaps, their
  // own outage recovery). Without this, a replayed
  // checkout.session.completed flips Tenant.planStatus twice. Write-
  // first-wins via WebhookEvent.(source, eventId) UNIQUE.
  try {
    const dedup = await recordWebhookEvent(prisma, {
      source: 'stripe',
      eventId: event.id,
    });
    if (dedup.duplicate) {
      logger.info({ eventId: event.id, type: event.type }, 'stripe webhook duplicate skipped');
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (err) {
    // Dedup ledger write failed (DB down). Fail closed — return 5xx so
    // Stripe retries rather than letting the handler mutate state
    // without a dedup entry.
    logger.error({ err, eventId: event.id }, 'stripe webhook dedup write failed');
    return res.status(503).json({ error: 'Transient dedup failure; retry later' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          customer: string;
          subscription: string;
          metadata?: { tenantId?: string };
        };
        const tenantId = session.metadata?.tenantId;
        if (!tenantId) break;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as StripeSubscription;
        const priceId = sub.items.data[0]?.price.id;
        const plan = priceId ? planFromPriceId(priceId) : null;
        const tenantId = sub.metadata?.nanorun_tenant;
        if (!tenantId) break;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: plan ?? undefined,
            stripeCustomerId: sub.customer,
            stripeSubscriptionId: sub.id,
            planStatus: sub.status,
            planCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as StripeSubscription;
        const tenantId = sub.metadata?.nanorun_tenant;
        if (!tenantId) break;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: 'FREE',
            stripeSubscriptionId: null,
            planStatus: 'canceled',
          },
        });
        break;
      }
      default:
        logger.debug({ type: event.type, msg: 'stripe webhook ignored (unhandled type)' });
    }
  } catch (err) {
    logger.error({ err, type: event.type, msg: 'stripe webhook handler threw' });
    return res.status(500).json({ error: 'Handler error' });
  }
  return res.status(200).json({ received: true });
});

export default router;
