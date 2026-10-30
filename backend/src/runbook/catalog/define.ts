import { type ApiRequest, type ApiResponseHandling, sendApiRequest } from '../executors/_api-step';
import {
  type ExecutorContext,
  type ExecutorResult,
  resolveTemplate,
  resolveValue,
  type StepExecutor,
} from '../types/executor.types';

/**
 * One field of a step's form. Same shape the editor's DynamicNodeForm
 * renders, plus `required` and `displayOptions`, which the editor and the
 * executor both honour — and which map one-to-one onto a JSON Schema when
 * these steps are exposed as tools.
 */
export interface CatalogProperty {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'secret';
  default?: unknown;
  description?: string;
  required?: boolean;
  options?: Array<{ name: string; value: string }>;
  /** `provider` narrows a secret picker to credentials of that kind (`ai` matches `ai.*`). */
  typeOptions?: { rows?: number; expression?: boolean; provider?: string };
  /** Show (and require) the field only when other fields hold one of these values. */
  displayOptions?: { show: Record<string, string[]> };
}

interface Port {
  name: string;
  type: 'main';
}

export interface CatalogNodeMeta {
  type: string;
  category: string;
  icon: string;
  color: string;
  label: { en: string; es: string };
  description: { en: string; es: string };
  properties: CatalogProperty[];
  inputs?: Port[];
  outputs?: Port[];
}

export type Config = Record<string, unknown>;

/** Helpers handed to each step so definitions stay one-liners. */
export interface StepTools {
  /** Field rendered as text with `{{...}}` templates resolved. */
  str(name: string): string;
  /** Field resolved keeping its type when it is exactly one `{{path}}`. */
  value(name: string): unknown;
  num(name: string): number;
  bool(name: string): boolean;
  /** Field parsed as JSON (objects/arrays pass through); `fallback` when empty. */
  json<T = unknown>(name: string, fallback: T): T;
  /** Field resolved to an array: a `{{path}}` to one, JSON text, or comma-separated text. */
  list(name: string): unknown[];
  config: Config;
  context: ExecutorContext;
  fetch: typeof fetch;
  /**
   * The connected account a `{{secrets.<id>}}` field points at: its
   * provider, non-secret metadata and the resolved secret. Only within
   * the run's tenant.
   */
  credential(name: string): Promise<CredentialInfo>;
  /** The registry's `shell` step, so steps that run CLIs inherit its runner and gates. */
  shell?: StepExecutor<{
    command: string;
    timeout?: number;
    env?: Record<string, string>;
    image?: string;
  }>;
}

export interface CredentialInfo {
  id: string;
  provider: string;
  metadata: Record<string, unknown>;
  secret: string;
}

/** What a catalog step may need beyond its config; injected by the registry. */
export interface CatalogDeps {
  shell?: StepTools['shell'];
  findAccount?(
    id: string,
    tenantId: string
  ): Promise<{ provider: string; metadata: unknown } | null>;
}

export interface CatalogNode extends CatalogNodeMeta {
  run(tools: StepTools): Promise<ExecutorResult> | ExecutorResult;
}

export function isVisible(prop: CatalogProperty, config: Config): boolean {
  const show = prop.displayOptions?.show;
  if (!show) return true;
  return Object.entries(show).every(([field, values]) =>
    values.includes(String(config[field] ?? ''))
  );
}

export class StepInputError extends Error {}

/**
 * Executor for a catalog node: fills in form defaults (the editor only
 * saves fields a user touched), rejects missing required fields, then
 * runs the step.
 */
export class CatalogExecutor implements StepExecutor<Config> {
  readonly type: string;

  constructor(
    readonly node: CatalogNode,
    private readonly httpFetch: typeof fetch = fetch,
    private readonly deps: CatalogDeps = {}
  ) {
    this.type = node.type;
  }

