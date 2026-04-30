'use client';

import { type Connection, type IsValidConnection, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/v2/adapter';

export function useIsValidConnection(): IsValidConnection<RfEdge> {
  const { getNodes, getEdges } = useReactFlow<RfNode, RfEdge>();

  return useCallback<IsValidConnection<RfEdge>>(
    (connection: Connection | RfEdge) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const edges = getEdges();
      // BFS from `target` along existing edges. If we reach `source`,
      // adding `source → target` would close a cycle.
      const adj = new Map<string, string[]>();
      for (const e of edges) {
        if (!adj.has(e.source)) adj.set(e.source, []);
        adj.get(e.source)!.push(e.target);
      }
      const seen = new Set<string>();
      const stack: string[] = [connection.target];
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur === connection.source) return false;
        if (seen.has(cur)) continue;
        seen.add(cur);
        const outs = adj.get(cur);
        if (outs) stack.push(...outs);
      }
      // Make sure both endpoints exist.
      const nodes = getNodes();
      const has = (id: string) => nodes.some(n => n.id === id);
      return has(connection.source) && has(connection.target);
    },
    [getEdges, getNodes]
  );
}
