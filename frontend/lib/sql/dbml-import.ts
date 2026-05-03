/**
 * DBML → SqlMetadata import.
 *
 * Why this exists:
 *   The schema diagram already accepts a previously-exported metadata
 *   JSON as the comparison baseline (`handleBaselineUpload`). Operators
 *   coming from dbdiagram.io / chartdb / hand-written DBML have no
 *   way to drop their schema in without first running it through a
 *   live Postgres. This module bridges the gap: feed it DBML text,
 *   get back a SqlMetadata payload that flows through the existing
 *   diff + render pipeline unchanged.
 *
 *   The reverse direction (`exportDbml`) has been around since the
 *   diagram shipped — see `dbml-export.ts`. The two halves use the
 *   same `SqlMetadata` shape so a round-trip (export → re-import)
 *   should be lossless for the structural fields the diagram cares
 *   about (tables, columns, PKs, FKs).
 *
 * What is NOT covered:
 *   - DBML enums are dropped. SqlMetadata has no enum type slot —
 *     the diagram would not render them anyway. The column type
 *     field still keeps the enum's name as a string.
 *   - DBML notes are kept on tables/columns; refs lose their notes.
 *   - DBML tableGroups (visual grouping in dbdiagram.io) are dropped.
 *   - `headerColor` / sticky notes / project metadata: dropped.
 *
 * Errors:
 *   Throws `DbmlParseError` on a syntax / shape problem so the UI
 *   can show the parser's diagnostic instead of a generic "invalid
 *   file". The caller is expected to render the message inline.
 */

import { Parser } from '@dbml/core';

import type {
  SqlColumn,
  SqlForeignKey,
  SqlIndex,
  SqlMetadata,
  SqlPrimaryKey,
  SqlTable,
} from './metadata';

export class DbmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbmlParseError';
  }
}

/**
 * Parse a DBML document into the same `SqlMetadata` shape the live
 * Postgres introspection produces. The result feeds the existing
 * diff / render pipeline without any other code-path changes.
 */
export function parseDbml(dbmlText: string): SqlMetadata {
  let exported: ReturnType<typeof exportDatabase>;
  try {
    const database = Parser.parse(dbmlText, 'dbml');
    exported = exportDatabase(database);
  } catch (err) {
    // The dbml compiler throws a structured error; we surface its
    // message verbatim because it usually pinpoints the line/col.
    const msg = err instanceof Error ? err.message : String(err);
    throw new DbmlParseError(msg);
  }

  const tables: SqlTable[] = [];
  const columns: SqlColumn[] = [];
  const primaryKeys: SqlPrimaryKey[] = [];
  const foreignKeys: SqlForeignKey[] = [];
  const indexes: SqlIndex[] = [];

  for (const schema of exported.schemas) {
    const schemaName = schema.name || 'public';
    for (const table of schema.tables) {
      const tableName = table.name;
      tables.push({
        schema: schemaName,
        name: tableName,
        // DBML has no view/materialized-view concept — assume base
        // tables and let exporters that care set the bit downstream.
        isView: false,
        isMaterializedView: false,
        comment: table.note || null,
      });

      const pkCols: string[] = [];
      table.fields.forEach((field, idx) => {
        // Column type can arrive as a string ("int") or an object
        // ({ type_name: "varchar", args: "255" }). Normalise both
        // into the human-readable string the diagram already shows.
        const typeText = stringifyType(field.type);
        const length = extractMaxLength(field.type);
        columns.push({
          schema: schemaName,
          table: tableName,
          name: field.name,
          ordinalPosition: idx + 1,
          type: typeText,
          nullable: field.not_null !== true,
          // DBML's `default: 'now()'` becomes a literal string here.
          // The diagram renders the default as text, so keeping the
          // wire shape simple beats round-tripping through SQL.
          default: stringifyDefault(field.dbdefault),
          isIdentity: field.increment === true,
          isArray: false,
          characterMaximumLength: length,
          precision: null,
          scale: null,
          comment: field.note || null,
        });
        if (field.pk) pkCols.push(field.name);
      });

      // Composite PKs in DBML go through `indexes [pk]` instead of
      // per-field `pk` markers. Catch both forms so the diagram
      // gets a single PK row per table.
      const indexPkCols = collectIndexPkColumns(table.indexes);
      const allPkCols = pkCols.length > 0 ? pkCols : indexPkCols;
      if (allPkCols.length > 0) {
        primaryKeys.push({
          schema: schemaName,
          table: tableName,
          constraintName: `${tableName}_pkey`,
          columns: allPkCols,
        });
      }

      // Non-PK indexes from `Indexes { ... }` blocks.
      table.indexes.forEach((idx, i) => {
        if (idx.pk) return; // covered above
        indexes.push({
          schema: schemaName,
          table: tableName,
          name: idx.name || `${tableName}_idx_${i + 1}`,
          type: idx.type || 'btree',
          unique: idx.unique === true,
          isPrimary: false,
          columns: idx.columns.map(c => String(c.value)),
        });
      });
    }

    // Refs (foreign keys). DBML allows multi-column refs; the
    // SqlForeignKey shape is per-column, so we expand on a 1:1 basis.
    for (const ref of schema.refs) {
      if (ref.endpoints.length !== 2) continue; // malformed
      const [from, to] = ref.endpoints;
      // The "many" side carries the FK column. DBML denotes it via
      // the relation token: `<` / `>` / `-`. The convention is that
      // the `*` (many) side holds the FK; when the relation is `-`
      // (1:1) we default to treating `from` as the FK side.
      const fkSide = inferFkSide(ref);
      const childEndpoint = fkSide === 'from' ? from : to;
      const parentEndpoint = fkSide === 'from' ? to : from;

      const constraintName =
        ref.name || `${childEndpoint.tableName}_${childEndpoint.fieldNames.join('_')}_fkey`;

      const colCount = Math.min(childEndpoint.fieldNames.length, parentEndpoint.fieldNames.length);
      for (let i = 0; i < colCount; i++) {
        foreignKeys.push({
          schema: childEndpoint.schemaName || schemaName,
          table: childEndpoint.tableName,
          constraintName,
          column: childEndpoint.fieldNames[i],
          referencedSchema: parentEndpoint.schemaName || schemaName,
          referencedTable: parentEndpoint.tableName,
          referencedColumn: parentEndpoint.fieldNames[i],
          onDelete: stringifyAction(ref.onDelete),
          onUpdate: stringifyAction(ref.onUpdate),
        });
      }
    }
  }

  return {
    databaseName: exported.project?.name ?? null,
    databaseVersion: exported.project?.database_type ?? null,
    tables,
    columns,
    primaryKeys,
    foreignKeys,
    indexes,
  };
}