  async execute(rawConfig: Config, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const config: Config = { ...(rawConfig ?? {}) };
    for (const prop of this.node.properties) {
      if (config[prop.name] === undefined && prop.default !== undefined) {
        config[prop.name] = prop.default;
      }
    }
    for (const prop of this.node.properties) {
      if (!prop.required || !isVisible(prop, config)) continue;
      const v = config[prop.name];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        return fail(`${prop.displayName} is required`, startTime);
      }
    }
    try {
      return await this.node.run(makeTools(config, context, this.httpFetch, this.deps));
    } catch (err) {
      // A bad regex, JSONPath or payload is a step failure, not a crash.
      return fail(`${this.type}: ${err instanceof Error ? err.message : String(err)}`, startTime);
    }
  }
}

const SECRET_REF = /^\s*\{\{\s*secrets\.([A-Za-z0-9_-]+)\s*\}\}\s*$/;

function makeTools(
  config: Config,
  context: ExecutorContext,
  httpFetch: typeof fetch,
  deps: CatalogDeps
): StepTools {
  const str = (name: string) => {
    const v = config[name];
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? resolveTemplate(v, context).trim() : String(v);
  };
  const value = (name: string) => resolveValue(config[name], context);
  const json = <T>(name: string, fallback: T): T => {
    const v = value(name);
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v !== 'string') return v as T;
    try {
      return JSON.parse(v) as T;
    } catch (err) {
      throw new StepInputError(`${name} is not valid JSON: ${(err as Error).message}`);
    }
  };
  return {
    str,
    value,
    num: name => {
      const n = Number(value(name));
      if (Number.isNaN(n)) throw new StepInputError(`${name} must be a number`);
      return n;
    },
    bool: name => {
      const v = value(name);
      return v === true || v === 'true';
    },
    json,
    list: name => {
      const v = value(name);
      if (Array.isArray(v)) return v;
      if (v === undefined || v === null || v === '') return [];
      if (typeof v === 'string') {
        const t = v.trim();
        if (t.startsWith('[')) {
          try {
            const parsed = JSON.parse(t);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // fall through to comma-separated
          }
        }
        return t
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
      return [v];
    },
    config,
    context,
    fetch: httpFetch,
    shell: deps.shell,
    credential: async name => {
      const ref = String(config[name] ?? '');
      const id =
        SECRET_REF.exec(ref)?.[1] ?? (/^[A-Za-z0-9_-]+$/.test(ref.trim()) ? ref.trim() : '');
      if (!id) throw new StepInputError(`${name} must be a credential from Settings → Credentials`);
      const secret = context.secrets?.[id];
      const account = deps.findAccount ? await deps.findAccount(id, context.tenantId) : null;
      if (!account || secret === undefined) {
        throw new StepInputError(`credential ${id} was not found in this workspace`);
      }
      const metadata =
        account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)
          ? (account.metadata as Record<string, unknown>)
          : {};
      return { id, provider: account.provider, metadata, secret };
    },
  };
}

export function ok(output: Record<string, unknown>, startTime = Date.now()): ExecutorResult {
  return { success: true, output, duration: Date.now() - startTime };
}

export function fail(error: string, startTime = Date.now()): ExecutorResult {
  return { success: false, error, duration: Date.now() - startTime };
}

/** A step that is one HTTP call: describe the request, the rest is shared. */
export function apiNode(
  meta: CatalogNodeMeta & {
    request(t: StepTools): ApiRequest | string;
  } & ApiResponseHandling
): CatalogNode {
  const { request, shape, bodyError, ...rest } = meta;
  return {
    ...rest,
    run: t => {
      const req = request(t);
      if (typeof req === 'string') return fail(req);
      return sendApiRequest(meta.type, req, t.context, t.fetch, { shape, bodyError });
    },
  };
}

export const MAIN: Port[] = [{ name: 'main', type: 'main' }];

/** Basic auth header value. */
export function basic(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

/** Base URL without trailing slashes; must be http(s). */
export function baseUrl(raw: string, field = 'baseUrl'): string {
  const url = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(url))
    throw new StepInputError(`${field} must start with http:// or https://`);
  return url;
}

export function enc(v: string): string {
  return encodeURIComponent(v);
}
