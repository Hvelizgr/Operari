import type { FrameNodeConfig, WorkflowNode } from '@operari/shared';
import type { XYPosition } from '@xyflow/react';

// Helper: Get all descendant node IDs (handles nested frames)
export function getDescendantIds(parentId: string, nodes: WorkflowNode[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter(n => n.parentId === currentId);
    for (const child of children) {
      descendants.add(child.id);
      if (child.type === 'custom.frame') {
        queue.push(child.id); // Check for nested frame children
      }
    }
  }

  return descendants;
}

// Helper: Find the frame that contains a node based on position
export function findContainingFrame(node: WorkflowNode, nodes: WorkflowNode[]): string | undefined {
  // Don't assign frame to itself or other frames
  if (node.type === 'custom.frame') return undefined;

  const frames = nodes.filter(n => n.type === 'custom.frame' && n.id !== node.id);

  // Calculate node center (approximate node dimensions)
  const nodeWidth = 275;
  const nodeHeight = 120;
  const nodeCenter = {
    x: node.position.x + nodeWidth / 2,
    y: node.position.y + nodeHeight / 2,
  };

  // Find the smallest (most nested) frame that contains this node
  let containingFrame: WorkflowNode | undefined;
  let smallestArea = Infinity;

  for (const frame of frames) {
    // `frames` was pre-filtered to `node.type === 'custom.frame'` upstream,
    // so the config is safely a FrameNodeConfig.
    const frameConfig = (frame.config ?? {}) as FrameNodeConfig;
    const frameWidth = frameConfig.width || 400;
    const frameHeight = frameConfig.height || 300;

    const isInside =
      nodeCenter.x >= frame.position.x &&
      nodeCenter.x <= frame.position.x + frameWidth &&
      nodeCenter.y >= frame.position.y &&
      nodeCenter.y <= frame.position.y + frameHeight;

    if (isInside) {
      const area = frameWidth * frameHeight;
      if (area < smallestArea) {
        smallestArea = area;
        containingFrame = frame;
      }
    }
  }

  return containingFrame?.id;
}

// React Flow only reports the nodes it dragged. Frames own their children
// through `parentId` (absolute coordinates, not React Flow sub-flows), so a
// dragged frame has to carry its descendants along by the same delta. A
// frame moved by its resizer (west/north edges) leaves its children put.
export function applyPositionChanges(
  nodes: WorkflowNode[],
  positions: Map<string, XYPosition>,
  dragged: Set<string>
): WorkflowNode[] {
  const next = new Map(positions);
  for (const [id, pos] of positions) {
    if (!dragged.has(id)) continue;
    const node = nodes.find(n => n.id === id);
    if (node?.type !== 'custom.frame') continue;
    const dx = pos.x - node.position.x;
    const dy = pos.y - node.position.y;
    if (dx === 0 && dy === 0) continue;
    for (const childId of getDescendantIds(id, nodes)) {
      if (positions.has(childId)) continue;
      const child = nodes.find(n => n.id === childId)!;
      next.set(childId, { x: child.position.x + dx, y: child.position.y + dy });
    }
  }
  return nodes.map(n => {
    const pos = next.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}
