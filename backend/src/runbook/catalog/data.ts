import yaml from 'js-yaml';
import { JSONPath } from 'jsonpath-plus';
import jwt from 'jsonwebtoken';

import { type CatalogNode, type CatalogProperty, MAIN, ok, StepInputError } from './define';

const items = (
  description = 'Array to work on, e.g. {{steps.fetch.output.body.items}}'
): CatalogProperty => ({
  name: 'items',
  displayName: 'Items',
  type: 'string',
  required: true,
  description,
  typeOptions: { expression: true },
});

const field = (description: string, required = false): CatalogProperty => ({
  name: 'field',
  displayName: 'Field',
  type: 'string',
  required,
  description,
});

function get(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in (cur as object)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'data',
  icon,
  color: 'bg-teal-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const COMPARE_OPS = [
  { name: 'equals', value: 'equals' },
  { name: 'not equals', value: 'notEquals' },
  { name: 'contains', value: 'contains' },
  { name: 'greater than', value: 'gt' },
  { name: 'less than', value: 'lt' },
  { name: 'matches regex', value: 'regex' },
  { name: 'exists', value: 'exists' },
  { name: 'does not exist', value: 'notExists' },
];

function compare(actual: unknown, op: string, expected: string): boolean {
  switch (op) {
    case 'equals':
      return String(actual ?? '') === expected;
    case 'notEquals':
      return String(actual ?? '') !== expected;
    case 'contains':
      return String(actual ?? '').includes(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'regex':
      return new RegExp(expected).test(String(actual ?? ''));
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'notExists':
      return actual === undefined || actual === null || actual === '';
    default:
      throw new StepInputError(`unknown operator "${op}"`);
  }
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function csvCell(value: unknown, delimiter: string): string {
  const s =
    value === undefined || value === null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return /["\n\r]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const DATA_NODES: CatalogNode[] = [
  {
    ...meta(
      'operari.json',
      'Braces',
      ['JSON', 'JSON'],
      [
        'Parse JSON text, turn a value into JSON, or pick values with a JSONPath',
        'Parsear JSON, convertir un valor a JSON o extraer valores con JSONPath',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'parse',
        options: [
          { name: 'Parse JSON text', value: 'parse' },
          { name: 'Stringify a value', value: 'stringify' },
          { name: 'Query with JSONPath', value: 'query' },
        ],
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'path',
        displayName: 'JSONPath',
        type: 'string',
        required: true,
        description: 'e.g. $.items[?(@.status=="failed")].id',
        displayOptions: { show: { action: ['query'] } },
      },
    ],
    run: t => {
      const action = t.str('action');
      if (action === 'stringify') return ok({ value: JSON.stringify(t.value('value')) });
      const data = t.json<unknown>('value', null);
      if (action === 'parse') return ok({ value: data });
      const result = JSONPath({
        path: t.str('path'),
        json: data as object,
        wrap: true,
      }) as unknown[];
      return ok({ value: result.length === 1 ? result[0] : result, matches: result });
    },
  },
  {
    ...meta(
      'operari.filter',
      'Filter',
      ['Filter items', 'Filtrar elementos'],
      [
        'Keep the items of a list whose field matches a condition',
        'Conservar los elementos de una lista cuyo campo cumple una condición',
      ]
    ),
    properties: [
      items(),
      field(
        'Dot path inside each item, e.g. status or labels.env. Empty compares the item itself.'
      ),
      {
        name: 'operator',
        displayName: 'Operator',
        type: 'options',
        default: 'equals',
        options: COMPARE_OPS,
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        typeOptions: { expression: true },
        displayOptions: {
          show: { operator: ['equals', 'notEquals', 'contains', 'gt', 'lt', 'regex'] },
        },
      },
    ],
    run: t => {
      const op = t.str('operator');
      const expected = t.str('value');
      const kept = t.list('items').filter(item => compare(get(item, t.str('field')), op, expected));
      return ok({ items: kept, count: kept.length });
    },
  },
  {
    ...meta(
      'operari.sort',
      'ArrowUpDown',
      ['Sort items', 'Ordenar elementos'],
      ['Sort a list by a field', 'Ordenar una lista por un campo']
    ),
    properties: [
      items(),
      field('Dot path to sort by. Empty sorts the items themselves.'),
      {
        name: 'order',
        displayName: 'Order',
        type: 'options',
        default: 'asc',
        options: [
          { name: 'Ascending', value: 'asc' },
          { name: 'Descending', value: 'desc' },
        ],
      },
    ],
    run: t => {
      const path = t.str('field');
      const dir = t.str('order') === 'desc' ? -1 : 1;
      const sorted = [...t.list('items')].sort((a, b) => {
        const x = get(a, path);
        const y = get(b, path);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true }) * dir;
      });
      return ok({ items: sorted, count: sorted.length });
    },
  },
  {
    ...meta(
      'operari.limit',
      'ListEnd',
      ['Limit items', 'Limitar elementos'],
      [
        'Keep only the first or last N items of a list',
        'Conservar solo los primeros o últimos N elementos de una lista',
      ]
    ),
    properties: [
      items(),
      { name: 'count', displayName: 'Max items', type: 'number', default: 10 },
      {
        name: 'from',
        displayName: 'Keep',
        type: 'options',
        default: 'start',
        options: [
          { name: 'First items', value: 'start' },
          { name: 'Last items', value: 'end' },
        ],
      },
    ],
    run: t => {
      const list = t.list('items');
      const n = Math.max(0, Math.floor(t.num('count')));
      const kept =
        t.str('from') === 'end' ? list.slice(Math.max(0, list.length - n)) : list.slice(0, n);
      return ok({ items: kept, count: kept.length });
    },
  },
  {
    ...meta(
      'operari.removeDuplicates',
      'CopyMinus',
      ['Remove duplicates', 'Quitar duplicados'],
      [
        'Drop repeated items, comparing the whole item or one field',
        'Eliminar elementos repetidos, comparando el elemento completo o un campo',
      ]
    ),
    properties: [items(), field('Compare only this field. Empty compares the whole item.')],
    run: t => {
      const path = t.str('field');
      const seen = new Set<string>();
      const kept = t.list('items').filter(item => {
        const key = JSON.stringify(path ? get(item, path) : item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return ok({ items: kept, count: kept.length });
    },
  },
  {
    ...meta(
      'operari.aggregate',
      'Sigma',
      ['Aggregate', 'Agregar'],
      [
        'Count, sum, average, min, max or collect a field across a list',
        'Contar, sumar, promediar, mínimo, máximo o juntar un campo de una lista',
      ]
    ),
    properties: [
      items(),
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'count',
        options: [
          { name: 'Count', value: 'count' },
          { name: 'Sum', value: 'sum' },
          { name: 'Average', value: 'avg' },
          { name: 'Minimum', value: 'min' },
          { name: 'Maximum', value: 'max' },
          { name: 'Collect values', value: 'collect' },
          { name: 'Unique values', value: 'unique' },
        ],
      },
      {
        ...field('Dot path inside each item. Empty uses the item itself.'),
        displayOptions: { show: { operation: ['sum', 'avg', 'min', 'max', 'collect', 'unique'] } },
      },
    ],
    run: t => {
      const list = t.list('items');
      const op = t.str('operation');
      if (op === 'count') return ok({ value: list.length });
      const values = list.map(i => get(i, t.str('field')));
      if (op === 'collect') return ok({ value: values });
      if (op === 'unique')
        return ok({ value: [...new Map(values.map(v => [JSON.stringify(v), v])).values()] });
      const nums = values.map(Number).filter(n => !Number.isNaN(n));
      if (nums.length === 0) return ok({ value: null });
      const sum = nums.reduce((a, b) => a + b, 0);
      const value =
        op === 'sum'
          ? sum
          : op === 'avg'
            ? sum / nums.length
            : op === 'min'
              ? Math.min(...nums)
              : Math.max(...nums);
      return ok({ value });
    },
  },
  {
    ...meta(
      'operari.merge',
      'Merge',
      ['Merge objects', 'Combinar objetos'],
      [
        'Combine two objects into one; the second wins on conflicts',
        'Combinar dos objetos en uno; el segundo gana en conflictos',
      ]
    ),
    properties: [
      {
        name: 'a',
        displayName: 'First object',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'b',
        displayName: 'Second object',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
      { name: 'deep', displayName: 'Merge nested objects', type: 'boolean', default: false },
    ],
    run: t => {
      const a = t.json<Record<string, unknown>>('a', {});
      const b = t.json<Record<string, unknown>>('b', {});
      const isObj = (v: unknown): v is Record<string, unknown> =>
        !!v && typeof v === 'object' && !Array.isArray(v);
      if (!isObj(a) || !isObj(b)) throw new StepInputError('both values must be JSON objects');
      const deepMerge = (
        x: Record<string, unknown>,
        y: Record<string, unknown>
      ): Record<string, unknown> => {
        const out: Record<string, unknown> = { ...x };
        for (const [k, v] of Object.entries(y))
          out[k] = isObj(out[k]) && isObj(v) ? deepMerge(out[k] as Record<string, unknown>, v) : v;
        return out;
      };
      return ok(t.bool('deep') ? deepMerge(a, b) : { ...a, ...b });
    },
  },
  {
    ...meta(
      'operari.text',
      'Type',
      ['Text', 'Texto'],
      [
        'Change case, trim, replace or extract with a regex, split, slugify, truncate',
        'Mayúsculas, recortar, reemplazar o extraer con regex, dividir, slug, truncar',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'trim',
        options: [
          { name: 'Trim', value: 'trim' },
          { name: 'UPPER CASE', value: 'upper' },
          { name: 'lower case', value: 'lower' },
          { name: 'Replace (regex)', value: 'replace' },
          { name: 'Extract (regex)', value: 'extract' },
          { name: 'Split into a list', value: 'split' },
          { name: 'Slugify', value: 'slug' },
          { name: 'Truncate', value: 'truncate' },
          { name: 'Length', value: 'length' },
        ],
      },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'pattern',
        displayName: 'Regex',
        type: 'string',
        required: true,
        description: 'JavaScript regex without slashes, e.g. version: (\\d+\\.\\d+)',
        displayOptions: { show: { action: ['replace', 'extract'] } },
      },
      {
        name: 'replacement',
        displayName: 'Replace with',
        type: 'string',
        description: '$1, $2… refer to capture groups.',
        displayOptions: { show: { action: ['replace'] } },
      },
      {
        name: 'separator',
        displayName: 'Separator',
        type: 'string',
        default: ',',
        displayOptions: { show: { action: ['split'] } },
      },
      {
        name: 'maxLength',
        displayName: 'Max length',
        type: 'number',
        default: 100,
        displayOptions: { show: { action: ['truncate'] } },
      },
    ],
    run: t => {
      const text = t.str('text');
      switch (t.str('action')) {
        case 'upper':
          return ok({ value: text.toUpperCase() });
        case 'lower':
          return ok({ value: text.toLowerCase() });
        case 'replace':
          return ok({
            value: text.replace(new RegExp(t.str('pattern'), 'g'), t.str('replacement')),
          });
        case 'extract': {
          const m = new RegExp(t.str('pattern')).exec(text);
          return ok({
            value: m ? (m[1] ?? m[0]) : null,
            groups: m ? m.slice(1) : [],
            matched: !!m,
          });
        }
        case 'split':
          return ok({ value: text.split(t.str('separator') || ',').map(s => s.trim()) });
        case 'slug':
          return ok({
            value: text
              .normalize('NFKD')
              .replace(/[̀-ͯ]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, ''),
          });
        case 'truncate': {
          const max = Math.max(1, t.num('maxLength'));
          return ok({ value: text.length > max ? `${text.slice(0, max - 1)}…` : text });
        }
        case 'length':
          return ok({ value: text.length });
        default:
          return ok({ value: text.trim() });
      }
    },
  },
  {
    ...meta(
      'operari.base64',
      'Binary',
      ['Base64', 'Base64'],
      ['Encode or decode Base64', 'Codificar o decodificar Base64']
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'encode',
        options: [
          { name: 'Encode', value: 'encode' },
          { name: 'Decode', value: 'decode' },
        ],
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
    ],
    run: t => {
      const v = t.str('value');
      return ok({
        value:
          t.str('action') === 'decode'
            ? Buffer.from(v, 'base64').toString('utf8')
            : Buffer.from(v, 'utf8').toString('base64'),
      });
    },
  },
  {
    ...meta(
      'operari.csv',
      'Sheet',
      ['CSV', 'CSV'],
      [
        'Turn CSV text into a list of rows, or a list into CSV',
        'Convertir texto CSV en una lista de filas, o una lista en CSV',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'parse',
        options: [
          { name: 'CSV → list', value: 'parse' },
          { name: 'List → CSV', value: 'generate' },
        ],
      },
      {
        name: 'value',
        displayName: 'Input',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
      },
      { name: 'delimiter', displayName: 'Delimiter', type: 'string', default: ',' },
      { name: 'header', displayName: 'First row is the header', type: 'boolean', default: true },
    ],
    run: t => {
      const d = t.str('delimiter') || ',';
      const header = t.bool('header');
      if (t.str('action') === 'generate') {
        const list = t.list('value');
        if (list.length === 0) return ok({ value: '' });
        if (list.every(r => Array.isArray(r))) {
          return ok({
            value: (list as unknown[][]).map(r => r.map(c => csvCell(c, d)).join(d)).join('\n'),
          });
        }
        const cols = [
          ...new Set(list.flatMap(r => (r && typeof r === 'object' ? Object.keys(r) : []))),
        ];
        const lines = list.map(r =>
          cols.map(c => csvCell((r as Record<string, unknown>)?.[c], d)).join(d)
        );
        return ok({
          value: (header ? [cols.map(c => csvCell(c, d)).join(d), ...lines] : lines).join('\n'),
        });
      }
      const rows = parseCsv(t.str('value'), d);
      if (!header) return ok({ items: rows, count: rows.length });
      const [cols = [], ...data] = rows;
      const objs = data.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ''])));
      return ok({ items: objs, count: objs.length, columns: cols });
    },
  },
  {
    ...meta(
      'operari.yaml',
      'FileCode2',
      ['YAML', 'YAML'],
      ['Parse YAML text or turn a value into YAML', 'Parsear YAML o convertir un valor a YAML']
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'parse',
        options: [
          { name: 'YAML → value', value: 'parse' },
          { name: 'Value → YAML', value: 'stringify' },
        ],
      },
      {
        name: 'value',
        displayName: 'Input',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
      },
    ],
    run: t => {
      if (t.str('action') === 'stringify') {
        const v = t.value('value');
        let data = v;
        if (typeof v === 'string') {
          try {
            data = JSON.parse(v);
          } catch {
            // plain text stays text
          }
        }
        return ok({ value: yaml.dump(data) });
      }
      try {
        return ok({ value: yaml.load(t.str('value'), { schema: yaml.JSON_SCHEMA }) });
      } catch (err) {
        throw new StepInputError(`invalid YAML: ${(err as Error).message}`);
      }
    },
  },
  {
    ...meta(
      'operari.jwt',
      'KeySquare',
      ['JWT', 'JWT'],
      [
        'Decode, verify or sign a JSON Web Token (HMAC)',
        'Decodificar, verificar o firmar un JSON Web Token (HMAC)',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'decode',
        options: [
          { name: 'Decode (no verification)', value: 'decode' },
          { name: 'Verify', value: 'verify' },
          { name: 'Sign', value: 'sign' },
        ],
      },
      {
        name: 'token',
        displayName: 'Token',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['decode', 'verify'] } },
      },
      {
        name: 'payload',
        displayName: 'Payload (JSON)',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
        displayOptions: { show: { action: ['sign'] } },
      },
      {
        name: 'secret',
        displayName: 'Secret',
        type: 'secret',
        required: true,
        displayOptions: { show: { action: ['verify', 'sign'] } },
      },
      {
        name: 'expiresIn',
        displayName: 'Expires in',
        type: 'string',
        default: '1h',
        description: 'e.g. 15m, 1h, 7d',
        displayOptions: { show: { action: ['sign'] } },
      },
    ],
    run: t => {
      const action = t.str('action');
      if (action === 'sign') {
        const payload = t.json<Record<string, unknown>>('payload', {});
        return ok({
          token: jwt.sign(payload, t.str('secret'), {
            algorithm: 'HS256',
            ...(t.str('expiresIn')
              ? { expiresIn: t.str('expiresIn') as jwt.SignOptions['expiresIn'] }
              : {}),
          }),
        });
      }
      if (action === 'verify') {
        try {
          const payload = jwt.verify(t.str('token'), t.str('secret'), {
            algorithms: ['HS256', 'HS384', 'HS512'],
          });
          return ok({ valid: true, payload });
        } catch (err) {
          return ok({ valid: false, reason: (err as Error).message });
        }
      }
      const decoded = jwt.decode(t.str('token'), { complete: true });
      if (!decoded) throw new StepInputError('token is not a JWT');
      return ok({ header: decoded.header, payload: decoded.payload });
    },
  },
  {
    ...meta(
      'operari.url',
      'Link',
      ['URL', 'URL'],
      [
        'Split a URL into parts, or build one from a base and query parameters',
        'Separar una URL en partes, o construirla desde una base y parámetros',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'parse',
        options: [
          { name: 'Parse', value: 'parse' },
          { name: 'Build', value: 'build' },
        ],
      },
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      {
        name: 'query',
        displayName: 'Query parameters (JSON)',
        type: 'string',
        description: '{"page": 2, "q": "{{vars.service}}"}',
        typeOptions: { rows: 3, expression: true },
        displayOptions: { show: { action: ['build'] } },
      },
    ],
    run: t => {
      let url: URL;
      try {
        url = new URL(t.str('url'));
      } catch {
        throw new StepInputError('url is not a valid absolute URL');
      }
      if (t.str('action') === 'build') {
        for (const [k, v] of Object.entries(t.json<Record<string, unknown>>('query', {}))) {
          url.searchParams.set(k, String(v));
        }
        return ok({ url: url.toString() });
      }
      return ok({
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: url.port ? Number(url.port) : null,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        hash: url.hash.replace(/^#/, ''),
      });
    },
  },
];
