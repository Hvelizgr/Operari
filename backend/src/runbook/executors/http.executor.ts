import { type FileRef, type FileStore, FileStoreError, isFileRef } from '../../files/file-store';
import { guardedFetch } from '../../security/ssrf-guard';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  resolveValue,
  StepExecutor,
} from '../types/executor.types';

export interface HttpConfig {
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  /** Request URL. Supports {{vars.x}} and {{secrets.y}} templates. */
  url: string;
  /** Request headers. Each value supports template substitution. */
  headers?: Record<string, string> | string;
  /** Request body (string). Supports template substitution. Ignored for GET/HEAD. */
  body?: string;
  /** Maximum time to wait for a response in milliseconds (default: 30000). */
  timeout?: number;
  /** Whether to follow redirects (default: true). */
  followRedirects?: boolean;
  /** Whether to treat non-2xx responses as failures (default: true). */
  failOnNon2xx?: boolean;
  /** `file`: keep the response as a file passed to later steps instead of text. */
  responseFormat?: 'text' | 'file';
  /** Name for the saved response file; defaults to Content-Disposition or the URL. */
  fileName?: string;
  /**
   * `file`: send the file referenced by `bodyFile` as the raw body (Drive,
   * Dropbox and S3 uploads). `multipart`: send `multipart` as form-data,
   * where any value that resolves to a file becomes a file part.
   */
  bodyType?: 'text' | 'file' | 'multipart';
  /** Expression resolving to a file, e.g. {{steps.download.output.file}}. */
  bodyFile?: string;
  multipart?: Record<string, string> | string;
}

export interface HttpOutput {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  url: string;
  method: string;
  /** Set with responseFormat=file; pass it on as {{steps.<id>.output.file}}. */
  file?: FileRef;
}

function fileNameFrom(disposition: string | null, url: string): string {
  const m = disposition && /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  const last = new URL(url).pathname.split('/').filter(Boolean).pop();
  return last ? decodeURIComponent(last) : 'download';
}

/**
 * HTTP request executor.
 *
 * Calls an external API and returns the response. Template substitution
 * is applied to url, headers, and body so steps can reference variables,
 * previous outputs, and secrets.
 *
 * Owns `operari.httpRequest`; the core HttpNodeExecutor keeps only the
 * older `HTTP` type.
 */
export class HttpExecutor implements StepExecutor<HttpConfig> {
  readonly type = 'operari.httpRequest';

  /** Override-able for tests. Real path uses `globalThis.fetch`. */
  private readonly httpFetch: typeof fetch;

  constructor(
    httpFetch: typeof fetch = fetch,
    private readonly deps: { files?: FileStore } = {}
  ) {
    this.httpFetch = httpFetch;
  }

  private files(): FileStore {
    if (!this.deps.files) throw new FileStoreError('file storage is not available on this backend');
    return this.deps.files;
  }

  private async fileFrom(expression: string | undefined, context: ExecutorContext, field: string) {
    const ref = resolveValue(expression ?? '', context);
    if (!isFileRef(ref)) {
      throw new FileStoreError(`${field} must reference a file, e.g. {{steps.<id>.output.file}}`);
    }
    return this.files().read(context.tenantId, ref.id);
  }

