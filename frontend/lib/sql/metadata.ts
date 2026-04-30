import { z } from 'zod';

/**
 * Typed contract for the `/api/sql/metadata` endpoint. Keeps the
 * introspection shape narrow — a tightly-scoped subset of chartdb's
 * `DatabaseMetadata` (AGPL-3.0, see docs/research/chartdb-research.md)
 * focused on the bits the schema diagram needs today.
 *
 * The split between `tables` / `columns` / `primaryKeys` / `foreignKeys`
 * / `indexes` mirrors PostgreSQL's catalog more directly than a deeply
 * nested `Table.fields[].pk` shape would. The diagram derives a
 * grouped view in `groupMetadata` below.
 */

export const sqlColumnSchema = z.object({
  schema: z.string(),
  table: z.string(),
  name: z.string(),
  ordinalPosition: z.number(),
  type: z.string(),
  nullable: z.boolean(),
  default: z.string().nullable(),
  isIdentity: z.boolean(),
  isArray: z.boolean(),
  characterMaximumLength: z.number().nullable(),
  precision: z.number().nullable(),
  scale: z.number().nullable(),
  comment: z.string().nullable(),
});
export type SqlColumn = z.infer<typeof sqlColumnSchema>;

export const sqlTableSchema = z.object({
  schema: z.string(),
  name: z.string(),
  isView: z.boolean(),
  isMaterializedView: z.boolean(),
  comment: z.string().nullable(),
});
export type SqlTable = z.infer<typeof sqlTableSchema>;

export const sqlPrimaryKeySchema = z.object({
  schema: z.string(),
  table: z.string(),
  constraintName: z.string(),
  columns: z.array(z.string()),
});
export type SqlPrimaryKey = z.infer<typeof sqlPrimaryKeySchema>;

export const sqlForeignKeySchema = z.object({
  schema: z.string(),
  table: z.string(),
  constraintName: z.string(),
  column: z.string(),
  referencedSchema: z.string(),
  referencedTable: z.string(),
  referencedColumn: z.string(),
  onDelete: z.string().nullable(),
  onUpdate: z.string().nullable(),
});
export type SqlForeignKey = z.infer<typeof sqlForeignKeySchema>;

export const sqlIndexSchema = z.object({
  schema: z.string(),
  table: z.string(),
  name: z.string(),
  type: z.string(),
  unique: z.boolean(),
  isPrimary: z.boolean(),
  columns: z.array(z.string()),
});
export type SqlIndex = z.infer<typeof sqlIndexSchema>;

export const sqlMetadataSchema = z.object({
  databaseName: z.string().nullable(),
  databaseVersion: z.string().nullable(),
  tables: z.array(sqlTableSchema),
  columns: z.array(sqlColumnSchema),
  primaryKeys: z.array(sqlPrimaryKeySchema),
  foreignKeys: z.array(sqlForeignKeySchema),
  indexes: z.array(sqlIndexSchema),
  durationMs: z.number().optional(),
});
export type SqlMetadata = z.infer<typeof sqlMetadataSchema>;

export const tableKey = (schema: string, name: string): string => `${schema}.${name}`;

export interface GroupedTable {
  schema: string;
  name: string;
  isView: boolean;
  isMaterializedView: boolean;
  comment: string | null;
  columns: SqlColumn[];
  primaryKeyColumns: ReadonlySet<string>;
  foreignKeyColumns: ReadonlySet<string>;
  indexes: SqlIndex[];
}

export interface GroupedMetadata {
  tables: GroupedTable[];
  byKey: Map<string, GroupedTable>;
  schemas: string[];
  foreignKeys: SqlForeignKey[];
}

/**
 * Re-shape the flat catalog payload into the grouped form the diagram
 * renderer wants: one entry per table with its columns / PK / FK /
 * index lookups already attached. Keeps the renderer pure (no map
 * lookups inside React render paths) and lets us memoize on the raw
 * metadata reference.
 */
export function groupMetadata(meta: SqlMetadata): GroupedMetadata {
  const byKey = new Map<string, GroupedTable>();
  for (const t of meta.tables) {
    byKey.set(tableKey(t.schema, t.name), {
      schema: t.schema,
      name: t.name,
      isView: t.isView,
      isMaterializedView: t.isMaterializedView,
      comment: t.comment,
      columns: [],
      primaryKeyColumns: new Set(),
      foreignKeyColumns: new Set(),
      indexes: [],
    });
  }

  for (const c of meta.columns) {
    const bucket = byKey.get(tableKey(c.schema, c.table));
    if (bucket) bucket.columns.push(c);
  }

  for (const pk of meta.primaryKeys) {
    const bucket = byKey.get(tableKey(pk.schema, pk.table));
    if (!bucket) continue;
    const set = bucket.primaryKeyColumns as Set<string>;
    for (const col of pk.columns) set.add(col);
  }

  for (const fk of meta.foreignKeys) {
    const bucket = byKey.get(tableKey(fk.schema, fk.table));
    if (!bucket) continue;
    (bucket.foreignKeyColumns as Set<string>).add(fk.column);
  }

  for (const idx of meta.indexes) {
    const bucket = byKey.get(tableKey(idx.schema, idx.table));
    if (bucket) bucket.indexes.push(idx);
  }

  for (const bucket of byKey.values()) {
    bucket.columns.sort((a, b) => a.ordinalPosition - b.ordinalPosition);
  }

  const tables = Array.from(byKey.values()).sort((a, b) => {
    if (a.isView !== b.isView) return a.isView ? 1 : -1;
    if (a.schema !== b.schema) return a.schema.localeCompare(b.schema);
    return a.name.localeCompare(b.name);
  });

  const schemas = Array.from(new Set(tables.map(t => t.schema))).sort();

  return { tables, byKey, schemas, foreignKeys: meta.foreignKeys };
}

// Integer-family types where `(precision, scale)` is implicit in the
// type name. PG returns numeric_precision = 32 / 64 / 16 for these
// even though no DDL author writes `integer(32,0)`. Without this
// guard the diagram + DBML export get unnecessarily noisy.
const IMPLICIT_PRECISION_TYPES = new Set([
  'integer',
  'bigint',
  'smallint',
  'serial',
  'bigserial',
  'smallserial',
  'real',
  'double precision',
]);

/**
 * Format a column type for display, e.g. `varchar(255)` or
 * `numeric(10,2)`. Trims attributes that don't apply (no precision on
 * `text`, no length on `integer`). Mirrors how psql `\d` renders types
 * so an SRE reading the diagram doesn't have to translate.
 */
export function formatColumnType(c: SqlColumn): string {
  if (c.characterMaximumLength != null) return `${c.type}(${c.characterMaximumLength})`;
  if (c.precision != null && !IMPLICIT_PRECISION_TYPES.has(c.type.toLowerCase())) {
    return c.scale != null ? `${c.type}(${c.precision},${c.scale})` : `${c.type}(${c.precision})`;
  }
  return c.type;
}
