import type { RfEdge, RfNode } from './adapter';
import { sortNodesForRf } from './graph';

const FRAME_TYPE = 'custom.frame';
const FRAME_PADDING = 32;
const FRAME_HEADER = 28;
const DEFAULT_NODE_W = 240;
const DEFAULT_NODE_H = 120;

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface WrapResult {
  nodes: RfNode[];
  edges: RfEdge[];
  frameId: string;
}

/**
 * Wrap a set of selected nodes in a new frame: compute a bounding box
 * over their positions, drop a frame node sized to fit them, reparent
 * each child to that frame and re-base its position to parent-local
 * coordinates.
 *
 * Edges are preserved unchanged — RF supports cross-frame edges
 * natively, so an edge between a wrapped child and an outside node
 * keeps working without a special case.
 *
 * Pure: returns the new (nodes, edges, frameId) tuple, no store
 * mutation. Tested in isolation.
 */
export const wrapInFrame = (
  selectedIds: string[],
  allNodes: RfNode[],
  allEdges: RfEdge[],
  color = 'var(--op-sky)'
): WrapResult | null => {
  if (selectedIds.length === 0) return null;
  const selectedSet = new Set(selectedIds);
  const subjects = allNodes.filter(n => selectedSet.has(n.id));
  if (subjects.length === 0) return null;

  // Reject when any selected node is already a frame — wrapping a
  // frame would create a nested frame the user almost certainly does
  // not want, and our auto-parent flow doesn't support frame-in-frame.
  if (subjects.some(n => n.type === FRAME_TYPE)) return null;

  // Compute the bounding box in *world* coordinates. For nodes that
  // are already parented, the world position is parent.position +
  // node.position. We don't have parent absolute coords here, so we
  // require the selection to be siblings — same parent for everyone.
  const parents = new Set(subjects.map(n => n.parentId ?? null));
  if (parents.size > 1) return null;
  const sharedParent = subjects[0].parentId ?? null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of subjects) {
    const w = n.measured?.width ?? DEFAULT_NODE_W;
    const h = n.measured?.height ?? DEFAULT_NODE_H;
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
    if (n.position.x + w > maxX) maxX = n.position.x + w;
    if (n.position.y + h > maxY) maxY = n.position.y + h;
  }

  const frameId = newId();
  const frameX = minX - FRAME_PADDING;
  const frameY = minY - (FRAME_PADDING + FRAME_HEADER);
  const frameWidth = maxX - minX + FRAME_PADDING * 2;
  const frameHeight = maxY - minY + FRAME_PADDING * 2 + FRAME_HEADER;

  const frame: RfNode = {
    id: frameId,
    type: FRAME_TYPE,
    position: { x: frameX, y: frameY },
    data: {
      workflow: {
        title: 'Section',
        config: { title: 'Section', color, width: frameWidth, height: frameHeight },
      },
    },
    ...(sharedParent ? { parentId: sharedParent, extent: 'parent' as const } : {}),
  };

  const nextNodes: RfNode[] = allNodes.map(n => {
    if (!selectedSet.has(n.id)) return n;
    return {
      ...n,
      parentId: frameId,
      extent: 'parent' as const,
      position: {
        x: n.position.x - frameX,
        y: n.position.y - frameY,
      },
      // Drop the per-node `selected` flag; we'll select the new frame
      // instead so the next operation acts on the wrapper.
      selected: false,
    };
  });
  // Insert the frame just before the first child it contains.
  const insertAt = nextNodes.findIndex(n => selectedSet.has(n.id));
  const safeIdx = insertAt < 0 ? nextNodes.length : insertAt;
  nextNodes.splice(safeIdx, 0, { ...frame, selected: true });

  return {
    nodes: sortNodesForRf(nextNodes),
    edges: allEdges,
    frameId,
  };
};
