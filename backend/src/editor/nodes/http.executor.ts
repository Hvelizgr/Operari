import { ErrorCode, HttpError } from '../../errors/custom-error';
import type { ExecutionInput, HttpNodeConfig, HttpResult } from '../../types/runbook.types';
import { withHttpRetry } from '../../utils/retry';
import type { EditorNodeExecutor, NodeErrorContext, NodeExecutorDeps } from './_shared';
import { resolveTemplate } from './_shared';

/**
 * HTTP node — `fetch` the configured URL with retries.
 *
 * Behavior preserved exactly from the legacy `executeHttp` method:
 *   - Resolves {{templates}} in url and body
 *   - Sets Content-Type: application/json by default, headers override
 *   - withHttpRetry handles retry-on-failure with maxRetries = retries-1
 *   - Non-OK responses become HttpError with the original status code
 *   - JSON-parses the body, falling back to text on parse failure
 *
 * Uses the global `fetch` rather than axios so the existing test suite
 * (which mocks `global.fetch`) keeps working without changes.
 */
export class HttpNodeExecutor implements EditorNodeExecutor<HttpNodeConfig, HttpResult> {
  readonly type = 'HTTP';
  readonly aliases = ['Api', 'operari.httpRequest'] as const;

  constructor(private readonly deps: Pick<NodeExecutorDeps, 'logger'>) {}

  async execute(
    config: HttpNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext
  ): Promise<HttpResult> {
    const { url, method = 'GET', headers = {}, body, retries = 3 } = config;

    const resolvedUrl = resolveTemplate(url || '', input);
    const resolvedBody = body ? resolveTemplate(JSON.stringify(body), input) : undefined;

    try {
      const result = await withHttpRetry(
        async () => {
          const response = await fetch(resolvedUrl, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: resolvedBody,
          });

          if (!response.ok) {
            throw new HttpError({
              ...errorContext,
              message: `HTTP ${response.status} ${response.statusText}`,
              code: HttpNodeExecutor.statusToErrorCode(response.status),
              upstreamStatus: response.status,
              url: resolvedUrl,
            });
          }

          const data = await response.json().catch(() => response.text());

          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data,
          };
        },
        `HTTP ${method} ${resolvedUrl}`,
        { maxRetries: retries - 1 }
      );

      return result;
    } catch (error) {
      const httpError =
        error instanceof HttpError
          ? error
          : new HttpError({
              message: error instanceof Error ? error.message : 'Unknown HTTP error',
              url: resolvedUrl,
              cause: error instanceof Error ? error : undefined,
            });

      this.deps.logger.error('HTTP request failed', {
        error: httpError,
        metadata: { url: resolvedUrl, method },
      });

      throw httpError;
    }
  }

  /**
   * Map a non-OK HTTP status to an internal ErrorCode. The classification
   * is intentionally coarse — the test suite asserts on the resulting
   * code so changing this would break tests, and a finer taxonomy
   * belongs in the error layer not in the executor.
   */
  static statusToErrorCode(statusCode: number): ErrorCode {
    if (statusCode === 408 || statusCode === 504) {
      return ErrorCode.HTTP_TIMEOUT;
    }
    return ErrorCode.HTTP_REQUEST_FAILED;
  }
}
