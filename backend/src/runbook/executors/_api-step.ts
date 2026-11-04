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

  try {
    const page = await requestPage(req, httpFetch);
    if (!page.ok) {
      return {
        success: false,
        error: `${type}: HTTP ${page.status} ${page.statusText} — ${page.text.slice(0, 300)}`,
        output: { status: page.status, body: page.body },
        duration: Date.now() - startTime,
      };
    }
    const bodyError = handling.bodyError?.(page.body);
    if (bodyError) {
      return {
        success: false,
        error: `${type}: ${bodyError}`,
        output: { status: page.status, body: page.body },
        duration: Date.now() - startTime,
      };
    }

    context.emit?.({ type: 'log', text: `${type}: HTTP ${page.status}`, timestamp: new Date() });
    return {
      success: true,
      output: handling.shape
        ? handling.shape(page.body, page.status)
        : { status: page.status, body: page.body },
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      error: `${type}: ${requestErrorMessage(err, req)}`,
      duration: Date.now() - startTime,
    };
  }
}

export interface ApiPage {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
  body: unknown;
  headers: Headers;
}

function requestErrorMessage(err: unknown, req: ApiRequest): string {
  return err instanceof Error && err.name === 'AbortError'
    ? `timed out after ${req.timeoutMs ?? 30_000}ms`
    : err instanceof Error
      ? err.message
      : String(err);
}

/** One HTTP call through the SSRF guard, parsed as JSON when it is JSON. */
export async function requestPage(req: ApiRequest, httpFetch: typeof fetch): Promise<ApiPage> {
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
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      text,
      body: parsed,
      headers: res.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface PaginationPlan {
  /** Items of one page, or null when the page has no list where expected. */
  items(body: unknown): unknown[] | null;
  /** The request for the following page, or null when this was the last one. */
  next(prev: ApiRequest, page: ApiPage, items: unknown[]): ApiRequest | null;
  maxItems: number;
}

const MAX_PAGES = 200;

/**
 * "Return all": follows the provider's pagination until the last page,
 * `maxItems` or MAX_PAGES, and returns the items flattened into one list.
 */
export async function sendPaginated(
  type: string,
  first: ApiRequest,
  plan: PaginationPlan,
  context: ExecutorContext,
  httpFetch: typeof fetch,
  handling: ApiResponseHandling = {}
): Promise<ExecutorResult> {
  const startTime = Date.now();
  context.emit?.({ type: 'log', text: `${first.describe} (all pages)`, timestamp: new Date() });
  if (context.dryRun) {
    context.emit?.({
      type: 'log',
      text: `[dry-run] would ${first.describe}, following every page`,
      timestamp: new Date(),
    });
    return {
      success: true,
      output: { dryRun: true, action: first.describe },
      duration: Date.now() - startTime,
    };
  }
  const all: unknown[] = [];
  let req: ApiRequest | null = first;
  let pages = 0;
  let status = 0;
  try {
    while (req && pages < MAX_PAGES && all.length < plan.maxItems) {
      const page = await requestPage(req, httpFetch);
      pages++;
      status = page.status;
      if (!page.ok) {
        return {
          success: false,
          error: `${type}: HTTP ${page.status} ${page.statusText} on page ${pages} — ${page.text.slice(0, 300)}`,
          output: { status: page.status, body: page.body, pages, items: all },
          duration: Date.now() - startTime,
        };
      }
      const bodyError = handling.bodyError?.(page.body);
      if (bodyError) {
        return {
          success: false,
          error: `${type}: ${bodyError} (page ${pages})`,
          output: { status: page.status, body: page.body, pages, items: all },
          duration: Date.now() - startTime,
        };
      }
      const items = plan.items(page.body);
      if (!items) {
        return {
          success: false,
          error: `${type}: page ${pages} has no item list where one was expected`,
          output: { status: page.status, body: page.body, pages, items: all },
          duration: Date.now() - startTime,
        };
      }
      all.push(...items);
      req = items.length ? plan.next(req, page, items) : null;
    }
  } catch (err) {
    return {
      success: false,
      error: `${type}: ${requestErrorMessage(err, req ?? first)} (page ${pages + 1})`,
      output: { pages, items: all },
      duration: Date.now() - startTime,
    };
  }
  const truncated = req !== null || all.length > plan.maxItems;
  const items = all.slice(0, plan.maxItems);
  context.emit?.({
    type: 'log',
    text: `${type}: ${items.length} items in ${pages} page${pages === 1 ? '' : 's'}${truncated ? ' (stopped at the limit)' : ''}`,
    timestamp: new Date(),
  });
  return {
    success: true,
    output: { status, data: { items, count: items.length, pages, truncated } },
    duration: Date.now() - startTime,
  };
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
