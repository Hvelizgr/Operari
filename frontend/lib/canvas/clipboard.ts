import type { RfEdge, RfNode } from './adapter';
import { getDescendantIds } from './graph';

const PASTE_OFFSET = { x: 40, y: 40 } as const;

export interface ClipboardSnapshot {
  nodes: RfNode[];
  edges: RfEdge[];
}

let clipboard: ClipboardSnapshot | null = null;

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Capture the selection. Frames automatically pull every descendant
 * along so a copied frame always pastes as a coherent group. Edges
 * survive only when both endpoints are part of the captured set —
 * dangling edges would point at non-existent IDs after paste.
 */
export const buildSnapshot = (
  selectedIds: string[],
  allNodes: RfNode[],
  allEdges: RfEdge[]
): ClipboardSnapshot => {
  const captured = new Set(selectedIds);
  for (const id of selectedIds) {
    for (const desc of getDescendantIds(id, allNodes)) captured.add(desc);
  }
  const nodes = allNodes.filter(n => captured.has(n.id));
  const edges = allEdges.filter(e => captured.has(e.source) && captured.has(e.target));
  return {
    nodes: nodes.map(n => ({ ...n })),
    edges: edges.map(e => ({ ...e, data: { ...(e.data ?? {}) } })),
  };
};

export const copyToClipboard = (snapshot: ClipboardSnapshot): void => {
  clipboard = snapshot;
};

export const readClipboard = (): ClipboardSnapshot | null => clipboard;

/**
 * Produce fresh nodes/edges with regenerated IDs, offset positions, and
 * remapped parent / edge endpoints. If a node's previous parent is not
 * also in the snapshot, it pastes as un-parented (top-level) — this
 * matches user intent when copying a child without its frame.
 */
export const remapForPaste = (
  snapshot: ClipboardSnapshot,
  offset: { x: number; y: number } = PASTE_OFFSET
): { nodes: RfNode[]; edges: RfEdge[] } => {
  const idMap = new Map<string, string>();
  for (const n of snapshot.nodes) idMap.set(n.id, newId());

  const nodes: RfNode[] = snapshot.nodes.map(n => {
    const next: RfNode = {
      ...n,
      id: idMap.get(n.id)!,
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
      // Avoid leaking selection state from the source nodes.
      selected: true,
    };
    if (n.parentId) {
      const mappedParent = idMap.get(n.parentId);
      if (mappedParent) {
        next.parentId = mappedParent;
        // extent stays whatever the original had ('parent' for children
        // of frames pasted alongside).
      } else {
        delete next.parentId;
        delete next.extent;
      }
    }
    return next;
  });

  const edges: RfEdge[] = snapshot.edges.map(e => ({
    ...e,
    id: newId(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));

  return { nodes, edges };
};
