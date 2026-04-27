import type { BillableEvent, BillingMeter } from './billing-meter.types';

/**
 * StripeBillingMeter — adapter for Stripe Billing Meters.
 *
 * What this commit ships
 *   - The interface adherence so cloud routes can call meter.record()
 *     without caring about Stripe specifics
 *   - Event-type → Stripe-meter-name mapping (the runtime uses
 *     stable internal names like "run.started"; Stripe wants meter
 *     names registered ahead of time in the dashboard)
 *   - Idempotency key passthrough (Stripe deduplicates within 24h)
 *   - Best-effort error handling (returns false instead of throwing
 *     so the request hot path never blocks on a Stripe outage)
 *
 * Pluggable HTTP layer: the constructor takes a `sendMeterEvent`
 * function so the actual fetch call can be swapped. The production
 * wiring is `buildStripeMeterEventSender({ secretKey })` from
 * `stripe-http-client.ts` — POST `/v1/billing/meter_events` with
 * form encoding and Bearer auth, no SDK dependency. Tests inject
 * fakes.
 *
 * What this DOES NOT cover (out of scope for this file)
 *   - Webhook handling for `customer.subscription.*` events from
 *     Stripe (the inverse direction — Stripe telling Operari a
 *     customer cancelled). Lives in a future webhooks/stripe.routes.ts.
 *   - Meter aggregation. Stripe handles that server-side.
 */

export type SendMeterEventFn = (input: {
  /** Stripe-side meter event name (registered in the dashboard) */
  event_name: string;
  /** Stripe customer id (cus_xxx) */
  customer_id: string;
  /** Numeric value */
  value: number;
  /** Idempotency key (optional) */
  identifier?: string;
  /** Free-form metadata (Stripe stores it alongside the event) */
  metadata?: Record<string, string>;
}) => Promise<void>;

export interface StripeBillingMeterOptions {
  sendMeterEvent: SendMeterEventFn;
  /**
   * Override the default mapping from internal event type to Stripe
   * meter name. Useful for tenants with custom dashboards.
   */
  meterNameMap?: Partial<Record<string, string>>;
}

const DEFAULT_METER_NAMES: Record<string, string> = {
  'run.started': 'operari_runs',
  'run.completed': 'operari_runs_completed',
  'runner.minute': 'operari_runner_minutes',
  'storage.gb_hour': 'operari_storage_gb_hours',
};

export class StripeBillingMeter implements BillingMeter {
  readonly name = 'stripe';

  private readonly sendMeterEvent: SendMeterEventFn;
  private readonly meterNameMap: Record<string, string>;

  constructor(options: StripeBillingMeterOptions) {
    this.sendMeterEvent = options.sendMeterEvent;
    // Filter out undefined overrides so the resulting map satisfies
    // Record<string, string>. A test or operator that passes
    // `{ 'run.started': undefined }` to clear a default has to do
    // it explicitly via the empty string instead.
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(options.meterNameMap ?? {})) {
      if (typeof value === 'string') overrides[key] = value;
    }
    this.meterNameMap = { ...DEFAULT_METER_NAMES, ...overrides };
  }

  async record(event: BillableEvent): Promise<boolean> {
    // No customer id → no-op. The runtime SHOULD always pass one
    // when billing is enabled, but a missing mapping is a
    // configuration bug (Tenant.stripeCustomerId not set), not a
    // reason to throw.
    if (!event.customerId) return false;

    const eventName = this.meterNameMap[event.type];
    if (!eventName) {
      // Unknown event type — also a configuration bug. Refuse
      // silently rather than send an event Stripe will reject.
      return false;
    }

    try {
      await this.sendMeterEvent({
        event_name: eventName,
        customer_id: event.customerId,
        value: event.value,
        identifier: event.idempotencyKey,
        metadata: event.metadata,
      });
      return true;
    } catch {
      // Best-effort: never throw on the request hot path.
      return false;
    }
  }
}
