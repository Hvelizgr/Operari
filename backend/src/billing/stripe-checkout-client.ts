/**
 * Thin HTTP clients for Stripe Checkout + Billing Portal.
 *
 * Same approach as stripe-http-client.ts (meter events): one function
 * per endpoint, form-encoded bodies, no SDK. The Stripe Node SDK is
 * ~2MB and we only need three endpoints, so pulling it in is pure
 * overhead.
 *
 * All functions are injection-friendly — `fetchImpl` override lets
 * tests assert URLs and bodies without network.
 *
 * Error contract:
 *   - 2xx → resolves with parsed JSON
 *   - non-2xx → throws StripeHttpError with status + body snippet
 *   - transport failure → throws with the underlying error message
 * Callers decide whether to swallow or propagate; the route layer
 * converts these into user-facing errors.
 */

const API_BASE = 'https://api.stripe.com';
const DEFAULT_TIMEOUT_MS = 5000;

export class StripeHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = 'StripeHttpError';
  }
}

export interface StripeCheckoutClientOptions {
  secretKey: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface CreateCheckoutSessionParams {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  /** Stripe customer id if this tenant already has one. */
  customerId?: string;
  /** Used to auto-create a customer on Stripe's side if none. */
  customerEmail?: string;
  /**
   * Arbitrary key/value bag persisted on the resulting
   * subscription. We use `tenantId` here so the webhook can resolve
   * the Operari tenant without a second lookup.
   */
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResponse {
  id: string;
  url: string;
}

async function stripePost<T>(
  options: StripeCheckoutClientOptions,
  path: string,
  form: URLSearchParams
): Promise<T> {
  const {
    secretKey,
    apiBase = API_BASE,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${apiBase}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new StripeHttpError(
        `Stripe ${path} returned ${res.status}`,
        res.status,
        text.slice(0, 500)
      );
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function createCheckoutSession(
  options: StripeCheckoutClientOptions,
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResponse> {
  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', params.priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', params.successUrl);
  form.set('cancel_url', params.cancelUrl);
  if (params.customerId) {
    form.set('customer', params.customerId);
  } else if (params.customerEmail) {
    form.set('customer_email', params.customerEmail);
  }
  // Propagate on the subscription row so the webhook handler can
  // map back to our tenant without a second API hit.
  form.set('subscription_data[metadata][operari_tenant]', params.metadata?.tenantId ?? '');
  for (const [k, v] of Object.entries(params.metadata ?? {})) {
    form.set(`metadata[${k}]`, v);
  }
  return stripePost<CheckoutSessionResponse>(options, '/v1/checkout/sessions', form);
}

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResponse {
  id: string;
  url: string;
}

export async function createPortalSession(
  options: StripeCheckoutClientOptions,
  params: CreatePortalSessionParams
): Promise<PortalSessionResponse> {
  const form = new URLSearchParams();
  form.set('customer', params.customerId);
  form.set('return_url', params.returnUrl);
  return stripePost<PortalSessionResponse>(options, '/v1/billing_portal/sessions', form);
}
