'use client';

import { getNodesBounds, type Node, useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';

type Format = 'png' | 'svg';

const PADDING = 40;
const REPAINT_DELAY_MS = 16;

/** Wait one paint frame so the browser commits a viewport change
 *  before we capture. RF's `setViewport` updates state synchronously
 *  but the DOM transform applies on the next paint. */
const nextFrame = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, REPAINT_DELAY_MS));

/**
 * Capture any React Flow surface (the schema diagram, in our case)
 * as a PNG / SVG. Targets the nearest `.react-flow` ancestor of the
 * caller's component tree.
 *
 * Mirrors the runbook editor's `usePngExport` viewport-shift trick
 * (chaiNNer-inspired) but trimmed: no selection filtering — the
 * schema viewer almost always wants the full graph.
 *
 * `html-to-image` is loaded dynamically so the ~80kB dependency
 * stays out of the SQL editor's default bundle.
 */
export function useDiagramExport() {
  const { getNodes, getViewport, setViewport } = useReactFlow();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportImage = useCallback(
    async (format: Format, filename: string) => {
      setError(null);
      setExporting(true);
      const oldViewport = getViewport();
      try {
        const all = getNodes() as Node[];
        if (all.length === 0) {
          setError('Empty canvas — nothing to export');
          return;
        }

        const visible = all.filter(n => !n.hidden);
        const target = visible.length > 0 ? visible : all;
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
        const exportZoom = Math.min(
          wrapperRect.width / padded.width,
          wrapperRect.height / padded.height,
          1
        );

        setViewport({ x: -padded.x * exportZoom, y: -padded.y * exportZoom, zoom: exportZoom });
        await nextFrame();

        const lib = await import('html-to-image');
        const captureOptions = {
          backgroundColor: '#0a0a0a',
          width: padded.width * exportZoom,
          height: padded.height * exportZoom,
          ...(format === 'png' ? { pixelRatio: 1 / exportZoom } : {}),
          filter: (node: unknown) => {
            if (!(node instanceof HTMLElement)) return true;
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
        link.download = filename;
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

  return { exportImage, exporting, error };
}
