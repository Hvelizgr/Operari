import { HttpExecutor, type HttpConfig } from '../../../runbook/executors/http.executor';
import type { ExecutorContext, ExecutorEvent } from '../../../runbook/types/executor.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const execCtx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
    runId: 'run-1',
    stepId: 'step-1',
    tenantId: 'tenant-1',
    variables: { host: 'api.example.com', token: 'bearer-xyz' },
    previousOutputs: {},
    secrets: { 'api-key-1': 'sk-secret-123' },
    ...overrides,
});

const httpConfig = (overrides: Partial<HttpConfig> = {}): HttpConfig => ({
    method: 'GET',
    url: 'https://api.example.com/health',
    ...overrides,
});

function fakeFetch(
    status: number,
    body: string,
    headers: Record<string, string> = {},
): typeof fetch {
    return async (_url: any, _init: any) => {
        const h = new Headers(headers);
        return {
            ok: status >= 200 && status < 300,
            status,
            statusText: status === 200 ? 'OK' : 'Error',
            text: async () => body,
            headers: {
                forEach: (cb: (value: string, key: string) => void) => {
                    h.forEach(cb);
                },
            },
        } as unknown as Response;
    };
}

describe('HttpExecutor', () => {
    it('makes a GET request and returns the response', async () => {
        const executor = new HttpExecutor(
            fakeFetch(200, '{"status":"ok"}'),
        );

        const result = await executor.execute(httpConfig(), execCtx());

        expect(result.success).toBe(true);
        const output = result.output as any;
        expect(output.status).toBe(200);
        expect(output.body).toBe('{"status":"ok"}');
        expect(output.method).toBe('GET');
    });

    it('resolves templates in URL', async () => {
        let capturedUrl = '';
        const mockFetch: typeof fetch = async (url: any, _init: any) => {
            capturedUrl = url as string;
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => '',
                headers: { forEach: () => {} },
            } as unknown as Response;
        };

        const executor = new HttpExecutor(mockFetch);
        await executor.execute(
            httpConfig({ url: 'https://{{vars.host}}/check' }),
            execCtx(),
        );

        expect(capturedUrl).toBe('https://api.example.com/check');
    });

    it('resolves secrets in headers', async () => {
        let capturedHeaders: any = {};
        const mockFetch: typeof fetch = async (_url: any, init: any) => {
            capturedHeaders = init?.headers ?? {};
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => '',
                headers: { forEach: () => {} },
            } as unknown as Response;
        };

        const executor = new HttpExecutor(mockFetch);
        await executor.execute(
            httpConfig({
                headers: { 'Authorization': 'Bearer {{secrets.api-key-1}}' },
            }),
            execCtx(),
        );

        expect(capturedHeaders['Authorization']).toBe('Bearer sk-secret-123');
    });

    it('sends body for POST requests', async () => {
        let capturedBody = '';
        const mockFetch: typeof fetch = async (_url: any, init: any) => {
            capturedBody = init?.body ?? '';
            return {
                ok: true,
                status: 201,
                statusText: 'Created',
                text: async () => '{}',
                headers: { forEach: () => {} },
            } as unknown as Response;
        };

        const executor = new HttpExecutor(mockFetch);
        const result = await executor.execute(
            httpConfig({
                method: 'POST',
                url: 'https://api.example.com/items',
                body: '{"name":"{{vars.host}}"}',
            }),
            execCtx(),
        );

        expect(capturedBody).toBe('{"name":"api.example.com"}');
        expect(result.success).toBe(true);
    });

    it('does not send body for GET requests', async () => {
        let capturedBody: any = 'SHOULD_BE_UNDEFINED';
        const mockFetch: typeof fetch = async (_url: any, init: any) => {
            capturedBody = init?.body;
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => '',
                headers: { forEach: () => {} },
            } as unknown as Response;
        };

        const executor = new HttpExecutor(mockFetch);
        await executor.execute(
            httpConfig({ body: 'should be ignored' }),
            execCtx(),
        );

        expect(capturedBody).toBeUndefined();
    });

    it('fails on non-2xx when failOnNon2xx is true (default)', async () => {
        const executor = new HttpExecutor(
            fakeFetch(404, 'not found'),
        );

        const result = await executor.execute(httpConfig(), execCtx());

        expect(result.success).toBe(false);
        expect(result.error).toContain('404');
    });

    it('succeeds on non-2xx when failOnNon2xx is false', async () => {
        const executor = new HttpExecutor(
            fakeFetch(500, 'server error'),
        );

        const result = await executor.execute(
            httpConfig({ failOnNon2xx: false }),
            execCtx(),
        );

        expect(result.success).toBe(true);
        const output = result.output as any;
        expect(output.status).toBe(500);
    });

    it('fails when url is empty', async () => {
        const executor = new HttpExecutor(
            fakeFetch(200, ''),
        );

        const result = await executor.execute(
            httpConfig({ url: '' }),
            execCtx(),
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('url is required');
    });

    it('handles fetch errors', async () => {
        const errorFetch: typeof fetch = async () => {
            throw new Error('Network error');
        };

        const executor = new HttpExecutor(errorFetch);
        const result = await executor.execute(httpConfig(), execCtx());

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
    });

    it('emits log events', async () => {
        const executor = new HttpExecutor(
            fakeFetch(200, ''),
        );

        const events: ExecutorEvent[] = [];
        const ctx = execCtx({ emit: (e) => events.push(e) });

        await executor.execute(httpConfig(), ctx);

        const logEvents = events.filter(e => e.type === 'log');
        expect(logEvents.length).toBe(2);
        expect(logEvents[0].text).toContain('GET');
        expect(logEvents[1].text).toContain('200');
    });
});
