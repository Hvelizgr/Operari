'use client';

import { getNodesBounds, useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';

type Format = 'png' | 'svg';

/**
 * Capture the runbook canvas as a PNG (raster, for Slack threads) or
 * SVG (vector, for Notion postmortems). The export targets only the
 * `.react-flow__viewport` transform layer so chrome (`<Panel>`s,
 * Controls, MiniMap) doesn't bleed into the image.
 *
 * `html-to-image` is loaded dynamically so the ~80kB dependency only
 * enters the bundle for users who actually click Export.
 *
 * Returns:
 *   - `exporting`: render the button as busy while the work runs
 *   - `error`:     last error message; null when fresh
 *   - `exportImage(format, filename)`: kicks off capture + download
 */
export function usePngExport() {
  const { getNodes } = useReactFlow<RfNode, RfEdge>();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportImage = useCallback(
    async (format: Format, filename?: string) => {
      setError(null);
      setExporting(true);
      try {
        const all = getNodes();
        const subject = all.filter(n => n.selected);
        const target = subject.length > 0 ? subject : all;
        if (target.length === 0) {
          setError('Empty canvas — nothing to export');
          return;
        }

        const bounds = getNodesBounds(target);
        const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
        if (!viewport) {
          setError('Canvas element not found');
          return;
        }

        const PADDING = 40;
        const width = bounds.width + PADDING * 2;
        const height = bounds.height + PADDING * 2;

        const lib = await import('html-to-image');
        const captureOptions = {
          backgroundColor: '#171717',
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px) scale(1)`,
          },
          // Pixel ratio applies only to PNG; SVG is vector.
          ...(format === 'png' ? { pixelRatio: 2 } : {}),
        };

        const dataUrl =
          format === 'png'
            ? await lib.toPng(viewport, captureOptions)
            : await lib.toSvg(viewport, captureOptions);

        const link = document.createElement('a');
        link.download = filename ?? `runbook.${format}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed');
      } finally {
        setExporting(false);
      }
    },
    [getNodes]
  );

  // Backwards-compatible alias: `exportPng` was the only API before
  // SVG support landed. Internal callers use `exportImage` directly.
  const exportPng = useCallback(
    (filename = 'runbook.png') => exportImage('png', filename),
    [exportImage]
  );

  return { exportPng, exportImage, exporting, error };
}
