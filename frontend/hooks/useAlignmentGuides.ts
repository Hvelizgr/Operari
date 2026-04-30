'use client';

import { useStore, type Viewport } from '@xyflow/react';
import { useMemo } from 'react';

const SNAP_THRESHOLD_PX = 4;
const DEFAULT_W = 240;
const DEFAULT_H = 120;

export interface Guide {
  /** Whether the guide is a vertical or horizontal helper line. */
  axis: 'vertical' | 'horizontal';
  /** Position in screen pixels (already projected by the viewport
   *  transform). The overlay component renders absolutely at this
   *  coordinate. */
  screenPos: number;
}

interface InternalNode {
  id: string;
  measured?: { width?: number; height?: number };
  width?: number | null;
  height?: number | null;
  internals: { positionAbsolute: { x: number; y: number } };
  dragging?: boolean;
}

const dimensions = (n: InternalNode): { w: number; h: number } => ({
  w: n.measured?.width ?? n.width ?? DEFAULT_W,
  h: n.measured?.height ?? n.height ?? DEFAULT_H,
});

/**
 * Compute candidate alignment guides. Three reference points per node
 * — left/center/right and top/middle/bottom. A guide appears when the
 * dragged node's reference point lands within `threshold` (world
 * units) of any other node's reference point.
 *
 * The threshold is scaled by the inverse of zoom so it feels constant
 * in screen pixels: at 0.5x zoom the operator gets a looser snap,
 * at 2x zoom a tighter one.
 */
export function useAlignmentGuides(): Guide[] {
  const transform = useStore(s => s.transform);
  const dragging = useStore(s => {
    for (const n of s.nodeLookup.values()) {
      if ((n as unknown as InternalNode).dragging) return n as unknown as InternalNode;
    }
    return null;
  });
  const others = useStore(s => {
    if (s.nodesSelectionActive || s.nodeLookup.size < 2) return [];
    const out: InternalNode[] = [];
    for (const n of s.nodeLookup.values()) {
      const node = n as unknown as InternalNode;
      if (!node.dragging) out.push(node);
    }
    return out;
  });

  return useMemo(() => {
    if (!dragging || others.length === 0) return [];
    const [vpX, vpY, zoom] = transform as Viewport extends infer _
      ? [number, number, number]
      : never;
    const threshold = SNAP_THRESHOLD_PX / zoom;

    const draggedAbs = dragging.internals.positionAbsolute;
    const draggedDims = dimensions(dragging);
    const draggedX = [draggedAbs.x, draggedAbs.x + draggedDims.w / 2, draggedAbs.x + draggedDims.w];
    const draggedY = [draggedAbs.y, draggedAbs.y + draggedDims.h / 2, draggedAbs.y + draggedDims.h];

    const verticalHits = new Set<number>();
    const horizontalHits = new Set<number>();
    for (const o of others) {
      const dims = dimensions(o);
      const xs = [
        o.internals.positionAbsolute.x,
        o.internals.positionAbsolute.x + dims.w / 2,
        o.internals.positionAbsolute.x + dims.w,
      ];
      const ys = [
        o.internals.positionAbsolute.y,
        o.internals.positionAbsolute.y + dims.h / 2,
        o.internals.positionAbsolute.y + dims.h,
      ];
      for (const dx of draggedX) {
        for (const x of xs) {
          if (Math.abs(dx - x) < threshold) verticalHits.add(x);
        }
      }
      for (const dy of draggedY) {
        for (const y of ys) {
          if (Math.abs(dy - y) < threshold) horizontalHits.add(y);
        }
      }
    }

    const guides: Guide[] = [];
    for (const x of verticalHits) {
      guides.push({ axis: 'vertical', screenPos: vpX + x * zoom });
    }
    for (const y of horizontalHits) {
      guides.push({ axis: 'horizontal', screenPos: vpY + y * zoom });
    }
    return guides;
  }, [dragging, others, transform]);
}
