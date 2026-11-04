import { optionLoader } from '../../integrations/option-loaders';
import type { ApiRequest, ApiResponseHandling } from '../executors/_api-step';
import {
  apiNode,
  baseUrl,
  basic,
  type CatalogNode,
  type CatalogProperty,
  enc,
  MAIN,
  StepInputError,
  type StepTools,
} from './define';

/**
 * Declarative integrations: one step per service, an `operation` picker,
 * and each operation described as data (method, path, fields). Fields
 * shared by several operations are declared once per operation and merged
 * into one form field whose visibility covers all of them.
 */

type Method = ApiRequest['method'];

export interface OpField {
  name: string;
  displayName: string;
  type?: 'string' | 'number' | 'boolean' | 'options';
  required?: boolean;
  default?: unknown;
  description?: string;
  options?: Array<{ name: string; value: string }>;
  rows?: number;
  /** Where the value goes. Defaults: `{name}` in the path → path; GET/DELETE → query; else body. */
  in?: 'path' | 'query' | 'body' | 'none';
  /** Parameter name in the API when it differs from the form field; dots nest (`properties.email`). */
  key?: string;
  /** Parse the field as JSON before sending (objects, arrays). */
  json?: boolean;
  /** Send a comma-separated field as an array. */
  list?: boolean;
}

export interface ServiceOp {
  value: string;
  label: [string, string];
  method: Method;
  path: string;
  fields?: OpField[];
  /**
   * Adds a JSON "Additional fields" box merged into the body (or the
   * query for GET/DELETE) so anything the form does not model still
   * reaches the API. On by default.
   */
  extra?: boolean;
  /** Final say over the body once fields are collected. */
  body?: (t: StepTools, body: Record<string, unknown>) => unknown;
  /** Path placeholders computed from the form (e.g. a hash of the email). */
  pathParams?: (t: StepTools) => Record<string, string>;
  /** Raw query string appended as-is (PostgREST filters like `id=eq.42`). */
  rawQuery?: (t: StepTools) => string;
}

export type ServiceAuth =
  | { kind: 'bearer'; provider: string; label?: string; prefix?: string }
  | { kind: 'header'; provider: string; header: string; label?: string; prefix?: string }
  | { kind: 'query'; provider: string; param: string; label?: string }
  | { kind: 'basic'; provider: string; user: OpField; label?: string }
  /**
   * Basic auth built from the secret alone: `user` fixes the user name
   * (Mailgun's "api"), `password` fixes the password (Freshdesk's "X"
   * with the key as user), neither means the secret is "user:password".
   */
  | { kind: 'basicSecret'; provider: string; label?: string; user?: string; password?: string }
  /** The secret goes into the path as `{credential}` (Telegram's /bot<token>/…). */
  | { kind: 'path'; provider: string; label?: string }
  /** The secret goes into the request body (or query for GET) under `key`. */
  | { kind: 'body'; provider: string; key: string; label?: string }
  | { kind: 'none' };

export interface ServiceDef {
  type: string;
  category: string;
  icon: string;
  color: string;
  label: [string, string];
  description: [string, string];
  auth: ServiceAuth;
  /** Fixed API root, or one built from a form field (subdomain, instance URL…). */
  base: string | { field: OpField; build(value: string): string };
  bodyType?: 'json' | 'form';
  headers?: Record<string, string>;
  /** Headers that depend on the form (an account id, a version). */
  headersFrom?: (t: StepTools) => Record<string, string>;
  operations: ServiceOp[];
  bodyError?: ApiResponseHandling['bodyError'];
  /** Fields the editor can fill from the API (integrations/option-loaders). */
  optionLoaders?: Record<string, { loader: string; params?: string[] }>;
}

const CREDENTIAL = 'credential';
const OPERATION = 'operation';
const EXTRA = 'additionalFields';

