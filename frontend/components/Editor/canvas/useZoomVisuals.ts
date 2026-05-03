'use client';

import { useStore } from '@xyflow/react';
import { useEffect } from 'react';

/**
 * Subscribe to React Flow's viewport zoom and write three CSS custom
 * properties to a target element so far-zoomed canvases stay readable:
 *
 *   --canvas-zoom-compensation-factor   1 / max(0.4, zoom)
 *      Use in `box-shadow`, `stroke-width`, anything that should keep
 *      its on-screen pixel size constant regardless of zoom. n8n parity
 *      — they multiply selection halos by this so a 100% halo at 1.0
 *      stays the same visual thickness at 0.3.
 *
 *   --canvas-node--border--opacity-light  0.10 → 0.70 across zoom
 *   --canvas-node--border--opacity-dark   0.20 → 0.70 across zoom
 *      Borders fade IN as the operator zooms out, so a far-zoomed
 *      canvas keeps each node's silhouette visible without
 *      overwhelming the closer ones at 1.0. Gamma-corrected (γ=2.2)
 *      curve borrowed from n8n's `useZoomAdjustedValues` for
 *      perceptually smooth easing.
 *
 * Mounted once at the canvas root — the singular subscription beats
 * each node subscribing individually (a Switch with 50 nodes would
 * otherwise re-render the whole tree every viewport tick).
 */

export function useZoomVisuals(rootRef: React.RefObject<HTMLElement | null>): void {
  const zoom = useStore(s => s.transform[2]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const compensation = 1 / Math.max(0.4, zoom);
    root.style.setProperty('--canvas-zoom-compensation-factor', compensation.toFixed(3));

    // Gamma-corrected fade-in: opacity grows as zoom shrinks below 1.
    // Below `minZoom` (0.2) we cap at `maxOpacity`; above 1.0 we sit
    // at `baseOpacity`. Between, gamma 2.2 gives a perceptually
    // smooth curve (linear 0→1 in lightness terms).
    const opacity = (base: number, max: number): number => {
      if (zoom >= 1) return base;
      const minZoom = 0.2;
      if (zoom <= minZoom) return max;
      const t = (1 - zoom) / (1 - minZoom);
      const tGamma = Math.pow(t, 2.2);
      return base + tGamma * (max - base);
    };

    root.style.setProperty('--canvas-node--border--opacity-light', opacity(0.1, 0.7).toFixed(3));
    root.style.setProperty('--canvas-node--border--opacity-dark', opacity(0.2, 0.7).toFixed(3));
  }, [rootRef, zoom]);
}
