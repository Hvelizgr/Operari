import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';

import {
  workflowConnectionToRfEdge,
  workflowNodeToRfNode,
  type RfEdge,
  type RfNode,
} from './adapter';

/**
 * Incrementally reconcile the React Flow canvas state against a fresh
 * workflow definition (typically arriving from a YAML edit). Unlike
 * `workflowToRf`, which builds a brand-new node list, this walks the
 * incoming `WorkflowNode[]` against the current RF state by id and:
 *
 *   - **kept**: node stays in place. We refresh `data` (label,
 *     config, workflow body) but preserve `position`, `selected`,
 *     and any other RF-managed transient fields. This is the "magic"
 *     of chartdb's apply-dbml — editing a column doesn't snap the
 *     whole table back to its layout origin.
 *   - **added**: node didn't exist before. We use the position from
 *     the workflow definition, with a layout fallback if the YAML
 *     omitted x/y.
 *   - **removed**: node existed before, isn't in the new set. Drops.
 *
 * Same logic for edges, keyed by id. Edge data is replaced wholesale
 * (no transient state on edges to preserve).
 *
 * Pure function. The store action that calls this remains responsible
 * for sorting frames before children and clearing the undo history if
 * the runbook id changed.
 */

export interface ReconcileResult {
  nodes: RfNode[];
  edges: RfEdge[];
  changes: {
    nodesKept: number;
    nodesAdded: number;
    nodesRemoved: number;
    edgesKept: number;
    edgesAdded: number;
    edgesRemoved: number;
  };
}

export function reconcileWorkflow(
  current: { nodes: RfNode[]; edges: RfEdge[] },
  next: { nodes: WorkflowNode[]; connections: WorkflowConnection[] }
): ReconcileResult {
  const nextNodeIds = new Set(next.nodes.map(n => n.id));
  const nextEdgeIds = new Set(next.connections.map(c => c.id));

  const currentNodesById = new Map(current.nodes.map(n => [n.id, n]));
  const currentEdgesById = new Map(current.edges.map(e => [e.id, e]));

  let nodesKept = 0;
  let nodesAdded = 0;
  let nodesRemoved = 0;
  let edgesKept = 0;
  let edgesAdded = 0;
  let edgesRemoved = 0;

  const reconciledNodes: RfNode[] = [];
  for (const wfNode of next.nodes) {
    const existing = currentNodesById.get(wfNode.id);
    if (existing) {
      // Refresh `data` from the new workflow body but keep RF's
      // transient fields (position, selected, dragging, parentId,
      // measured dimensions). The adapter computes the canonical RF
      // shape; we then overwrite the position-y bits with the kept
      // values so layout doesn't snap.
      const fresh = workflowNodeToRfNode(wfNode);
      reconciledNodes.push({
        ...fresh,
        position: existing.position,
        selected: existing.selected,
        dragging: existing.dragging,
        measured: existing.measured,
      });
      nodesKept += 1;
    } else {
      reconciledNodes.push(workflowNodeToRfNode(wfNode));
      nodesAdded += 1;
    }
  }
  for (const node of current.nodes) {
    if (!nextNodeIds.has(node.id)) nodesRemoved += 1;
  }

  const reconciledEdges: RfEdge[] = [];
  for (const wfEdge of next.connections) {
    const existing = currentEdgesById.get(wfEdge.id);
    const fresh = workflowConnectionToRfEdge(wfEdge);
    if (existing) {
      // Edges have no draggable state, but `selected` survives so
      // a partial reconcile doesn't deselect everything.
      reconciledEdges.push({ ...fresh, selected: existing.selected });
      edgesKept += 1;
    } else {
      reconciledEdges.push(fresh);
      edgesAdded += 1;
    }
  }
  for (const edge of current.edges) {
    if (!nextEdgeIds.has(edge.id)) edgesRemoved += 1;
  }

  return {
    nodes: reconciledNodes,
    edges: reconciledEdges,
    changes: {
      nodesKept,
      nodesAdded,
      nodesRemoved,
      edgesKept,
      edgesAdded,
      edgesRemoved,
    },
  };
}
