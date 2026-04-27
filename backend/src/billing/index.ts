import type { PrismaClient } from '@prisma/client';

import { BillingDispatchWorker } from './billing-dispatch-worker';
import type { BillingMeter } from './billing-meter.types';
import { NoopBillingMeter } from './noop-billing-meter';
import { QueuedBillingMeter } from './queued-billing-meter';
import { StripeBillingMeter } from './stripe-billing-meter';
import { buildStripeMeterEventSender } from './stripe-http-client';

export type {
  BillingDispatchReport,
  BillingDispatchWorkerOptions,
} from './billing-dispatch-worker';
export { BillingDispatchWorker } from './billing-dispatch-worker';
export type { BillableEvent, BillableEventType, BillingMeter } from './billing-meter.types';
export { NoopBillingMeter } from './noop-billing-meter';
export { QueuedBillingMeter } from './queued-billing-meter';
export type { SendMeterEventFn, StripeBillingMeterOptions } from './stripe-billing-meter';
export { StripeBillingMeter } from './stripe-billing-meter';
export type { StripeHttpClientOptions } from './stripe-http-client';
export { buildStripeMeterEventSender } from './stripe-http-client';

/**
 * Build the configured billing meter for this process.
 *
 *   OPERARI_BILLING_PROVIDER=noop    (default — self-host)
 *   OPERARI_BILLING_PROVIDER=stripe  (cloud, requires STRIPE_SECRET_KEY)
 *
 * Default is noop so existing self-host deployments need ZERO config
 * changes. Stripe is opt-in and falls back to noop if its dependencies
 * are not satisfied (no secret key) — failing closed protects against
 * accidentally double-billing customers if a deploy ships with a
 * half-configured env.
 */
export function buildBillingMeter(): BillingMeter {
  const provider = (process.env.OPERARI_BILLING_PROVIDER ?? 'noop').toLowerCase();
  switch (provider) {
    case 'stripe': {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        // Loud refusal — operator forgot to set STRIPE_SECRET_KEY.
        // Returning a meter whose inner sender no-ops protects
        // against accidentally double-billing if someone half-
        // configured the env in a deploy.
        return new StripeBillingMeter({
          sendMeterEvent: async () => undefined,
        });
      }
      return new StripeBillingMeter({
        sendMeterEvent: buildStripeMeterEventSender({ secretKey }),
      });
    }
    case 'noop':
    default:
      return new NoopBillingMeter();
  }
}

let meterSingleton: BillingMeter | null = null;

export function getBillingMeter(): BillingMeter {
  if (!meterSingleton) {
    meterSingleton = buildBillingMeter();
  }
  return meterSingleton;
}

export function setBillingMeterForTest(meter: BillingMeter): void {
  meterSingleton = meter;
}

export function resetBillingMeterForTest(): void {
  meterSingleton = null;
}

/**
 * Swap the process-wide meter to a QueuedBillingMeter that writes to
 * the BillingEvent outbox, and hand back the worker that ships the
 * outbox to Stripe. Call once at boot when Stripe is configured —
 * the runtime's `getBillingMeter()` callers transparently start
 * enqueueing instead of calling Stripe inline.
 *
 * Returns the worker so server.ts can start an interval that polls
 * it; the worker owns the backing StripeBillingMeter and no other
 * code should hold a reference to it (otherwise a direct-call path
 * would bypass the durability guarantee).
 *
 * Safe to call multiple times — subsequent calls replace the
 * singleton; the previous meter just becomes unreachable.
 */
export function installQueuedBillingMeter(prisma: PrismaClient): BillingDispatchWorker {
  const backing = buildBillingMeter();
  const queued = new QueuedBillingMeter({ prisma });
  meterSingleton = queued;
  return new BillingDispatchWorker({ prisma, meter: backing });
}