function toProperty(f: OpField, ops?: string[]): CatalogProperty {
  return {
    name: f.name,
    displayName: f.displayName,
    type: f.type ?? 'string',
    ...(f.default !== undefined ? { default: f.default } : {}),
    ...(f.description ? { description: f.description } : {}),
    ...(f.required ? { required: true } : {}),
    ...(f.options ? { options: f.options } : {}),
    ...((f.type ?? 'string') === 'string'
      ? { typeOptions: { expression: true, ...(f.rows ? { rows: f.rows } : {}) } }
      : {}),
    ...(ops ? { displayOptions: { show: { [OPERATION]: ops } } } : {}),
  };
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = target;
  for (const k of keys.slice(0, -1)) {
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

/** Stripe-style form encoding: `metadata[plan]=pro`, `items[0][price]=…`. */
export function flattenForm(value: unknown, prefix = '', out: Record<string, string> = {}) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flattenForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flattenForm(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function fieldValue(t: StepTools, f: OpField): unknown {
  const raw = t.config[f.name];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (f.json) return t.json(f.name, undefined);
  if (f.list) return t.list(f.name).map(String);
  if (f.type === 'number') return t.num(f.name);
  if (f.type === 'boolean') return t.bool(f.name);
  const v = t.value(f.name);
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? undefined : s;
  }
  return v;
}

function authProperties(auth: ServiceAuth): CatalogProperty[] {
  if (auth.kind === 'none') return [];
  const secret: CatalogProperty = {
    name: CREDENTIAL,
    displayName: auth.label ?? 'API token',
    type: 'secret',
    required: true,
    typeOptions: { provider: auth.provider },
  };
  return auth.kind === 'basic' ? [toProperty(auth.user), secret] : [secret];
}

function applyAuth(
  auth: ServiceAuth,
  t: StepTools,
  headers: Record<string, string>,
  query: URLSearchParams
): void {
  if (auth.kind === 'none') return;
  const secret = t.str(CREDENTIAL);
  switch (auth.kind) {
    case 'bearer':
      headers.Authorization = `${auth.prefix ?? 'Bearer'} ${secret}`;
      break;
    case 'header':
      headers[auth.header] = `${auth.prefix ?? ''}${secret}`;
      break;
    case 'query':
      query.set(auth.param, secret);
      break;
    case 'basic':
      headers.Authorization = basic(t.str(auth.user.name), secret);
      break;
    case 'path':
    case 'body':
      // Placed by the request builder: they depend on the path and body.
      break;
    case 'basicSecret':
      if (auth.user !== undefined) headers.Authorization = basic(auth.user, secret);
      else if (auth.password !== undefined) headers.Authorization = basic(secret, auth.password);
      else if (secret.includes(':'))
        headers.Authorization = `Basic ${Buffer.from(secret).toString('base64')}`;
      else throw new StepInputError('credential must be "user:password"');
      break;
  }
}

export function service(def: ServiceDef): CatalogNode {
  const ops = def.operations;
  if (!ops.length) throw new Error(`${def.type}: no operations`);
  for (const [field, { loader }] of Object.entries(def.optionLoaders ?? {})) {
    const known = optionLoader(loader);
    if (!known) throw new Error(`${def.type}: unknown option loader ${loader}`);
    if (def.auth.kind === 'none' || known.provider !== def.auth.provider) {
      throw new Error(
        `${def.type}: loader ${loader} for "${field}" needs a ${known.provider} credential`
      );
    }
  }

  // Merge fields by name across operations; visibility is the union.
  // A merged field is required in the form only when every operation that
  // shows it requires it; otherwise each operation checks its own.
  const merged = new Map<string, { field: OpField; ops: string[]; required: boolean }>();
  for (const op of ops) {
    for (const f of op.fields ?? []) {
      const seen = merged.get(f.name);
      if (
        seen &&
        ((seen.field.type ?? 'string') !== (f.type ?? 'string') ||
          JSON.stringify(seen.field.options ?? null) !== JSON.stringify(f.options ?? null))
      ) {
        throw new Error(
          `${def.type}: field "${f.name}" differs between operations; give one a different name`
        );
      }
      if (seen) {
        seen.ops.push(op.value);
        seen.required &&= !!f.required;
      } else merged.set(f.name, { field: f, ops: [op.value], required: !!f.required });
    }
  }
  const extraOps = ops.filter(o => o.extra ?? true).map(o => o.value);
  const baseField = typeof def.base === 'string' ? undefined : def.base.field;
  // Fields the auth or the base URL already put on the form are not repeated.
  const shared = new Set([
    baseField?.name,
    def.auth.kind === 'basic' ? def.auth.user.name : undefined,
  ]);

  const properties: CatalogProperty[] = [
    {
      name: OPERATION,
      displayName: 'Operation',
      type: 'options',
      default: ops[0].value,
      options: ops.map(o => ({ name: o.label[0], value: o.value })),
    },
    ...authProperties(def.auth),
    ...(baseField ? [toProperty(baseField)] : []),
    ...[...merged.values()]
      .filter(({ field }) => !shared.has(field.name))
      .map(({ field, ops: shown, required }) =>
        toProperty({ ...field, required }, shown.length === ops.length ? undefined : shown)
      ),
    ...(extraOps.length
      ? [
          {
            name: EXTRA,
            displayName: 'Additional fields (JSON)',
            type: 'string' as const,
            description: 'Any other API parameter, merged into the request.',
            typeOptions: { rows: 3, expression: true },
            ...(extraOps.length === ops.length
              ? {}
              : { displayOptions: { show: { [OPERATION]: extraOps } } }),
          },
        ]
      : []),
  ];
  for (const p of properties) {
    const loader = def.optionLoaders?.[p.name];
    if (loader) p.typeOptions = { ...p.typeOptions, loadOptions: loader };
  }

  const byValue = new Map(ops.map(o => [o.value, o]));

  return apiNode({
    type: def.type,
    category: def.category,
    icon: def.icon,
    color: def.color,
    label: { en: def.label[0], es: def.label[1] },
    description: { en: def.description[0], es: def.description[1] },
    inputs: MAIN,
    outputs: MAIN,
    properties,
    request: t => {
      const op = byValue.get(t.str(OPERATION));
      if (!op) return `unknown operation "${t.str(OPERATION)}"`;
      const root =
        typeof def.base === 'string'
          ? def.base
          : baseUrl(def.base.build(t.str(def.base.field.name)), def.base.field.name);

      const query = new URLSearchParams();
      const headers: Record<string, string> = { ...def.headers, ...def.headersFrom?.(t) };
      applyAuth(def.auth, t, headers, query);

      // DELETE carries a body only when the operation builds one (NocoDB).
      const sendsBody = op.method !== 'GET' && (op.method !== 'DELETE' || !!op.body);
      let path = op.path;
      const body: Record<string, unknown> = {};
      for (const f of op.fields ?? []) {
        const v = fieldValue(t, f);
        if (f.required && v === undefined) return `${f.displayName} is required`;
        const where =
          f.in ?? (path.includes(`{${f.name}}`) ? 'path' : sendsBody ? 'body' : 'query');
        if (where === 'none') continue;
        if (where === 'path') {
          if (v === undefined) return `${f.displayName} is required for ${op.label[0]}`;
          path = path.replace(`{${f.name}}`, enc(String(v)));
          continue;
        }
        if (v === undefined) continue;
        if (where === 'query') {
          query.set(f.key ?? f.name, Array.isArray(v) ? v.join(',') : String(v));
        } else {
          setPath(body, f.key ?? f.name, v);
        }
      }
      if ((op.extra ?? true) && t.config[EXTRA]) {
        const extra = t.json<Record<string, unknown>>(EXTRA, {});
        if (typeof extra !== 'object' || Array.isArray(extra)) {
          throw new StepInputError('Additional fields must be a JSON object');
        }
        if (sendsBody) Object.assign(body, extra);
        else for (const [k, v] of Object.entries(extra)) query.set(k, String(v));
      }
      if (def.auth.kind === 'path') {
        const secret = t.str(CREDENTIAL);
        if (!/^[A-Za-z0-9:_-]+$/.test(secret))
          throw new StepInputError('credential has unexpected characters');
        path = path.replace('{credential}', secret);
      }
      if (def.auth.kind === 'body') {
        if (sendsBody) setPath(body, def.auth.key, t.str(CREDENTIAL));
        else query.set(def.auth.key, t.str(CREDENTIAL));
      }
      for (const [k, v] of Object.entries(op.pathParams?.(t) ?? {})) {
        path = path.replace(`{${k}}`, enc(v));
      }
      const unresolved = /\{[A-Za-z0-9_]+\}/.exec(path);
      if (unresolved) return `${unresolved[0]} is missing for ${op.label[0]}`;

      const raw = op.rawQuery?.(t).replace(/^[?&]+/, '') ?? '';
      const qs = [query.toString(), raw].filter(Boolean).join('&');
      const url = `${root}${path}${qs ? `${path.includes('?') ? '&' : '?'}${qs}` : ''}`;
      const finalBody = op.body ? op.body(t, body) : body;
      const req: ApiRequest = {
        method: op.method,
        url,
        headers,
        describe: `${def.label[0]}: ${op.label[0]}`,
      };
      if (sendsBody) {
        if (def.bodyType === 'form') req.form = flattenForm(finalBody);
        else req.body = finalBody;
      }
      return req;
    },
    bodyError: def.bodyError,
    shape: (body, status) => ({ status, data: body }),
  });
}

/** Shortcut for an operation field. */
export const f = (name: string, displayName: string, extra: Partial<OpField> = {}): OpField => ({
  name,
  displayName,
  ...extra,
});

/** Same field, required. */
export const r = (name: string, displayName: string, extra: Partial<OpField> = {}): OpField =>
  f(name, displayName, { ...extra, required: true });

/** CRUD over one REST collection: list / get / create / update / delete. */
export function crud(
  resource: string,
  labels: { one: [string, string]; many: [string, string] },
  path: string,
  idField: OpField,
  createFields: OpField[] = [],
  opts: { updateMethod?: Method; listQuery?: OpField[]; skip?: string[]; idPath?: string } = {}
): ServiceOp[] {
  const id = `{${idField.name}}`;
  const item = opts.idPath ?? `${path}/${id}`;
  const all: ServiceOp[] = [
    {
      value: `${resource}.list`,
      label: [`List ${labels.many[0]}`, `Listar ${labels.many[1]}`],
      method: 'GET',
      path,
      fields: opts.listQuery,
    },
    {
      value: `${resource}.get`,
      label: [`Get ${labels.one[0]}`, `Obtener ${labels.one[1]}`],
      method: 'GET',
      path: item,
      fields: [idField],
      extra: false,
    },
    {
      value: `${resource}.create`,
      label: [`Create ${labels.one[0]}`, `Crear ${labels.one[1]}`],
      method: 'POST',
      path,
      fields: createFields,
    },
    {
      value: `${resource}.update`,
      label: [`Update ${labels.one[0]}`, `Actualizar ${labels.one[1]}`],
      method: opts.updateMethod ?? 'PATCH',
      path: item,
      fields: [idField, ...createFields.map(cf => ({ ...cf, required: false }))],
    },
    {
      value: `${resource}.delete`,
      label: [`Delete ${labels.one[0]}`, `Eliminar ${labels.one[1]}`],
      method: 'DELETE',
      path: item,
      fields: [idField],
      extra: false,
    },
  ];
  return all.filter(o => !opts.skip?.includes(o.value.split('.')[1]));
}
