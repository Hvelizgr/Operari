'use client';

import { type Node, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { findInnermostFrame } from '@/lib/canvas/graph';
import { useEditorStore } from '@/state/editorStore';

const FRAME_TYPE = 'custom.frame';

interface AutoParentHandlers {
  /** Fired on every `onNodeDrag` tick. Cheaply updates the
   *  `hoveredFrameId` slice so the frame component lights up while the
   *  user is hovering over it. */
  onDrag: (event: unknown, draggedNode: Node) => void;
  /** Fired on `onNodeDragStop`. Performs the actual reparent + position
   *  rebase, then clears the hover signal. */
  onDragStop: (event: unknown, draggedNode: Node) => void;
}

export function useAutoParent(): AutoParentHandlers {
  const { getIntersectingNodes, getInternalNode } = useReactFlow<RfNode, RfEdge>();
  const reparentNode = useEditorStore(s => s.reparentNode);
  const setHoveredFrameId = useEditorStore(s => s.setHoveredFrameId);

  const findTargetFrame = useCallback(
    (draggedNode: Node): RfNode | undefined => {
      if (draggedNode.type === FRAME_TYPE) return undefined;
      const intersecting = getIntersectingNodes(draggedNode).filter(
        n => n.type === FRAME_TYPE
      ) as RfNode[];
      return findInnermostFrame(draggedNode as RfNode, intersecting);
    },
    [getIntersectingNodes]
  );

  const onDrag = useCallback(
    (_event: unknown, draggedNode: Node) => {
      const target = findTargetFrame(draggedNode);
      // Only push to the store when the result actually changes —
      // setHoveredFrameId already short-circuits no-op writes, but
      // this saves the function call entirely on most drag ticks.
      const currentHover = useEditorStore.getState().hoveredFrameId;
      const next = target?.id ?? null;
      if (currentHover !== next) setHoveredFrameId(next);
    },
    [findTargetFrame, setHoveredFrameId]
  );

  const onDragStop = useCallback(
    (_event: unknown, draggedNode: Node) => {
      // Frames don't auto-parent into other frames — the V1 contract was
      // flat top-level frames, and nesting them via drag complicates the
      // mental model without helping a real workflow.
      setHoveredFrameId(null);
      if (draggedNode.type === FRAME_TYPE) return;

      const target = findTargetFrame(draggedNode);
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
    [findTargetFrame, getInternalNode, reparentNode, setHoveredFrameId]
  );

  return { onDrag, onDragStop };
}
