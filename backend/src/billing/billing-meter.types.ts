/**
 * Pluggable billing meter for usage-based pricing.
 *
 * IMPLEMENTACION P1 #12: NanoRun's pricing model is "$X/seat/mo +
 * $Y/1000 runs" so the runtime needs to record billable events
 * (a run started, a runner minute consumed, …) without coupling to
 * a specific billing provider. The doc says: Stripe Billing Meters
 * for v1, migrate to Orb in Series A. Both expose a "send a meter
 * event with a customer id and a value" surface; this interface
 * captures that surface so the swap is one file.
 *
 * Self-host deployments don't bill anyone — the default
 * NoopBillingMeter satisfies the interface, records nothing, and
 * lets the runtime call meter.record() unconditionally without
 * branching on env vars at every call site.
 *
 * Cloud SaaS deployments wire StripeBillingMeter (or its successor)
 * via the singleton in backend/src/billing/index.ts.
 *
 * Contract notes
 * - record() is fire-and-forget. The caller MUST NOT await it on
 *   the request hot path; billing latency cannot leak into runbook
 *   execution time. The caller MUST NOT branch on the return value;
 *   meter writes are best-effort and the audit chain is the
 *   compliance backstop.
 * - Idempotency keys: every record() takes an optional idempotencyKey
 *   so retries don't double-bill. Stripe's meter events accept this
 *   directly; Orb does too. The runtime should use a stable id like
 *   `${eventType}:${runId}:${stepId}` so retries collapse.
 * - Customer resolution: meterEvent.customerId is the BILLING-side
 *   customer id (Stripe customer cus_xxx, Orb customer cust_xxx),
 *   NOT the NanoRun tenant id. The mapping lives in
 *   `Tenant.stripeCustomerId` (added when the cloud beta migration
 *   lands). Until then, every meter call no-ops on missing mapping.
 */

export type BillableEventType =
  | 'run.started'
  | 'run.completed'
  | 'runner.minute'
  | 'storage.gb_hour';

export interface BillableEvent {
  /** Stable identifier of the billable thing being measured */
  type: BillableEventType;
  /**
   * Billing-side customer id (Stripe `cus_...`, Orb `cust_...`).
   * NOT the NanoRun tenant id; resolution happens at the call site
   * via `Tenant.stripeCustomerId`. Pass undefined to skip the
   * write — the meter no-ops rather than guessing.
   */
  customerId?: string;
  /**
   * Numeric value to add to the meter. For counter-style events
   * (run.started) this is 1; for duration-style events
   * (runner.minute) it's the number of minutes; for capacity events
   * (storage.gb_hour) it's the GB-hours consumed since last record.
   */
  value: number;
  /**
   * Idempotency key. Stripe rejects duplicate events with the same
   * key within a 24h window; the runtime uses
   * `${type}:${runId}:${stepId?}` so retries collapse.
   */
  idempotencyKey?: string;
  /**
   * Free-form metadata recorded alongside the meter event. Surfaces
   * in the billing provider dashboard for debugging "why was I
   * charged for this run".
   */
  metadata?: Record<string, string>;
}

export interface BillingMeter {
  /** Stable provider identifier: 'noop' | 'stripe' | 'orb' | … */
  readonly name: string;

  /**
   * Record a billable event. Fire-and-forget — implementations MUST
   * swallow errors and never throw on the request hot path.
   *
   * Returns true if the event was actually written to the billing
   * provider, false if it was no-op'd (missing customer id, missing
   * config, provider failure). Callers should NOT branch on this
   * return value; it exists for tests to assert.
   */
  record(event: BillableEvent): Promise<boolean>;
}
