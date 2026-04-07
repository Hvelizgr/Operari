import type { BillableEvent, BillingMeter } from './billing-meter.types';

/**
 * NoopBillingMeter — default for self-host deployments.
 *
 * Self-host operators are not billing anyone, so the runtime calls
 * meter.record(...) unconditionally and this implementation discards
 * the event. No env vars to set, no branching at call sites, no
 * silent fallback if Stripe is misconfigured.
 *
 * Tests can spy on the underlying record() to confirm the runtime
 * called it with the right shape, even when the provider is no-op.
 */
export class NoopBillingMeter implements BillingMeter {
    readonly name = 'noop';

    async record(_event: BillableEvent): Promise<boolean> {
        return false;
    }
}
