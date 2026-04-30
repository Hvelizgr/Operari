'use client';

import { getNodesBounds, useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';

/**
 * Capture the runbook canvas as a PNG sized to the bounding box of all
 * nodes (or just the selected ones). The intended share path is a
 * Slack thread during an incident — operators paste a snapshot of the
 * runbook so the team sees the structure without opening the editor.
 *
 * `html-to-image` is loaded dynamically so the dependency only enters
 * the bundle for users who actually click Export. The capture targets
 * `.react-flow__viewport`, the inner transform layer that holds nodes
 * and edges — capturing the outer wrapper would also drag the
 * `<Panel>`s and Controls into the screenshot.
 *
 * Returns:
 *   - `exporting`: render the button as busy while the work runs
 *   - `error`:     last error message; null when fresh
 *   - `exportPng`: kicks off capture + download
 */
export function usePngExport() {
  const { getNodes } = useReactFlow<RfNode, RfEdge>();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPng = useCallback(
    async (filename = 'runbook.png') => {
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

        // Lazy import keeps html-to-image (~80kb) out of the editor's
        // initial chunk. The dynamic import is cached after first use.
        const { toPng } = await import('html-to-image');

        const dataUrl = await toPng(viewport, {
          backgroundColor: '#171717',
          width,
          height,
          // Translate the viewport so the top-left of `bounds` lands at
          // (PADDING, PADDING) within the captured frame, regardless of
          // the user's current pan/zoom.
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px) scale(1)`,
          },
          pixelRatio: 2,
        });

        const link = document.createElement('a');
        link.download = filename;
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

  return { exportPng, exporting, error };
}
