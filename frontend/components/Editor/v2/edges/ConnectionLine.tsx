'use client';

import { type ConnectionLineComponentProps, getBezierPath } from '@xyflow/react';

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
  return (
    <g>
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