// ---------------------------------------------------------------
// internals
// ---------------------------------------------------------------

interface DbmlExportedRef {
  endpoints: Array<{
    schemaName: string;
    tableName: string;
    fieldNames: string[];
    relation: string | '*' | '1';
  }>;
  name?: string | null;
  onDelete?: string | null;
  onUpdate?: string | null;
}

interface DbmlExportedTable {
  name: string;
  alias?: string;
  note?: string;
  fields: Array<{
    name: string;
    type: unknown;
    unique?: boolean;
    pk?: boolean;
    not_null?: boolean;
    note?: string;
    dbdefault?: unknown;
    increment?: boolean;
  }>;
  indexes: Array<{
    columns: Array<{ type?: string; value: unknown }>;
    name?: string;
    type?: string;
    unique?: boolean;
    pk?: boolean | string;
    note?: string;
  }>;
}

interface DbmlExportedSchema {
  name: string;
  tables: DbmlExportedTable[];
  refs: DbmlExportedRef[];
}

interface DbmlExportedDatabase {
  schemas: DbmlExportedSchema[];
  project?: { name?: string; database_type?: string };
}

function exportDatabase(database: unknown): DbmlExportedDatabase {
  // The Database model has both `.export()` and bundled types — the
  // shape we care about is the deeply-nested `schemas[].tables[].fields`
  // tree. Casting through `unknown` keeps this module compatible with
  // both the v2 and v3 lines of @dbml/core (the export() shape is
  // stable across both).
  const dbAny = database as {
    export(): unknown;
    name?: string;
    databaseType?: string;
  };
  const exported = dbAny.export() as Omit<DbmlExportedDatabase, 'project'>;
  // Project metadata lives directly on the Database instance (its
  // `Project app { ... }` block sets `database.name` /
  // `database.databaseType`) rather than on the export(). Pull it
  // out so callers see the same `databaseName` / `databaseVersion`
  // they would get from live introspection.
  const name = typeof dbAny.name === 'string' && dbAny.name ? dbAny.name : undefined;
  const databaseType =
    typeof dbAny.databaseType === 'string' && dbAny.databaseType ? dbAny.databaseType : undefined;
  return {
    ...exported,
    project: name || databaseType ? { name, database_type: databaseType } : undefined,
  };
}

function stringifyType(type: unknown): string {
  if (type == null) return 'unknown';
  if (typeof type === 'string') return type;
  if (typeof type === 'object') {
    const t = type as { type_name?: string; args?: string };
    // The dbml compiler already folds args into `type_name`
    // (e.g. type_name === "varchar(255)"). Only synthesize `(args)`
    // when the args were provided AND type_name doesn't already
    // carry them — defensive against future shape changes.
    if (t.type_name) {
      if (t.args && !t.type_name.includes('(')) {
        return `${t.type_name}(${t.args})`;
      }
      return t.type_name;
    }
  }
  return String(type);
}

function extractMaxLength(type: unknown): number | null {
  if (type == null || typeof type !== 'object') return null;
  const t = type as { type_name?: string; args?: string };
  if (!t.args) return null;
  // Only varchar / char-style types use the int args as a length.
  // Numeric types have `precision,scale` which is a different field.
  const n = Number(t.args.split(',')[0]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function stringifyDefault(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object') {
    const v = value as { value?: unknown; type?: string };
    if (v.value !== undefined) return String(v.value);
  }
  return String(value);
}

function stringifyAction(action: unknown): string | null {
  if (!action) return null;
  if (typeof action === 'string') return action.toUpperCase();
  return null;
}

function collectIndexPkColumns(rawIndexes: DbmlExportedTable['indexes']): string[] {
  const pkIndex = rawIndexes.find(i => i.pk);
  if (!pkIndex) return [];
  return pkIndex.columns.map(c => String(c.value));
}

/**
 * Pick the FK-bearing endpoint (the "many" side of a ref). DBML
 * relation tokens:
 *   `<`  many-to-one (from is many → from holds the FK)
 *   `>`  one-to-many (to is many   → to   holds the FK)
 *   `-`  one-to-one  (default to `from` as the FK side)
 *
 * The `Endpoint.relation` field carries the cardinality marker for
 * THAT endpoint — `*` for many, `1` for one. We pick whichever
 * endpoint is `*`, falling back to `from` when both are `1`.
 */
function inferFkSide(ref: DbmlExportedRef): 'from' | 'to' {
  const [from, to] = ref.endpoints;
  if (from.relation === '*') return 'from';
  if (to.relation === '*') return 'to';
  return 'from';
}
