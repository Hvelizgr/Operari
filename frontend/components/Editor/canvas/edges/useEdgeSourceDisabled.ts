import { useStore } from '@xyflow/react';

import type { RfNode } from '@/lib/canvas/adapter';

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
