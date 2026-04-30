import type { RfNode } from './adapter';

/**
 * React Flow requires parent nodes to appear before their children in
 * the array, otherwise the child is rendered with no parent for one
 * frame and "jumps" into place. This stable topological sort places
 * every parented node strictly after its parent without disturbing the
 * relative order within the same level.
 */
export const sortNodesForRf = (nodes: RfNode[]): RfNode[] => {
  if (nodes.length < 2) return nodes;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out: RfNode[] = [];
  const placed = new Set<string>();

  const place = (node: RfNode): void => {
    if (placed.has(node.id)) return;
    if (node.parentId && byId.has(node.parentId) && !placed.has(node.parentId)) {
      place(byId.get(node.parentId)!);
    }
    out.push(node);
    placed.add(node.id);
  };

  for (const n of nodes) place(n);
  return out;
};

export const getDescendantIds = (nodeId: string, nodes: RfNode[]): string[] => {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n.id);
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(nodeId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    const kids = childrenOf.get(cur);
    if (kids) stack.push(...kids);
  }
  return out;
};

/**
 * Return the smallest frame node (by area) that fully contains the
 * dragged node's center. Used by the auto-parent drag handler so that
 * dropping a step into a nested frame parents it to the innermost one.
 */
export const findInnermostFrame = (
  draggedNode: RfNode,
  candidates: RfNode[]
): RfNode | undefined => {
  if (candidates.length === 0) return undefined;
  let best: { node: RfNode; area: number } | undefined;
  for (const c of candidates) {
    const w = c.measured?.width ?? 0;
    const h = c.measured?.height ?? 0;
    const area = w * h;
    if (area === 0) continue;
    if (!best || area < best.area) best = { node: c, area };
  }
  return best?.node;
};
