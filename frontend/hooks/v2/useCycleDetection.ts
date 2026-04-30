'use client';

import { useEffect } from 'react';

import type { RfEdge } from '@/lib/canvas/v2/adapter';
import { useEditorStoreV2 } from '@/state/editorStoreV2';

export const findCyclicEdgeIds = (edges: RfEdge[]): Set<string> => {
  const cyclic = new Set<string>();
  // Build adjacency once for O(V+E) DFS per edge instead of scanning the
  // full edge list inside the inner loop.
  const adj = new Map<string, Array<{ edgeId: string; target: string }>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ edgeId: e.id, target: e.target });
  }
  for (const e of edges) {
    if (e.source === e.target) {
      cyclic.add(e.id);
      continue;
    }
    const visited = new Set<string>();
    const stack: string[] = [e.target];
    let found = false;
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === e.source) {
        found = true;
        break;
      }
      if (visited.has(cur)) continue;
      visited.add(cur);
      const outs = adj.get(cur);
      if (!outs) continue;
      for (const out of outs) {
        if (out.edgeId === e.id) continue;
        stack.push(out.target);
      }
    }
    if (found) cyclic.add(e.id);
  }
  return cyclic;
};

export function useCycleDetection() {
  const edges = useEditorStoreV2(s => s.edges);
  const updateEdgeData = useEditorStoreV2(s => s.updateEdgeData);

  useEffect(() => {
    const cyclic = findCyclicEdgeIds(edges);
    for (const edge of edges) {
      const should = cyclic.has(edge.id);
      const has = !!edge.data?.cyclic;
      if (should !== has) updateEdgeData(edge.id, { cyclic: should });
    }
  }, [edges, updateEdgeData]);
}
