import { useStore } from '@xyflow/react';

import type { RfNode } from '@/lib/canvas/adapter';

import { NODE_CATALOG } from '../catalog';

/**
 * True when the source node of an edge is `enabled === false` on its
 * workflow data. Subscribes via React Flow's store so only the edges
 * whose source toggled re-render — cheaper than reading the editor
 * store wholesale, since the React Flow store is pre-indexed by node
 * id (`nodeLookup`).
 *
 * Pairs with the disabled-propagation CSS in globals.css: when this
 * returns true, the edge gets `data-source-disabled` and the styling
 * collapses to dashed + muted, matching n8n's "disabled steps fade
 * their downstream wiring" convention so the operator can tell
 * straight away why a chain isn't going to run.
 */
export function useEdgeSourceDisabled(sourceId: string): boolean {
  return useStore(s => {
    const node = s.nodeLookup.get(sourceId) as RfNode | undefined;
    return node?.data?.workflow?.enabled === false;
  });
}

/**
 * True when the source node has more than one declared output port
 * (IF, Switch, future fanout). Used by the edge to decide whether
 * to render a "taken last" badge — branch nodes fan out N edges,
 * exactly one of which fired last run, and surfacing which is a
 * post-mortem signal that costs ~0 once node statuses are known.
 *
 * Reads the static catalog (NODE_CATALOG.outputs.length) rather than
 * the live `outputs` array on the React Flow node — both should
 * agree, but the catalog is the source of truth and means we don't
 * pay a re-render when the operator just wiggles a position.
 */
export function useSourceIsMultiOutput(sourceId: string): boolean {
  return useStore(s => {
    const node = s.nodeLookup.get(sourceId) as RfNode | undefined;
    if (!node?.type) return false;
    const def = NODE_CATALOG.get(node.type);
    return (def?.outputs?.length ?? 1) > 1;
  });
}