  /** Body and the content type it implies, for the three body kinds. */
  private async buildBody(
    config: HttpConfig,
    context: ExecutorContext
  ): Promise<{ body?: BodyInit; contentType?: string; describe?: string }> {
    if (config.bodyType === 'file') {
      const { ref, data } = await this.fileFrom(config.bodyFile, context, 'bodyFile');
      return {
        body: new Uint8Array(data),
        contentType: ref.mimeType,
        describe: `file ${ref.name} (${ref.size} bytes)`,
      };
    }
    if (config.bodyType === 'multipart') {
      let fields: unknown = config.multipart ?? {};
      if (typeof fields === 'string') {
        try {
          fields = fields.trim() ? JSON.parse(fields) : {};
        } catch (err) {
          throw new FileStoreError(`multipart is not valid JSON: ${(err as Error).message}`);
        }
      }
      const form = new FormData();
      const parts: string[] = [];
      for (const [name, raw] of Object.entries((fields ?? {}) as Record<string, unknown>)) {
        const value = resolveValue(raw, context);
        if (isFileRef(value)) {
          const { ref, data } = await this.files().read(context.tenantId, value.id);
          form.append(name, new Blob([new Uint8Array(data)], { type: ref.mimeType }), ref.name);
          parts.push(`${name}=@${ref.name}`);
        } else {
          form.append(name, typeof value === 'string' ? value : JSON.stringify(value ?? ''));
          parts.push(name);
        }
      }
      // fetch sets the multipart boundary itself; no content type here.
      return { body: form, describe: `multipart ${parts.join(', ')}` };
    }
    const text = config.body ? resolveTemplate(config.body, context) : undefined;
    return {
      body: text,
      contentType: text ? 'application/json' : undefined,
      describe: text?.slice(0, 500),
    };
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
    let rawHeaders: unknown = config.headers;
    if (typeof rawHeaders === 'string') {
      // The editor form stores headers as JSON text.
      try {
        rawHeaders = rawHeaders.trim() ? JSON.parse(rawHeaders) : {};
      } catch (err) {
        return {
          success: false,
          error: `headers is not valid JSON: ${(err as Error).message}`,
          duration: Date.now() - startTime,
        };
      }
    }
    if (rawHeaders && typeof rawHeaders === 'object') {
      for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
        headers[key] = resolveTemplate(String(value), context);
      }
    }

    const hasBody = !['GET', 'HEAD'].includes(method);
    let body: BodyInit | undefined;
    let bodyDescription: string | undefined;
    if (hasBody) {
      try {
        const built = await this.buildBody(config, context);
        body = built.body;
        bodyDescription = built.describe;
        if (
          built.contentType &&
          !Object.keys(headers).some(k => k.toLowerCase() === 'content-type')
        ) {
          headers['Content-Type'] = built.contentType;
        }
      } catch (err) {
        return { success: false, error: (err as Error).message, duration: Date.now() - startTime };
      }
    }

    context.emit?.({
      type: 'log',
      text: `${method} ${url}`,
      timestamp: new Date(),
    });

    // Dry-run: print the outgoing request shape so an operator can
    // spot a malformed URL or accidental production endpoint before
    // any packet leaves the host. Headers that look sensitive
    // (authorization / cookie / x-*-token / api-key) are redacted
    // in the log line so dry-run output is safe to share.
    if (context.dryRun) {
      const redactedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        const lower = k.toLowerCase();
        redactedHeaders[k] =
          lower === 'authorization' ||
          lower === 'cookie' ||
          lower.includes('token') ||
          lower.includes('api-key') ||
          lower.includes('apikey')
            ? '[redacted]'
            : v;
      }
      context.emit?.({
        type: 'log',
        text: `[dry-run] would ${method} ${url} headers=${JSON.stringify(redactedHeaders)}${bodyDescription ? ` body=${bodyDescription}` : ''}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          method,
          url,
          status: 0,
          statusText: 'dry-run',
          headers: {},
          body: '',
        },
        duration: Date.now() - startTime,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await guardedFetch(this.httpFetch, url, {
        method,
        headers,
        body,
        signal: controller.signal,
        redirect: config.followRedirects === false ? 'manual' : 'follow',
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody = '';
      let file: FileRef | undefined;
      if (config.responseFormat === 'file' && response.ok) {
        const store = this.files();
        const declared = Number(response.headers.get('content-length') ?? 0);
        if (declared > store.maxBytes) {
          clearTimeout(timer);
          return {
            success: false,
            error: `response is ${declared} bytes, over the ${store.maxBytes} file limit`,
            duration: Date.now() - startTime,
          };
        }
        const data = Buffer.from(await response.arrayBuffer());
        clearTimeout(timer);
        file = await store.save({
          tenantId: context.tenantId,
          executionId: context.runId,
          name: config.fileName
            ? resolveTemplate(config.fileName, context)
            : fileNameFrom(response.headers.get('content-disposition'), url),
          mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
          data,
        });
      } else {
        responseBody = await response.text();
        clearTimeout(timer);
      }

      const output: HttpOutput = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        url,
        method,
        ...(file ? { file } : {}),
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
        error: success ? undefined : `HTTP ${response.status} ${response.statusText}`,
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
