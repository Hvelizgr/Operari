import type { GroupedMetadata } from '@/lib/sql/metadata';

import type { SchemaEdge, SchemaNode } from './types';
import { columnHandleId, tableNodeId } from './types';

const TABLE_WIDTH = 280;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 38;

interface ElkChild {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkChild[];
  edges: ElkEdge[];
}

const tableHeight = (rows: number): number => HEADER_HEIGHT + rows * ROW_HEIGHT;

/**
 * Lay out the schema graph using elkjs's `layered` algorithm with FK
 * direction driving the flow (parent table left, child table right).
 * Tables with no relationships fall into a separate column on the
 * right so they don't crowd the FK chains.
 *
 * elkjs is loaded lazily — the diagram tab is the only consumer of
 * the layout helper, so we don't pay the cost on the SQL editor's
 * default load.
 */
export async function layoutSchema(
  metadata: GroupedMetadata
): Promise<{ nodes: SchemaNode[]; edges: SchemaEdge[] }> {
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELK();

  const children: ElkChild[] = metadata.tables.map(t => ({
    id: tableNodeId(t.schema, t.name),
    width: TABLE_WIDTH,
    height: tableHeight(t.columns.length),
  }));

  // Each FK becomes a directed edge for layout purposes. Self-references
  // (a table with a FK to itself) are dropped from the layout graph
  // because elkjs's layered algorithm can't lay them out and they'd
  // either crash or produce a degenerate position.
  const edges: ElkEdge[] = metadata.foreignKeys
    .filter(
      fk =>
        tableNodeId(fk.schema, fk.table) !== tableNodeId(fk.referencedSchema, fk.referencedTable)
    )
    .map((fk, idx) => ({
      id: `fk-${idx}`,
      sources: [tableNodeId(fk.referencedSchema, fk.referencedTable)],
      targets: [tableNodeId(fk.schema, fk.table)],
    }));

  const graph: ElkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '60',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
    },
    children,
    edges,
  };

  const result = (await elk.layout(graph)) as { children?: ElkChild[] };
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    if (child.x != null && child.y != null) {
      positions.set(child.id, { x: child.x, y: child.y });
    }
  }

  const nodes: SchemaNode[] = metadata.tables.map(table => {
    const id = tableNodeId(table.schema, table.name);
    const pos = positions.get(id) ?? { x: 0, y: 0 };
    return {
      id,
      type: 'schema.table',
      position: pos,
      data: { table },
      width: TABLE_WIDTH,
      // Height is left to RF to measure from the rendered DOM so the
      // node grows with column count without us having to redo math.
    };
  });

  const edgeNodes: SchemaEdge[] = metadata.foreignKeys.map((fk, idx) => ({
    id: `fk-${fk.schema}.${fk.table}.${fk.constraintName}-${idx}`,
    source: tableNodeId(fk.referencedSchema, fk.referencedTable),
    sourceHandle: columnHandleId(fk.referencedColumn, 'src'),
    target: tableNodeId(fk.schema, fk.table),
    targetHandle: columnHandleId(fk.column, 'tgt'),
    type: 'schema.fk',
    data: { fk },
  }));

  return { nodes, edges: edgeNodes };
}
