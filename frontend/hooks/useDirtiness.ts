'use client';

import { useMemo } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { computeDirtinessMap, type DirtinessKind, type DirtinessMap } from '@/lib/canvas/dirtiness';
import { useEditorStore } from '@/state/editorStore';

/**
 * Compute the canvas-wide dirtiness map once per render and return
 * it. Cheaper than each node computing its own kind (N walks of the
 * full DAG vs one), and the map is reference-stable across renders
 * where nothing relevant changed because the upstream selectors
 * (nodes / edges / fingerprints) only emit new objects on actual
 * state mutations.
 *
 * The hook is intentionally narrow: it does NOT subscribe to ad-hoc
 * UI state (selection, hover, inspector id). The dirtiness signal
 * is independent of those, so a re-render triggered by selection
 * change should NOT recompute the whole map.
 */
export function useDirtinessMap(): DirtinessMap {
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const snapshot = useEditorStore(s => s.lastRunFingerprints);

  return useMemo(() => {
    if (Object.keys(snapshot).length === 0) return new Map();
    return computeDirtinessMap(nodes, edges, snapshot);
  }, [nodes, edges, snapshot]);
}

/**
 * Per-node convenience: returns the dirtiness kind for a single node
 * id, or null when the node is clean. Reads off the same memoized
 * map so multiple nodes calling this in one render share the
 * compute.
 */
export function useNodeDirtiness(id: string): DirtinessKind | null {
  const map = useDirtinessMap();
  return map.get(id) ?? null;
}
