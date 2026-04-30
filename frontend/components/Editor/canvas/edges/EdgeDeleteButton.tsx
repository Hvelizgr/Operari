'use client';

import { EdgeLabelRenderer } from '@xyflow/react';
import { X } from 'lucide-react';

import { useEditorStore } from '@/state/editorStore';

interface EdgeDeleteButtonProps {
  edgeId: string;
  /** World-space coordinates of the edge midpoint, returned by
   *  `getBezierPath` / `getSmoothStepPath`. */
  x: number;
  y: number;
  /** Pixel offset along the X axis so the button doesn't collide with
   *  a condition badge, which sits at the same midpoint. */
  offsetX?: number;
}

/**
 * Inline delete affordance shown over a selected edge. Avoids the
 * right-click context menu trip when the operator just wants to clip
 * a transition during authoring. The delete dispatches through the
 * standard `onEdgesChange` so undo / autosave behave normally.
 *
 * Lives inside `<EdgeLabelRenderer>` so it renders in HTML space
 * (clickable, not affected by the SVG pointer-events trap) but
 * positions in world coordinates that scale with the viewport.
 */
export function EdgeDeleteButton({ edgeId, x, y, offsetX = 14 }: EdgeDeleteButtonProps) {
  const remove = (event: React.MouseEvent) => {
    event.stopPropagation();
    useEditorStore.getState().onEdgesChange([{ id: edgeId, type: 'remove' }]);
    useEditorStore.getState().setStatus('dirty');
  };

  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        onClick={remove}
        aria-label="Delete edge"
        className="nodrag nopan pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110"
        style={{
          left: x + offsetX,
          top: y,
          background: 'var(--op-sunset)',
        }}
      >
        <X size={11} />
      </button>
    </EdgeLabelRenderer>
  );
}
