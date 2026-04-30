'use client';

import { useAlignmentGuides } from '@/hooks/useAlignmentGuides';

/**
 * Helper-line overlay rendered while the user is dragging a node.
 * Lines are drawn in screen space (the hook already projected through
 * the viewport transform), full width / height of the canvas, with a
 * brand-moss tint that doesn't compete with the node chrome.
 *
 * `pointer-events-none` is critical — these lines must not eat any
 * pointer events the canvas underneath needs for the in-flight drag.
 */
export default function AlignmentGuides() {
  const guides = useAlignmentGuides();
  if (guides.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {guides.map((g, idx) => (
        <div
          key={`${g.axis}-${idx}-${g.screenPos.toFixed(1)}`}
          className="absolute"
          style={{
            background: 'color-mix(in oklab, var(--op-moss) 70%, transparent)',
            ...(g.axis === 'vertical'
              ? { left: g.screenPos, top: 0, width: 1, height: '100%' }
              : { top: g.screenPos, left: 0, height: 1, width: '100%' }),
          }}
        />
      ))}
    </div>
  );
}
