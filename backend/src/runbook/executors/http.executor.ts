import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
    resolveTemplate,
} from '../types/executor.types';

export interface HttpConfig {
    /** HTTP method. */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
    /** Request URL. Supports {{vars.x}} and {{secrets.y}} templates. */
    url: string;
    /** Request headers. Each value supports template substitution. */
    headers?: Record<string, string>;
    /** Request body (string). Supports template substitution. Ignored for GET/HEAD. */
    body?: string;
    /** Maximum time to wait for a response in milliseconds (default: 30000). */
    timeout?: number;
    /** Whether to follow redirects (default: true). */
    followRedirects?: boolean;
    /** Whether to treat non-2xx responses as failures (default: true). */
    failOnNon2xx?: boolean;
}

export interface HttpOutput {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    url: string;
    method: string;
}

/**
 * HTTP request executor.
 *
 * Calls an external API and returns the response. Template substitution
 * is applied to url, headers, and body so steps can reference variables,
 * previous outputs, and secrets.
 *
 * This replaces the legacy HttpNodeExecutor in editor/nodes/ — once
 * registered in the runbook registry, tryRunbookExecutor() picks it up
 * first and the legacy executor is no longer reached.
 */
export class HttpExecutor implements StepExecutor<HttpConfig> {
    readonly type = 'nanorun.httpRequest';

    /** Override-able for tests. Real path uses `globalThis.fetch`. */
    private readonly httpFetch: typeof fetch;

    constructor(httpFetch: typeof fetch = fetch) {
        this.httpFetch = httpFetch;
    }

    async execute(config: HttpConfig, context: ExecutorContext): Promise<ExecutorResult> {
        const startTime = Date.now();
        const timeoutMs = config.timeout ?? 30_000;
        const failOnNon2xx = config.failOnNon2xx ?? true;
        const method = config.method ?? 'GET';

        const url = resolveTemplate(config.url ?? '', context);
        if (!url) {
            return {
                success: false,
                error: 'url is required',
                duration: Date.now() - startTime,
            };
        }

        // Resolve templates in each header value.
        const headers: Record<string, string> = {};
        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                headers[key] = resolveTemplate(value, context);
            }
        }

        // Resolve body templates (only for methods that accept a body).
        const hasBody = !['GET', 'HEAD'].includes(method);
        const body = hasBody && config.body
            ? resolveTemplate(config.body, context)
            : undefined;

        // If sending JSON body and no Content-Type is set, default to application/json.
        if (body && !Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
            headers['Content-Type'] = 'application/json';
        }

        context.emit?.({
            type: 'log',
            text: `${method} ${url}`,
            timestamp: new Date(),
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await this.httpFetch(url, {
                method,
                headers,
                body,
                signal: controller.signal,
                redirect: config.followRedirects === false ? 'manual' : 'follow',
            });

            clearTimeout(timer);

            const responseBody = await response.text();

            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            const output: HttpOutput = {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseBody,
                url,
                method,
            };

            const success = failOnNon2xx ? response.ok : true;

            context.emit?.({
                type: 'log',
                text: `${response.status} ${response.statusText} (${Date.now() - startTime}ms)`,
                timestamp: new Date(),
            });

            return {
                success,
                output: output as unknown as Record<string, unknown>,
                error: success
                    ? undefined
                    : `HTTP ${response.status} ${response.statusText}`,
                duration: Date.now() - startTime,
            };
        } catch (err) {
            clearTimeout(timer);

            if (err instanceof Error && err.name === 'AbortError') {
                return {
                    success: false,
                    error: `HTTP request timed out after ${timeoutMs}ms`,
                    duration: Date.now() - startTime,
                };
            }

            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
                duration: Date.now() - startTime,
            };
        }
    }
}
