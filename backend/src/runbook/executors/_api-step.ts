import { guardedFetch } from '../../security/ssrf-guard';
import { ExecutorContext, ExecutorResult, StepExecutor } from '../types/executor.types';

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as application/x-www-form-urlencoded (Twilio, Trello). */
  form?: Record<string, string>;
  /** Sent verbatim with `contentType` (ntfy takes plain text). */
  rawBody?: string;
  contentType?: string;
  /**
   * What the step does, for logs. Used instead of the URL because some
   * APIs (Telegram) carry the token in the path.
   */
  describe: string;
  timeoutMs?: number;
}

export interface ApiResponseHandling {
  /** Fields worth passing downstream. Defaults to `{ status, body }`. */
  shape?: (body: unknown, status: number) => Record<string, unknown>;
  /**
   * Some APIs answer 200 with an error in the body (Slack `ok: false`,
   * GraphQL `errors`, Cloudflare `success: false`). Return a message to
   * fail the step.
   */
  bodyError?: (body: unknown) => string | null;
}

/**
 * One authenticated HTTP call to a vendor API, with the dry-run, timeout,
 * error shaping and log lines every integration shares.
 */
export async function sendApiRequest(
  type: string,
  req: ApiRequest,
  context: ExecutorContext,
  httpFetch: typeof fetch,
  handling: ApiResponseHandling = {}
): Promise<ExecutorResult> {
  const startTime = Date.now();
  context.emit?.({ type: 'log', text: req.describe, timestamp: new Date() });

  if (context.dryRun) {
    context.emit?.({
      type: 'log',
      text: `[dry-run] would ${req.describe}`,
      timestamp: new Date(),
    });
    return {
      success: true,
      output: { dryRun: true, action: req.describe },
      duration: Date.now() - startTime,
    };
  }

  let body: string | undefined;
  let contentType: string | undefined;
  if (req.form) {
    body = new URLSearchParams(req.form).toString();
    contentType = 'application/x-www-form-urlencoded';
  } else if (req.rawBody !== undefined) {
    body = req.rawBody;
    contentType = req.contentType ?? 'text/plain';
  } else if (req.body !== undefined) {
    body = JSON.stringify(req.body);
    contentType = req.contentType ?? 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 30_000);
  try {
    const res = await guardedFetch(httpFetch, req.url, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        ...(contentType ? { 'Content-Type': contentType } : {}),
        ...req.headers,
      },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Some endpoints (Teams workflows) answer with plain text.
    }

    if (!res.ok) {
      return {
        success: false,
        error: `${type}: HTTP ${res.status} ${res.statusText} — ${text.slice(0, 300)}`,
        output: { status: res.status, body: parsed },
        duration: Date.now() - startTime,
      };
    }
    const bodyError = handling.bodyError?.(parsed);
    if (bodyError) {
      return {
        success: false,
        error: `${type}: ${bodyError}`,
        output: { status: res.status, body: parsed },
        duration: Date.now() - startTime,
      };
    }

    context.emit?.({ type: 'log', text: `${type}: HTTP ${res.status}`, timestamp: new Date() });
    return {
      success: true,
      output: handling.shape
        ? handling.shape(parsed, res.status)
        : { status: res.status, body: parsed },
      duration: Date.now() - startTime,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `timed out after ${req.timeoutMs ?? 30_000}ms`
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      success: false,
      error: `${type}: ${message}`,
      duration: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Base for integration steps that are one authenticated HTTP call to a
 * vendor API. Subclasses only translate their config into a request and
 * pick the fields worth passing downstream.
 */
export abstract class ApiStepExecutor<TConfig> implements StepExecutor<TConfig> {
  abstract readonly type: string;

  constructor(protected readonly httpFetch: typeof fetch = fetch) {}

  /** Returns the request, or an error message when the config is unusable. */
  protected abstract build(config: TConfig, context: ExecutorContext): ApiRequest | string;

  protected shapeOutput(body: unknown, status: number): Record<string, unknown> {
    return { status, body };
  }

  async execute(config: TConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const req = this.build(config ?? ({} as TConfig), context);
    if (typeof req === 'string') {
      return { success: false, error: req, duration: Date.now() - startTime };
    }
    return sendApiRequest(this.type, req, context, this.httpFetch, {
      shape: (body, status) => this.shapeOutput(body, status),
    });
  }
}

export function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}
