import {
    createCheckoutSession,
    createPortalSession,
    StripeHttpError,
} from '../../billing/stripe-checkout-client';

/**
 * We do not want any of these paths touching api.stripe.com. A
 * fetch stub captures every call so assertions can be made on URL,
 * method, headers and form body.
 */

function stubFetch(response: { ok: boolean; status: number; body: unknown }) {
    const mock = jest.fn(async () => ({
        ok: response.ok,
        status: response.status,
        text: async () => JSON.stringify(response.body),
    }));
    return mock as unknown as typeof fetch;
}

describe('createCheckoutSession', () => {
    const options = { secretKey: 'sk_test_xyz' };

    it('POSTs to /v1/checkout/sessions with form-encoded body', async () => {
        const fetchImpl = stubFetch({
            ok: true,
            status: 200,
            body: { id: 'cs_123', url: 'https://checkout.stripe.com/session' },
        });
        const mock = fetchImpl as unknown as jest.Mock;

        const session = await createCheckoutSession(
            { ...options, fetchImpl },
            {
                priceId: 'price_team_monthly',
                successUrl: 'https://app/ok',
                cancelUrl: 'https://app/cancel',
                customerEmail: 'sre@acme.io',
                metadata: { tenantId: 'tenant-1', plan: 'TEAM' },
            },
        );

        expect(session.url).toBe('https://checkout.stripe.com/session');
        expect(mock).toHaveBeenCalledTimes(1);
        const [url, init] = mock.mock.calls[0];
        expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
        const reqInit = init as RequestInit;
        const headers = reqInit.headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer sk_test_xyz');
        expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        const form = new URLSearchParams(reqInit.body as string);
        expect(form.get('mode')).toBe('subscription');
        expect(form.get('line_items[0][price]')).toBe('price_team_monthly');
        expect(form.get('customer_email')).toBe('sre@acme.io');
        expect(form.get('subscription_data[metadata][nanorun_tenant]')).toBe('tenant-1');
        expect(form.get('metadata[plan]')).toBe('TEAM');
    });

    it('prefers customerId over customerEmail when both available', async () => {
        const fetchImpl = stubFetch({
            ok: true,
            status: 200,
            body: { id: 'cs', url: 'https://checkout' },
        });
        const mock = fetchImpl as unknown as jest.Mock;
        await createCheckoutSession(
            { ...options, fetchImpl },
            {
                priceId: 'p1',
                successUrl: 'https://s',
                cancelUrl: 'https://c',
                customerId: 'cus_123',
                customerEmail: 'sre@acme.io',
            },
        );
        const form = new URLSearchParams((mock.mock.calls[0][1] as RequestInit).body as string);
        expect(form.get('customer')).toBe('cus_123');
        expect(form.get('customer_email')).toBeNull();
    });

    it('throws StripeHttpError on non-2xx', async () => {
        const fetchImpl = stubFetch({
            ok: false,
            status: 402,
            body: { error: { message: 'card declined' } },
        });
        await expect(
            createCheckoutSession(
                { ...options, fetchImpl },
                { priceId: 'p', successUrl: 'https://s', cancelUrl: 'https://c' },
            ),
        ).rejects.toBeInstanceOf(StripeHttpError);
    });
});

describe('createPortalSession', () => {
    it('POSTs to /v1/billing_portal/sessions', async () => {
        const fetchImpl = stubFetch({
            ok: true,
            status: 200,
            body: { id: 'ps_1', url: 'https://billing.stripe.com/session' },
        });
        const mock = fetchImpl as unknown as jest.Mock;
        const session = await createPortalSession(
            { secretKey: 'sk_test', fetchImpl },
            { customerId: 'cus_123', returnUrl: 'https://app/settings' },
        );
        expect(session.url).toBe('https://billing.stripe.com/session');
        const url = mock.mock.calls[0][0];
        expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
        const form = new URLSearchParams((mock.mock.calls[0][1] as RequestInit).body as string);
        expect(form.get('customer')).toBe('cus_123');
        expect(form.get('return_url')).toBe('https://app/settings');
    });
});
