import type { SendMeterEventFn } from './stripe-billing-meter';

/**
 * Stripe billing/meter_events HTTP client.
 *
 * Wraps the single Stripe API endpoint NanoRun cares about for usage
 * billing — `POST /v1/billing/meter_events` — without pulling the
 * full Stripe Node SDK. The SDK is ~MB of code that we do not need
 * for one POST.
 *
 * Endpoint reference: https://docs.stripe.com/api/billing/meter-event
 *
 * Request shape (form-encoded, Stripe legacy convention):
 *   event_name=nanorun_runs
 *   payload[stripe_customer_id]=cus_xxx
 *   payload[value]=1
 *   identifier=run.started:run-1
 *
 * Authorization:
 *   Authorization: Bearer sk_live_...
 *
 * Behavior contract — same as the rest of the billing layer:
 *   - Best-effort. The function never throws on the request hot path.
 *   - 2xx → resolves
 *   - non-2xx or transport failure → throws so StripeBillingMeter's
 *     try/catch turns it into `false` and the runtime continues
 *   - The function does not retry. Stripe's idempotency keys + the
 *     verifier on the receiving side handle dedup; retry policy
 *     belongs in a higher layer (a future BillingRetryQueue, not
 *     here).
 */

export interface StripeHttpClientOptions {
  /** Stripe secret key (sk_live_... / sk_test_...) */
  secretKey: string;
  /** Override the API base URL. Defaults to api.stripe.com. Used by tests. */
  apiBase?: string;
  /** Inject a custom fetch — used by tests. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms. Defaults to 5000. */
  timeoutMs?: number;
}

const DEFAULT_API_BASE = 'https://api.stripe.com';
const DEFAULT_TIMEOUT_MS = 5000;

export function buildStripeMeterEventSender(options: StripeHttpClientOptions): SendMeterEventFn {
  const { secretKey } = options;
  const apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required to build the Stripe meter event sender');
  }

  return async function sendMeterEvent(input) {
    const body = new URLSearchParams();
    body.set('event_name', input.event_name);
    body.set('payload[stripe_customer_id]', input.customer_id);
    body.set('payload[value]', String(input.value));
    if (input.identifier) {
      body.set('identifier', input.identifier);
    }
    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        // Stripe accepts arbitrary metadata as `payload[<key>]=value`.
        // Sanitize keys: only [a-zA-Z0-9_] is allowed in form keys
        // by Stripe's parser. Reject anything else by skipping.
        if (!/^[A-Za-z0-9_]+$/.test(key)) continue;
        body.set(`payload[${key}]`, value);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${apiBase}/v1/billing/meter_events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Read the body for the log message but cap it so a misbehaving
      // proxy that streams MB of HTML does not blow up the log.
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 500);
      } catch {
        // ignored
      }
      throw new Error(`Stripe meter_events POST failed: ${res.status} ${res.statusText} ${detail}`);
    }
  };
}
