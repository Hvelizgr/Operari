import type { Edge, Node } from '@xyflow/react';

import type { TableDiff } from '@/lib/sql/diff';
import type { GroupedTable, SqlForeignKey } from '@/lib/sql/metadata';

export type FkDiffStatus = 'added' | 'removed' | 'unchanged';

export type SchemaNodeData = {
  table: GroupedTable;
  /** Table-level diff status when the diagram is rendering a
   *  comparison. Undefined means no diff is active — TableNode
   *  falls back to its default color in that case. */
  diff?: TableDiff;
};

export type SchemaNode = Node<SchemaNodeData, 'schema.table'>;

export type SchemaEdgeData = {
  fk: SqlForeignKey;
  diff?: FkDiffStatus;
};

export type SchemaEdge = Edge<SchemaEdgeData, 'schema.fk'>;

export const tableNodeId = (schema: string, name: string): string => `${schema}.${name}`;

/**
 * The handle id encodes both the column name and the side. We expose
 * one source + one target handle per column so a relationship lands
 * exactly on the field it references — same convention chartdb uses
 * (table_rel_source_<column> / table_rel_target_<column>) but trimmed.
 */
export const columnHandleId = (column: string, side: 'src' | 'tgt'): string => `${side}.${column}`;
