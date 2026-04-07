import { buildStripeMeterEventSender } from '../../billing/stripe-http-client';

interface CapturedRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
}

function buildFetch(responses: Array<{ status: number; body?: string }>) {
    const calls: CapturedRequest[] = [];
    let i = 0;
    const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const headers: Record<string, string> = {};
        if (init?.headers) {
            // RequestInit headers can be an object literal in our usage
            for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
                headers[k] = v;
            }
        }
        calls.push({
            url,
            method: init?.method ?? 'GET',
            headers,
            body: (init?.body as string) ?? '',
        });
        const scripted = responses[Math.min(i, responses.length - 1)];
        i++;
        return new Response(scripted.body ?? '', { status: scripted.status });
    }) as unknown as typeof fetch;
    return { fn, calls };
}

describe('buildStripeMeterEventSender', () => {
    it('throws at construction time when secretKey is missing', () => {
        expect(() =>
            buildStripeMeterEventSender({ secretKey: '', fetchImpl: buildFetch([]).fn }),
        ).toThrow(/STRIPE_SECRET_KEY/);
    });

    it('POSTs to /v1/billing/meter_events with form encoding and Bearer auth', async () => {
        const { fn, calls } = buildFetch([{ status: 200, body: '{}' }]);
        const send = buildStripeMeterEventSender({
            secretKey: 'sk_test_xyz',
            apiBase: 'https://api.stripe.test',
            fetchImpl: fn,
        });

        await send({
            event_name: 'nanorun_runs',
            customer_id: 'cus_acme',
            value: 1,
            identifier: 'run.started:run-1',
        });

        expect(calls).toHaveLength(1);
        const call = calls[0];
        expect(call.url).toBe('https://api.stripe.test/v1/billing/meter_events');
        expect(call.method).toBe('POST');
        expect(call.headers['Authorization']).toBe('Bearer sk_test_xyz');
        expect(call.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

        const body = new URLSearchParams(call.body);
        expect(body.get('event_name')).toBe('nanorun_runs');
        expect(body.get('payload[stripe_customer_id]')).toBe('cus_acme');
        expect(body.get('payload[value]')).toBe('1');
        expect(body.get('identifier')).toBe('run.started:run-1');
    });

    it('omits the identifier field when not provided', async () => {
        const { fn, calls } = buildFetch([{ status: 200 }]);
        const send = buildStripeMeterEventSender({
            secretKey: 'sk_test_xyz',
            fetchImpl: fn,
        });

        await send({
            event_name: 'nanorun_runs',
            customer_id: 'cus_acme',
            value: 1,
        });

        const body = new URLSearchParams(calls[0].body);
        expect(body.has('identifier')).toBe(false);
    });

    it('serializes safe metadata keys as payload[<key>]', async () => {
        const { fn, calls } = buildFetch([{ status: 200 }]);
        const send = buildStripeMeterEventSender({
            secretKey: 'sk_test_xyz',
            fetchImpl: fn,
        });

        await send({
            event_name: 'nanorun_runs',
            customer_id: 'cus_acme',
            value: 1,
            metadata: { runId: 'run-1', tenant: 'acme' },
        });

        const body = new URLSearchParams(calls[0].body);
        expect(body.get('payload[runId]')).toBe('run-1');
        expect(body.get('payload[tenant]')).toBe('acme');
    });

    it('skips metadata keys with characters Stripe rejects', async () => {
        const { fn, calls } = buildFetch([{ status: 200 }]);
        const send = buildStripeMeterEventSender({
            secretKey: 'sk_test_xyz',
            fetchImpl: fn,
        });

        await send({
            event_name: 'nanorun_runs',
            customer_id: 'cus_acme',
            value: 1,
            metadata: {
                'good_key': 'kept',
                'bad-key': 'dropped',
                'bad key': 'dropped',
                'evil[key]': 'dropped',
            },
        });

        const body = new URLSearchParams(calls[0].body);
        expect(body.get('payload[good_key]')).toBe('kept');
        expect(body.has('payload[bad-key]')).toBe(false);
        expect(body.has('payload[bad key]')).toBe(false);
        expect(body.has('payload[evil[key]]')).toBe(false);
    });

    it('throws on a non-2xx response with status + body slice', async () => {
        const { fn } = buildFetch([
            { status: 400, body: '{"error":{"message":"Invalid event_name"}}' },
        ]);
        const send = buildStripeMeterEventSender({
            secretKey: 'sk_test_xyz',
            fetchImpl: fn,
        });

        await expect(
            send({
                event_name: 'nanorun_runs',
                customer_id: 'cus_acme',
                value: 1,
            }),
        ).rejects.toThrow(/400/);
    });

    it('throws on a transport-level fetch failure (caller turns it into false)', async () => {
        const failingFetch = (async () => {
            throw new Error('ENETUNREACH');
        }) as unknown as typeof fetch;

        const send = buildStripeMeterEventSender({
            secretKey: 'sk_test_xyz',
            fetchImpl: failingFetch,
        });

        await expect(
            send({
                event_name: 'nanorun_runs',
                customer_id: 'cus_acme',
                value: 1,
            }),
        ).rejects.toBeInstanceOf(Error);
    });
});
