'use client';

import { getNodesBounds, useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';

type Format = 'png' | 'svg';

const PADDING = 40;
const REPAINT_DELAY_MS = 16;

/** Wait one frame so the browser commits a viewport change before we
 *  capture. `setViewport` updates RF's internal store synchronously
 *  but the DOM transform needs the next paint to apply. */
const nextFrame = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, REPAINT_DELAY_MS));

/**
 * Capture the runbook canvas as a PNG (raster, for Slack threads) or
 * SVG (vector, for Notion postmortems). Adapted from chaiNNer's
 * `nodeScreenshot.ts` technique:
 *
 *   1. Save the current viewport (so we can restore it).
 *   2. Compute the bounding box of the target nodes (selection or all).
 *   3. Move the real viewport to fit the bounding box at a zoom that
 *      matches the canvas's actual dimensions.
 *   4. Wait one frame for the DOM transform to settle.
 *   5. Capture `.react-flow` (the outer wrapper) at `1/exportZoom`
 *      pixel ratio so the resulting image is 1:1 with world units.
 *   6. Filter out the minimap and controls so they never appear in
 *      the screenshot regardless of layering.
 *   7. Restore the original viewport in `finally`.
 *
 * `html-to-image` is loaded dynamically so the ~80kB dependency only
 * enters the bundle for users who actually click Export.
 */
export function usePngExport() {
  const { getNodes, getViewport, setViewport } = useReactFlow<RfNode, RfEdge>();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportImage = useCallback(
    async (format: Format, filename?: string) => {
      setError(null);
      setExporting(true);
      const oldViewport = getViewport();
      try {
        const all = getNodes();
        const subject = all.filter(n => n.selected);
        const target = subject.length > 0 ? subject : all;
        if (target.length === 0) {
          setError('Empty canvas — nothing to export');
          return;
        }

        const bounds = getNodesBounds(target);
        const wrapper = document.querySelector<HTMLElement>('.react-flow');
        if (!wrapper) {
          setError('Canvas element not found');
          return;
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const padded = {
          x: bounds.x - PADDING,
          y: bounds.y - PADDING,
          width: bounds.width + PADDING * 2,
          height: bounds.height + PADDING * 2,
        };
        // Pick the zoom that lets the bounding box fit the wrapper —
        // this is the zoom we capture at, and it determines the final
        // image dimensions.
        const exportZoom = Math.min(
          wrapperRect.width / padded.width,
          wrapperRect.height / padded.height,
          1
        );

        // Move viewport so the padded bounds' top-left lands at (0, 0)
        // within the wrapper, then wait for the DOM transform to apply.
        setViewport({ x: -padded.x * exportZoom, y: -padded.y * exportZoom, zoom: exportZoom });
        await nextFrame();

        const lib = await import('html-to-image');
        const captureOptions = {
          backgroundColor: '#171717',
          width: padded.width * exportZoom,
          height: padded.height * exportZoom,
          // `pixelRatio: 1/exportZoom` so the resulting image is at
          // 1× the world dimensions. Without this, zooming out before
          // export produced tiny pixelated images.
          ...(format === 'png' ? { pixelRatio: 1 / exportZoom } : {}),
          filter: (node: unknown) => {
            if (!(node instanceof HTMLElement)) return true;
            // Defensive — capture targets `.react-flow` (the wrapper)
            // so chrome inside it (minimap, controls, attribution,
            // panels) would otherwise leak into the screenshot.
            const cls = node.classList;
            if (cls.contains('react-flow__minimap')) return false;
            if (cls.contains('react-flow__controls')) return false;
            if (cls.contains('react-flow__attribution')) return false;
            if (cls.contains('react-flow__panel')) return false;
            return true;
          },
        };

        const dataUrl =
          format === 'png'
            ? await lib.toPng(wrapper, captureOptions)
            : await lib.toSvg(wrapper, captureOptions);

        const link = document.createElement('a');
        link.download = filename ?? `runbook.${format}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed');
      } finally {
        setViewport(oldViewport);
        setExporting(false);
      }
    },
    [getNodes, getViewport, setViewport]
  );

  // Backwards-compatible alias: `exportPng` was the only API before
  // SVG support landed. Internal callers use `exportImage` directly.
  const exportPng = useCallback(
    (filename = 'runbook.png') => exportImage('png', filename),
    [exportImage]
  );

  return { exportPng, exportImage, exporting, error };
}
