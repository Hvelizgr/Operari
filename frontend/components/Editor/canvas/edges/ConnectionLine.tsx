'use client';

import { type ConnectionLineComponentProps, getBezierPath } from '@xyflow/react';
import { useEffect, useState } from 'react';

/**
 * Connection-line preview during a drag-to-connect (n8n parity).
 *
 * The 300ms fade-in is the operator-intent gate: when the user
 * actually meant to *click* the plus-button extension (not drag),
 * the drag gesture still registers for a few frames before
 * `pointerup` fires. Without the delay, that flash showed a stray
 * dragline that felt twitchy. With the delay, the line only
 * materialises if the user is genuinely dragging.
 *
 * `pointer-events: none` is implicit because xyflow renders the
 * connection line in the canvas SVG layer — clicks pass through.
 */
export function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
    curvature: 0.4,
  });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(id);
  }, []);
  return (
    <g style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease-out' }}>
      <path
        d={path}
        fill="none"
        stroke="var(--rb-edge-running)"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <circle cx={toX} cy={toY} r={4} fill="var(--rb-edge-running)" />
    </g>
  );
}
