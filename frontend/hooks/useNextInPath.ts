'use client';

import { useEditorStore } from '@/state/editorStore';

/**
 * True when at least one node connected to `nodeId` via an incoming
 * edge has `status === 'running'`. Drives the soft glow on downstream
 * steps so the operator can predict where execution is about to land
 * before the step itself flips to running.
 *
 * Subscribes via Zustand selector so it only re-renders the consuming
 * node when the running set actually changes — drag ticks on unrelated
 * nodes don't propagate here.
 */
export function useNextInPath(nodeId: string): boolean {
  return useEditorStore(s => {
    const incoming = s.edges.filter(e => e.target === nodeId);
    if (incoming.length === 0) return false;
    const sourceIds = new Set(incoming.map(e => e.source));
    return s.nodes.some(n => sourceIds.has(n.id) && n.data?.status === 'running');
  });
}
