import type { BillingMeter } from './billing-meter.types';
import { NoopBillingMeter } from './noop-billing-meter';
import { StripeBillingMeter } from './stripe-billing-meter';
import { buildStripeMeterEventSender } from './stripe-http-client';

export type { BillableEvent, BillableEventType, BillingMeter } from './billing-meter.types';
export { NoopBillingMeter } from './noop-billing-meter';
export type { SendMeterEventFn, StripeBillingMeterOptions } from './stripe-billing-meter';
export { StripeBillingMeter } from './stripe-billing-meter';
export type { StripeHttpClientOptions } from './stripe-http-client';
export { buildStripeMeterEventSender } from './stripe-http-client';

/**
 * Build the configured billing meter for this process.
 *
 *   NANORUN_BILLING_PROVIDER=noop    (default — self-host)
 *   NANORUN_BILLING_PROVIDER=stripe  (cloud, requires STRIPE_SECRET_KEY)
 *
 * Default is noop so existing self-host deployments need ZERO config
 * changes. Stripe is opt-in and falls back to noop if its dependencies
 * are not satisfied (no secret key) — failing closed protects against
 * accidentally double-billing customers if a deploy ships with a
 * half-configured env.
 */
export function buildBillingMeter(): BillingMeter {
  const provider = (process.env.NANORUN_BILLING_PROVIDER ?? 'noop').toLowerCase();
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
