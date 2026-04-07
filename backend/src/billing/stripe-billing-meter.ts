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
 *   - A pluggable `sendMeterEvent` function so production passes a
 *     real `fetch('https://api.stripe.com/v1/billing/meter_events')`
 *     and tests pass a fake
 *   - Idempotency key passthrough (Stripe deduplicates within 24h)
 *   - Best-effort error handling (returns false instead of throwing)
 *
 * What this commit does NOT ship
 *   - The actual fetch call. Production wiring will pass a function
 *     that hits Stripe's API with the secret key from
 *     `STRIPE_SECRET_KEY` and the right form encoding. Once the
 *     billing integration lands, that's a single file change.
 *   - Webhook handling for `customer.subscription.*` events from
 *     Stripe (the inverse direction — Stripe telling NanoRun a
 *     customer cancelled).
 *   - Meter aggregation. Stripe handles aggregation server-side;
 *     this client just sends raw events.
 *
 * Why a skeleton: the load-bearing decision is the contract shape
 * (BillableEvent, the meter name mapping, the idempotency strategy).
 * Shipping it now lets the runtime call meter.record() at the right
 * lifecycle points TODAY without touching Stripe credentials. When
 * the cloud beta lands, the HTTP layer drops in.
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
    'run.started': 'nanorun_runs',
    'run.completed': 'nanorun_runs_completed',
    'runner.minute': 'nanorun_runner_minutes',
    'storage.gb_hour': 'nanorun_storage_gb_hours',
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
