import { tableKey, type SqlColumn, type SqlForeignKey, type SqlMetadata } from './metadata';

/**
 * Stage two `SqlMetadata` payloads against each other and produce a
 * per-entity status map the diagram can use for coloring. We diff
 * three things:
 *
 *   - Tables: existence (added / removed) and view-flag changes.
 *   - Columns within each table: existence (added / removed) and
 *     attribute changes (type, nullable, default, identity).
 *   - Foreign keys: existence by `constraintName`.
 *
 * `current` is the live snapshot you're looking at; `base` is what
 * you compared *against*. Tables present in `current` but not in
 * `base` are `added`; tables present in `base` but not in `current`
 * are `removed`. Anything with attribute changes is `changed`. The
 * names match chartdb's diff vocabulary so the UI vocabulary stays
 * consistent across views.
 *
 * Pure function. No I/O, no React.
 */

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface ColumnDiff {
  name: string;
  status: DiffStatus;
  before: SqlColumn | null;
  after: SqlColumn | null;
  changedFields: string[];
}

export interface TableDiff {
  schema: string;
  name: string;
  status: DiffStatus;
  columns: ColumnDiff[];
  /** Tables that exist in only one snapshot expose a "ghost" entry
   *  on the missing side so the diagram can render a placeholder
   *  for `removed` tables instead of dropping them silently. */
  side: 'current' | 'base' | 'both';
}

export interface SchemaDiff {
  tables: Map<string, TableDiff>;
  /** Set of foreign-key constraintNames that exist in `current` but
   *  not in `base` (i.e. newly-introduced references). */
  addedForeignKeys: Set<string>;
  /** Set of foreign-key constraintNames that disappeared. */
  removedForeignKeys: Set<string>;
  /** Aggregate counters the UI uses for the status pill. */
  counts: {
    addedTables: number;
    removedTables: number;
    changedTables: number;
    addedColumns: number;
    removedColumns: number;
    changedColumns: number;
    addedForeignKeys: number;
    removedForeignKeys: number;
  };
}

const COLUMN_FIELDS_TO_COMPARE: Array<keyof SqlColumn> = [
  'type',
  'nullable',
  'default',
  'isIdentity',
  'isArray',
  'characterMaximumLength',
  'precision',
  'scale',
];

function diffColumns(beforeCols: SqlColumn[], afterCols: SqlColumn[]): ColumnDiff[] {
  const beforeByName = new Map(beforeCols.map(c => [c.name, c]));
  const afterByName = new Map(afterCols.map(c => [c.name, c]));
  const allNames = new Set<string>([...beforeByName.keys(), ...afterByName.keys()]);

  const diffs: ColumnDiff[] = [];
  for (const name of allNames) {
    const before = beforeByName.get(name) ?? null;
    const after = afterByName.get(name) ?? null;
    if (before && !after) {
      diffs.push({ name, status: 'removed', before, after: null, changedFields: [] });
      continue;
    }
    if (!before && after) {
      diffs.push({ name, status: 'added', before: null, after, changedFields: [] });
      continue;
    }
    if (before && after) {
      const changedFields: string[] = [];
      for (const field of COLUMN_FIELDS_TO_COMPARE) {
        if (before[field] !== after[field]) changedFields.push(field as string);
      }
      diffs.push({
        name,
        status: changedFields.length > 0 ? 'changed' : 'unchanged',
        before,
        after,
        changedFields,
      });
    }
  }
  return diffs;
}

function fkKey(fk: SqlForeignKey): string {
  return `${fk.schema}.${fk.table}.${fk.constraintName}`;
}

function bucketColumnsByTable(columns: SqlColumn[]): Map<string, SqlColumn[]> {
  const out = new Map<string, SqlColumn[]>();
  for (const col of columns) {
    const key = tableKey(col.schema, col.table);
    let bucket = out.get(key);
    if (!bucket) {
      bucket = [];
      out.set(key, bucket);
    }
    bucket.push(col);
  }
  return out;
}

export function diffMetadata(base: SqlMetadata, current: SqlMetadata): SchemaDiff {
  const baseTables = new Map(base.tables.map(t => [tableKey(t.schema, t.name), t] as const));
  const currentTables = new Map(current.tables.map(t => [tableKey(t.schema, t.name), t] as const));
  const allKeys = new Set<string>([...baseTables.keys(), ...currentTables.keys()]);

  const baseCols = bucketColumnsByTable(base.columns);
  const currentCols = bucketColumnsByTable(current.columns);

  const tables = new Map<string, TableDiff>();
  let addedTables = 0;
  let removedTables = 0;
  let changedTables = 0;
  let addedColumns = 0;
  let removedColumns = 0;
  let changedColumns = 0;

  for (const key of allKeys) {
    const baseTable = baseTables.get(key);
    const currentTable = currentTables.get(key);

    if (!baseTable && currentTable) {
      const cols: ColumnDiff[] = (currentCols.get(key) ?? []).map(c => ({
        name: c.name,
        status: 'added',
        before: null,
        after: c,
        changedFields: [],
      }));
      addedTables += 1;
      addedColumns += cols.length;
      tables.set(key, {
        schema: currentTable.schema,
        name: currentTable.name,
        status: 'added',
        columns: cols,
        side: 'current',
      });
      continue;
    }
    if (baseTable && !currentTable) {
      const cols: ColumnDiff[] = (baseCols.get(key) ?? []).map(c => ({
        name: c.name,
        status: 'removed',
        before: c,
        after: null,
        changedFields: [],
      }));
      removedTables += 1;
      removedColumns += cols.length;
      tables.set(key, {
        schema: baseTable.schema,
        name: baseTable.name,
        status: 'removed',
        columns: cols,
        side: 'base',
      });
      continue;
    }
    if (baseTable && currentTable) {
      const cols = diffColumns(baseCols.get(key) ?? [], currentCols.get(key) ?? []);
      let perTableStatus: DiffStatus = 'unchanged';
      for (const c of cols) {
        if (c.status === 'added') addedColumns += 1;
        else if (c.status === 'removed') removedColumns += 1;
        else if (c.status === 'changed') changedColumns += 1;
        if (c.status !== 'unchanged') perTableStatus = 'changed';
      }
      // View flag flips count as a change too.
      if (
        baseTable.isView !== currentTable.isView ||
        baseTable.isMaterializedView !== currentTable.isMaterializedView
      ) {
        perTableStatus = 'changed';
      }
      if (perTableStatus === 'changed') changedTables += 1;
      tables.set(key, {
        schema: currentTable.schema,
        name: currentTable.name,
        status: perTableStatus,
        columns: cols,
        side: 'both',
      });
    }
  }

  const baseFkKeys = new Set(base.foreignKeys.map(fkKey));
  const currentFkKeys = new Set(current.foreignKeys.map(fkKey));
  const addedForeignKeys = new Set<string>();
  const removedForeignKeys = new Set<string>();
  for (const fk of currentFkKeys) {
    if (!baseFkKeys.has(fk)) addedForeignKeys.add(fk);
  }
  for (const fk of baseFkKeys) {
    if (!currentFkKeys.has(fk)) removedForeignKeys.add(fk);
  }

  return {
    tables,
    addedForeignKeys,
    removedForeignKeys,
    counts: {
      addedTables,
      removedTables,
      changedTables,
      addedColumns,
      removedColumns,
      changedColumns,
      addedForeignKeys: addedForeignKeys.size,
      removedForeignKeys: removedForeignKeys.size,
    },
  };
}
