import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { billingService } from '../services/billing.service';
import { requireFeature } from '../middleware/plan-limits.middleware';
import Stripe from 'stripe';

const router = Router();

// Lazy initialization of Stripe to avoid errors when API key is not set
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Billing features are disabled.');
    }
    stripe = new Stripe(apiKey, {
      apiVersion: '2025-12-15.clover' as any,
    });
  }
  return stripe;
}

/**
 * @swagger
 * /billing/subscription:
 *   get:
 *     summary: Get current subscription info
 *     tags: [Billing]
 */
router.get('/subscription', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const info = await billingService.getSubscriptionInfo(tenantId);
    res.json(info);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /billing/checkout:
 *   post:
 *     summary: Create checkout session for upgrade
 *     tags: [Billing]
 */
router.post('/checkout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const { plan } = req.body;

    if (!['PRO', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const url = await billingService.createCheckoutSession(tenantId, plan);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /billing/portal:
 *   post:
 *     summary: Create billing portal session
 *     tags: [Billing]
 */
router.post('/portal', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const url = await billingService.createPortalSession(tenantId);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /billing/webhook:
 *   post:
 *     summary: Stripe webhook handler
 *     tags: [Billing]
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await billingService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
