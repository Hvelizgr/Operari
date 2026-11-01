import { XMLBuilder, XMLParser } from 'fast-xml-parser';

import { guardedFetch } from '../../security/ssrf-guard';
import { type CatalogNode, type CatalogProperty, fail, MAIN, ok, StepInputError } from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'data',
  icon,
  color: 'bg-cyan-700',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const items = (name = 'items', displayName = 'Items'): CatalogProperty => ({
  name,
  displayName,
  type: 'string',
  required: true,
  description: 'A list, e.g. {{steps.query.output.rows}}, or JSON.',
  typeOptions: { rows: 2, expression: true },
});

function get(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (cur, k) =>
        cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined,
      obj
    );
}

function asObjects(list: unknown[], field: string): Record<string, unknown>[] {
  return list.map((v, i) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      throw new StepInputError(`${field}[${i}] is not an object`);
    }
    return v as Record<string, unknown>;
  });
}

/** Parsed RSS/Atom has no fixed shape: fields may be strings, objects or arrays. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Feed = Record<string, any>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: true,
});

/** Text of an HTML document: scripts, styles and tags dropped, entities decoded, whitespace folded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function icsDate(v: string, field: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new StepInputError(`${field} is not a valid date`);
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

const icsEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const UTILITY_NODES: CatalogNode[] = [
  {
    ...meta(
      'operari.renameKeys',
      'Replace',
      ['Rename keys', 'Renombrar claves'],
      [
        'Rename fields on every item of a list, or on one object',
        'Renombrar campos en cada elemento de una lista o en un objeto',
      ]
    ),
    properties: [
      items('input', 'Items or object'),
      {
        name: 'mapping',
        displayName: 'Mapping (JSON)',
        type: 'string',
        required: true,
        default: '{"old_name": "new_name"}',
        typeOptions: { rows: 3, expression: true },
      },
      { name: 'keepOthers', displayName: 'Keep other fields', type: 'boolean', default: true },
    ],
    run: t => {
      const mapping = t.json<Record<string, string>>('mapping', {});
      const rename = (o: Record<string, unknown>) => {
        const out: Record<string, unknown> = t.bool('keepOthers') ? { ...o } : {};
        for (const [from, to] of Object.entries(mapping)) {
          if (from in o) {
            delete out[from];
            out[String(to)] = o[from];
          }
        }
        return out;
      };
      const v = t.value('input');
      const parsed = typeof v === 'string' ? t.json<unknown>('input', null) : v;
      if (Array.isArray(parsed)) {
        const renamed = asObjects(parsed, 'input').map(rename);
        return ok({ items: renamed, count: renamed.length });
      }
      if (parsed && typeof parsed === 'object')
        return ok({ value: rename(parsed as Record<string, unknown>) });
      return fail('input must be a list of objects or an object');
    },
  },
  {
    ...meta(
      'operari.splitOut',
      'Split',
      ['Split out list', 'Separar lista'],
      [
        'Turn a list field inside each item into one item per entry',
        'Convertir un campo-lista de cada elemento en un elemento por entrada',
      ]
    ),
    properties: [
      items(),
      {
        name: 'field',
        displayName: 'List field',
        type: 'string',
        required: true,
        description: 'e.g. tags or order.lines',
        typeOptions: { expression: true },
      },
      { name: 'include', displayName: 'Keep parent fields', type: 'boolean', default: true },
      { name: 'as', displayName: 'Put each entry under', type: 'string', default: 'value' },
    ],
    run: t => {
      const field = t.str('field');
      const out: Record<string, unknown>[] = [];
      for (const item of asObjects(t.list('items'), 'items')) {
        const list = get(item, field);
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          const base: Record<string, unknown> = t.bool('include') ? { ...item } : {};
          delete base[field.split('.')[0]];
          out.push({ ...base, [t.str('as') || 'value']: entry });
        }
      }
      return ok({ items: out, count: out.length });
    },
  },
  {
    ...meta(
      'operari.compareDatasets',
      'GitCompare',
      ['Compare datasets', 'Comparar datasets'],
      [
        'Match two lists by a key: only in A, only in B, same, and changed',
        'Cruzar dos listas por una clave: solo en A, solo en B, iguales y con cambios',
      ]
    ),
    properties: [
      items('a', 'List A'),
      items('b', 'List B'),
      {
        name: 'key',
        displayName: 'Match on field',
        type: 'string',
        required: true,
        default: 'id',
        typeOptions: { expression: true },
      },
    ],
    run: t => {
      const key = t.str('key');
      const a = asObjects(t.list('a'), 'a');
      const b = asObjects(t.list('b'), 'b');
      const byKey = new Map(b.map(o => [JSON.stringify(get(o, key)), o]));
      const onlyA: unknown[] = [];
      const same: unknown[] = [];
      const changed: Array<{ key: unknown; a: unknown; b: unknown; fields: string[] }> = [];
      const seen = new Set<string>();
      for (const o of a) {
        const k = JSON.stringify(get(o, key));
        const other = byKey.get(k);
        if (!other) {
          onlyA.push(o);
          continue;
        }
        seen.add(k);
        const fields = [...new Set([...Object.keys(o), ...Object.keys(other)])].filter(
          f => JSON.stringify(o[f]) !== JSON.stringify(other[f])
        );
        if (fields.length) changed.push({ key: get(o, key), a: o, b: other, fields });
        else same.push(o);
      }
      const onlyB = b.filter(o => !seen.has(JSON.stringify(get(o, key))));
      return ok({
        onlyA,
        onlyB,
        same,
        changed,
        counts: {
          onlyA: onlyA.length,
          onlyB: onlyB.length,
          same: same.length,
          changed: changed.length,
        },
      });
    },
  },
  {
    ...meta(
      'operari.summarize',
      'Sigma',
      ['Summarize', 'Resumir'],
      [
        'Group items and count, sum, average, min or max a field',
        'Agrupar elementos y contar, sumar, promediar o sacar mín/máx de un campo',
      ]
    ),
    properties: [
      items(),
      {
        name: 'groupBy',
        displayName: 'Group by field',
        type: 'string',
        description: 'Empty summarizes everything as one group.',
        typeOptions: { expression: true },
      },
      {
        name: 'op',
        displayName: 'Operation',
        type: 'options',
        default: 'count',
        options: [
          { name: 'Count', value: 'count' },
          { name: 'Sum', value: 'sum' },
          { name: 'Average', value: 'avg' },
          { name: 'Min', value: 'min' },
          { name: 'Max', value: 'max' },
          { name: 'Count unique', value: 'unique' },
        ],
      },
      {
        name: 'field',
        displayName: 'Field',
        type: 'string',
        description: 'Not needed for Count.',
        typeOptions: { expression: true },
        displayOptions: { show: { op: ['sum', 'avg', 'min', 'max', 'unique'] } },
      },
    ],
    run: t => {
      const op = t.str('op');
      const field = t.str('field');
      if (op !== 'count' && !field) return fail('Field is required for this operation');
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const item of asObjects(t.list('items'), 'items')) {
        const k = t.str('groupBy') ? String(get(item, t.str('groupBy')) ?? '') : '*';
        groups.set(k, [...(groups.get(k) ?? []), item]);
      }
      const result = [...groups.entries()].map(([group, list]) => {
        const nums = list.map(i => Number(get(i, field))).filter(n => !Number.isNaN(n));
        let value: unknown;
        switch (op) {
          case 'count':
            value = list.length;
            break;
          case 'sum':
            value = nums.reduce((s, n) => s + n, 0);
            break;
          case 'avg':
            value = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
            break;
          case 'min':
            value = nums.length ? Math.min(...nums) : null;
            break;
          case 'max':
            value = nums.length ? Math.max(...nums) : null;
            break;
          default:
            value = new Set(list.map(i => JSON.stringify(get(i, field)))).size;
        }
        return { group, value, count: list.length };
      });
      return ok({
        groups: result,
        value: result.length === 1 && !t.str('groupBy') ? result[0].value : undefined,
      });
    },
  },
  {
    ...meta(
      'operari.html',
      'Code',
      ['HTML', 'HTML'],
      [
        'Get the text, links and title of an HTML page',
        'Obtener el texto, los enlaces y el título de una página HTML',
      ]
    ),
    properties: [
      {
        name: 'html',
        displayName: 'HTML',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
        description: 'e.g. {{steps.fetch.output.body}}',
      },
      {
        name: 'baseUrl',
        displayName: 'Base URL for relative links',
        type: 'string',
        typeOptions: { expression: true },
      },
    ],
    run: t => {
      const html = t.str('html');
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
      const links: Array<{ href: string; text: string }> = [];
      for (const m of html.matchAll(
        /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
      )) {
        let href = m[1];
        try {
          if (t.str('baseUrl')) href = new URL(href, t.str('baseUrl')).toString();
        } catch {
          // keep it as written
        }
        links.push({ href, text: htmlToText(m[2]) });
      }
      const text = htmlToText(html);
      return ok({ title, text, links, length: text.length });
    },
  },
  {
    ...meta(
      'operari.xml',
      'Braces',
      ['XML', 'XML'],
      [
        'Parse XML into JSON, or build XML from JSON',
        'Convertir XML a JSON o generar XML desde JSON',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'parse',
        options: [
          { name: 'XML → JSON', value: 'parse' },
          { name: 'JSON → XML', value: 'build' },
        ],
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
      },
    ],
    run: t => {
      if (t.str('action') === 'build') {
        const builder = new XMLBuilder({
          ignoreAttributes: false,
          attributeNamePrefix: '@',
          format: true,
        });
        return ok({ value: builder.build(t.json('value', {})) });
      }
      return ok({ value: xmlParser.parse(t.str('value')) });
    },
  },
  {
    ...meta(
      'operari.rss',
      'Rss',
      ['RSS feed', 'Feed RSS'],
      [
        'Read the latest entries of an RSS or Atom feed',
        'Leer las últimas entradas de un feed RSS o Atom',
      ]
    ),
    properties: [
      {
        name: 'url',
        displayName: 'Feed URL',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      { name: 'limit', displayName: 'Max entries', type: 'number', default: 20 },
    ],
    run: async t => {
      const start = Date.now();
      if (t.context.dryRun) return ok({ dryRun: true, action: `read feed ${t.str('url')}` }, start);
      const res = await guardedFetch(t.fetch, t.str('url'), {
        method: 'GET',
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      });
      if (!res.ok) return fail(`operari.rss: HTTP ${res.status}`, start);
      const doc = xmlParser.parse(await res.text()) as Feed;
      const rss = doc.rss?.channel;
      const atom = doc.feed;
      const raw = rss ? rss.item : atom?.entry;
      const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(
        0,
        Math.max(1, t.num('limit'))
      );
      const entries = list.map((e: Feed) => ({
        title: typeof e.title === 'object' ? e.title['#text'] : e.title,
        link: typeof e.link === 'object' ? (e.link['@href'] ?? e.link[0]?.['@href']) : e.link,
        published: e.pubDate ?? e.published ?? e.updated ?? null,
        summary: htmlToText(
          String(e.description ?? e.summary ?? e.content?.['#text'] ?? e.content ?? '')
        ).slice(0, 500),
        id: e.guid?.['#text'] ?? e.guid ?? e.id ?? null,
      }));
      return ok(
        { title: rss?.title ?? atom?.title ?? null, entries, count: entries.length },
        start
      );
    },
  },
  {
    ...meta(
      'operari.ical',
      'CalendarPlus',
      ['Calendar invite (.ics)', 'Invitación de calendario (.ics)'],
      [
        'Build an iCalendar event to attach to an email or upload',
        'Crear un evento iCalendar para adjuntar a un email o subir',
      ]
    ),
    properties: [
      {
        name: 'title',
        displayName: 'Title',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      {
        name: 'start',
        displayName: 'Start (ISO)',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      {
        name: 'end',
        displayName: 'End (ISO)',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'string',
        typeOptions: { rows: 2, expression: true },
      },
      {
        name: 'location',
        displayName: 'Location or link',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'organizer',
        displayName: 'Organizer email',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'attendees',
        displayName: 'Attendee emails',
        type: 'string',
        description: 'Comma-separated.',
        typeOptions: { expression: true },
      },
    ],
    run: t => {
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@operari`;
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Operari//Runbook//EN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${icsDate(new Date().toISOString(), 'now')}`,
        `DTSTART:${icsDate(t.str('start'), 'Start')}`,
        `DTEND:${icsDate(t.str('end'), 'End')}`,
        `SUMMARY:${icsEscape(t.str('title'))}`,
        ...(t.str('description') ? [`DESCRIPTION:${icsEscape(t.str('description'))}`] : []),
        ...(t.str('location') ? [`LOCATION:${icsEscape(t.str('location'))}`] : []),
        ...(t.str('organizer') ? [`ORGANIZER:mailto:${t.str('organizer')}`] : []),
        ...t.list('attendees').map(a => `ATTENDEE;RSVP=TRUE:mailto:${String(a)}`),
        'END:VEVENT',
        'END:VCALENDAR',
      ];
      const ics = lines.join('\r\n');
      return ok({ ics, base64: Buffer.from(ics).toString('base64'), filename: 'invite.ics', uid });
    },
  },
  {
    ...meta(
      'operari.chart',
      'ChartColumn',
      ['Chart image', 'Imagen de gráfico'],
      [
        'Turn data into a chart image URL (QuickChart) for Slack, email or reports',
        'Convertir datos en la URL de una imagen de gráfico (QuickChart) para Slack, email o reportes',
      ]
    ),
    properties: [
      {
        name: 'chartType',
        displayName: 'Type',
        type: 'options',
        default: 'bar',
        options: ['bar', 'line', 'pie', 'doughnut', 'radar'].map(v => ({ name: v, value: v })),
      },
      {
        name: 'labels',
        displayName: 'Labels',
        type: 'string',
        required: true,
        description: 'Comma-separated or a list.',
        typeOptions: { expression: true },
      },
      {
        name: 'data',
        displayName: 'Values',
        type: 'string',
        required: true,
        description: 'Comma-separated numbers or a list.',
        typeOptions: { expression: true },
      },
      {
        name: 'title',
        displayName: 'Series name',
        type: 'string',
        default: 'Value',
        typeOptions: { expression: true },
      },
      { name: 'width', displayName: 'Width', type: 'number', default: 600 },
      { name: 'height', displayName: 'Height', type: 'number', default: 320 },
    ],
    run: t => {
      const data = t.list('data').map(Number);
      if (data.some(n => Number.isNaN(n))) return fail('Values must be numbers');
      const config = {
        type: t.str('chartType'),
        data: { labels: t.list('labels').map(String), datasets: [{ label: t.str('title'), data }] },
      };
      const url = `https://quickchart.io/chart?w=${t.num('width')}&h=${t.num('height')}&c=${encodeURIComponent(JSON.stringify(config))}`;
      return ok({ url, config });
    },
  },
];
