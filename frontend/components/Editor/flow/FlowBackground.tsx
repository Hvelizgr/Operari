'use client';

import { Background, BackgroundVariant } from '@xyflow/react';
import { memo } from 'react';

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

  // React Flow has no horizontal-only variant. A horizontal gap far wider
  // than any canvas pushes the vertical strokes of the Lines pattern out
  // of view, which leaves ruled lines.
  return (
    <Background
      variant={BackgroundVariant.Lines}
      gap={pattern === 'lines' ? [1_000_000, size] : size}
      lineWidth={1}
      color={`rgba(128, 130, 132, ${opacity * 0.5})`}
    />
  );
}

export default memo(FlowBackground);
