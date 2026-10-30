import { MongoClient } from 'mongodb';
import mysql from 'mysql2/promise';

import { blockedTarget } from '../../security/ssrf-guard';
import { type CatalogNode, fail, MAIN, ok, StepInputError } from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'data',
  icon,
  color: 'bg-blue-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const timeout = {
  name: 'timeout',
  displayName: 'Timeout (ms)',
  type: 'number' as const,
  default: 30000,
};

/** Hosts named in a connection string (Mongo allows a comma-separated list). */
function hostsOf(uri: string): string[] {
  const m = /^[a-z+]+:\/\/(?:[^@/]*@)?([^/?#]+)/i.exec(uri);
  if (!m) throw new StepInputError('connection string is not a valid URI');
  return m[1].split(',').map(h => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, ''));
}

async function guardHosts(uri: string, step: string): Promise<string | null> {
  for (const host of hostsOf(uri)) {
    const blocked = await blockedTarget('host', host);
    if (blocked) return `${step}: ${blocked}`;
  }
  return null;
}

export const DATABASE_NODES: CatalogNode[] = [
  {
    ...meta(
      'mysql.query',
      'Database',
      ['MySQL / MariaDB', 'MySQL / MariaDB'],
      [
        'Run a SQL query against MySQL or MariaDB (read-only by default)',
        'Ejecutar una consulta SQL contra MySQL o MariaDB (solo lectura por defecto)',
      ]
    ),
    properties: [
      {
        name: 'connection',
        displayName: 'Connection string',
        type: 'secret',
        required: true,
        description: 'mysql://user:password@host:3306/database',
      },
      {
        name: 'query',
        displayName: 'SQL',
        type: 'string',
        required: true,
        description: 'Use ? placeholders and pass values below.',
        typeOptions: { rows: 5, expression: true },
      },
      {
        name: 'params',
        displayName: 'Parameters (JSON array)',
        type: 'string',
        typeOptions: { rows: 2, expression: true },
      },
      {
        name: 'readOnly',
        displayName: 'Read only',
        type: 'boolean',
        default: true,
        description: 'Runs inside a READ ONLY transaction; writes fail.',
      },
      { name: 'maxRows', displayName: 'Max rows returned', type: 'number', default: 1000 },
      timeout,
    ],
    run: async t => {
      const uri = t.str('connection');
      if (!/^mysql:\/\//.test(uri)) throw new StepInputError('connection must start with mysql://');
      const blocked = await guardHosts(uri, 'mysql');
      if (blocked) return fail(blocked);
      if (t.context.dryRun) return ok({ dryRun: true, query: t.str('query').slice(0, 500) });

      const conn = await mysql.createConnection({ uri, connectTimeout: t.num('timeout') });
      try {
        const readOnly = t.bool('readOnly');
        if (readOnly) await conn.query('START TRANSACTION READ ONLY');
        const [result, fields] = await conn.query({
          sql: t.str('query'),
          values: t.json<unknown[]>('params', []),
          timeout: t.num('timeout'),
        });
        if (readOnly) await conn.query('COMMIT');
        if (Array.isArray(result)) {
          const rows = result as unknown[];
          const max = Math.max(1, t.num('maxRows'));
          return ok({
            rows: rows.slice(0, max),
            rowCount: rows.length,
            truncated: rows.length > max,
            columns: (fields ?? []).map(f => f.name),
          });
        }
        const r = result as { affectedRows?: number; insertId?: number };
        return ok({ affectedRows: r.affectedRows ?? 0, insertId: r.insertId ?? null });
      } finally {
        await conn.end().catch(() => undefined);
      }
    },
  },
  {
    ...meta(
      'mongodb.action',
      'Leaf',
      ['MongoDB', 'MongoDB'],
      [
        'Find, count, aggregate, insert, update or delete documents in a collection',
        'Buscar, contar, agregar, insertar, actualizar o borrar documentos de una colección',
      ]
    ),
    properties: [
      {
        name: 'uri',
        displayName: 'Connection string',
        type: 'secret',
        required: true,
        description: 'mongodb://… or mongodb+srv://…',
      },
      { name: 'database', displayName: 'Database', type: 'string', required: true },
      { name: 'collection', displayName: 'Collection', type: 'string', required: true },
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'find',
        options: [
          { name: 'Find', value: 'find' },
          { name: 'Count', value: 'count' },
          { name: 'Aggregate', value: 'aggregate' },
          { name: 'Insert one', value: 'insertOne' },
          { name: 'Update many', value: 'updateMany' },
          { name: 'Delete many', value: 'deleteMany' },
        ],
      },
      {
        name: 'filter',
        displayName: 'Filter (JSON)',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 3, expression: true },
        displayOptions: { show: { action: ['find', 'count', 'updateMany', 'deleteMany'] } },
      },
      {
        name: 'pipeline',
        displayName: 'Pipeline (JSON array)',
        type: 'string',
        required: true,
        typeOptions: { rows: 5, expression: true },
        displayOptions: { show: { action: ['aggregate'] } },
      },
      {
        name: 'document',
        displayName: 'Document (JSON)',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
        displayOptions: { show: { action: ['insertOne'] } },
      },
      {
        name: 'update',
        displayName: 'Update (JSON)',
        type: 'string',
        required: true,
        description: 'e.g. {"$set": {"status": "resolved"}}',
        typeOptions: { rows: 3, expression: true },
        displayOptions: { show: { action: ['updateMany'] } },
      },
      {
        name: 'limit',
        displayName: 'Limit',
        type: 'number',
        default: 100,
        displayOptions: { show: { action: ['find', 'aggregate'] } },
      },
      timeout,
    ],
    run: async t => {
      const uri = t.str('uri');
      if (!/^mongodb(\+srv)?:\/\//.test(uri))
        throw new StepInputError('uri must start with mongodb:// or mongodb+srv://');
      const blocked = await guardHosts(uri, 'mongodb');
      if (blocked) return fail(blocked);
      const action = t.str('action');
      const writes = action === 'insertOne' || action === 'updateMany' || action === 'deleteMany';
      if (t.context.dryRun && writes) return ok({ dryRun: true, action });

      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: t.num('timeout'),
        socketTimeoutMS: t.num('timeout'),
      });
      try {
        await client.connect();
        const coll = client.db(t.str('database')).collection(t.str('collection'));
        const filter = t.json<Record<string, unknown>>('filter', {});
        const limit = Math.max(1, t.num('limit'));
        switch (action) {
          case 'count':
            return ok({ count: await coll.countDocuments(filter) });
          case 'aggregate': {
            const docs = await coll
              .aggregate(t.json<Record<string, unknown>[]>('pipeline', []))
              .limit(limit)
              .toArray();
            return ok({ documents: docs, count: docs.length });
          }
          case 'insertOne': {
            const r = await coll.insertOne(t.json<Record<string, unknown>>('document', {}));
            return ok({ insertedId: String(r.insertedId) });
          }
          case 'updateMany': {
            const r = await coll.updateMany(filter, t.json<Record<string, unknown>>('update', {}));
            return ok({ matched: r.matchedCount, modified: r.modifiedCount });
          }
          case 'deleteMany': {
            if (Object.keys(filter).length === 0) {
              throw new StepInputError(
                'refusing to delete with an empty filter; match something explicitly'
              );
            }
            const r = await coll.deleteMany(filter);
            return ok({ deleted: r.deletedCount });
          }
          default: {
            const docs = await coll.find(filter).limit(limit).toArray();
            return ok({ documents: docs, count: docs.length });
          }
        }
      } finally {
        await client.close().catch(() => undefined);
      }
    },
  },
];
