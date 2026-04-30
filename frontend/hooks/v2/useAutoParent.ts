'use client';

import { type Node, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/v2/adapter';
import { findInnermostFrame } from '@/lib/canvas/v2/graph';
import { useEditorStoreV2 } from '@/state/editorStoreV2';

const FRAME_TYPE = 'custom.frame';

export function useAutoParent() {
  const { getIntersectingNodes, getInternalNode } = useReactFlow<RfNode, RfEdge>();
  const reparentNode = useEditorStoreV2(s => s.reparentNode);

  return useCallback(
    (_event: unknown, draggedNode: Node) => {
      // Frames don't auto-parent into other frames — the V1 contract was
      // flat top-level frames, and nesting them via drag complicates the
      // mental model without helping a real workflow.
      if (draggedNode.type === FRAME_TYPE) return;

      const intersecting = getIntersectingNodes(draggedNode).filter(
        n => n.type === FRAME_TYPE
      ) as RfNode[];
      const target = findInnermostFrame(draggedNode as RfNode, intersecting);
      const currentParentId = (draggedNode as RfNode).parentId ?? null;
      const nextParentId = target?.id ?? null;

      if (currentParentId === nextParentId) return;

      // Re-base position to parent-local coordinates so the node stays
      // visually where the user dropped it. `getInternalNode` exposes
      // `internals.positionAbsolute` which already accounts for any
      // current parenting.
      const draggedAbs = getInternalNode(draggedNode.id);
      const absX = draggedAbs?.internals.positionAbsolute.x ?? draggedNode.position.x;
      const absY = draggedAbs?.internals.positionAbsolute.y ?? draggedNode.position.y;

      let nextPos: { x: number; y: number } | undefined;
      if (target) {
        const frameAbs = getInternalNode(target.id);
        const fx = frameAbs?.internals.positionAbsolute.x ?? target.position.x;
        const fy = frameAbs?.internals.positionAbsolute.y ?? target.position.y;
        nextPos = { x: absX - fx, y: absY - fy };
      } else {
        // Un-parenting: switch back to absolute world coords.
        nextPos = { x: absX, y: absY };
      }

      reparentNode(draggedNode.id, nextParentId, nextPos);
    },
    [getIntersectingNodes, getInternalNode, reparentNode]
  );
}
