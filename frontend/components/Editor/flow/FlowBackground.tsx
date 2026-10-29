'use client';

import { Background, BackgroundVariant, useStore } from '@xyflow/react';
import { memo, useId } from 'react';

import type { CanvasAppearance } from './useCanvasAppearance';

function FlowBackground({ background }: { background: CanvasAppearance['background'] }) {
  const { pattern, size, opacity } = background;
  if (pattern === 'none') return null;

  if (pattern === 'dots') {
    return (
      <Background
        variant={BackgroundVariant.Dots}
        gap={size}
        size={1}
        color={`rgba(128, 130, 132, ${opacity})`}
      />
    );
  }

  if (pattern === 'lines') {
    return <RuledLines gap={size} color={`rgba(128, 130, 132, ${opacity * 0.5})`} />;
  }

  return (
    <Background
      variant={BackgroundVariant.Lines}
      gap={size}
      lineWidth={1}
      color={`rgba(128, 130, 132, ${opacity * 0.5})`}
    />
  );
}

// React Flow has no horizontal-only variant. Widening the Lines gap to
// hide its vertical stroke still left one line on screen when zoomed out.
function RuledLines({ gap, color }: { gap: number; color: string }) {
  const id = useId();
  const translateY = useStore(s => s.transform[1]);
  const zoom = useStore(s => s.transform[2]);
  const height = gap * zoom;

  return (
    <svg className="react-flow__background react-flow__container">
      <pattern
        id={id}
        x={0}
        y={translateY % height}
        width={8}
        height={height}
        patternUnits="userSpaceOnUse"
      >
        <path d={`M0 ${height / 2} H8`} stroke={color} strokeWidth={1} />
      </pattern>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export default memo(FlowBackground);
