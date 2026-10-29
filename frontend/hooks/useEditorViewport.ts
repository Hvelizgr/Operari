/**
 * Hook for managing the editor canvas viewport state
 * Handles zoom, pan, fit view, and viewport transformations
 */

import { useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';

import { EDITOR_CONFIG } from '../config/editor.config';
import type { ViewportState } from '../types/editor.types';

const ANIMATION_MS = 200;

// Never fit so far out that cards become illegible to click.
const FIT_VIEW_MIN_ZOOM = 0.5;

interface UseEditorViewportReturn {
  viewport: ViewportState;
  /** Mirror React Flow's viewport into React state (FlowCanvas onMove). */
  syncViewport: (viewport: ViewportState) => void;
  /** Move the canvas. Goes through React Flow, which owns the viewport. */
  setViewport: (viewport: ViewportState) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitView: () => void;
  handleResetZoom: () => void;
  centerOnNode: (nodeId: string) => void;
}

/**
 * React Flow owns the viewport. `viewport` here is a read-only mirror for
 * the overlays (minimap, zoom readout, node placement); writes go through
 * React Flow. Feeding the viewport back as a controlled prop would resync
 * d3-zoom on every animation frame and cut fitView/zoom transitions short.
 * Must be called under a ReactFlowProvider.
 */
export function useEditorViewport(): UseEditorViewportReturn {
  const [viewport, syncViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const flow = useReactFlow();

  const setViewport = useCallback(
    (next: ViewportState) => {
      flow.setViewport(next);
    },
    [flow]
  );

  const handleZoomIn = useCallback(() => {
    flow.zoomIn({ duration: ANIMATION_MS });
  }, [flow]);

  const handleZoomOut = useCallback(() => {
    flow.zoomOut({ duration: ANIMATION_MS });
  }, [flow]);

  const handleFitView = useCallback(() => {
    flow.fitView({
      padding: 0.15,
      minZoom: FIT_VIEW_MIN_ZOOM,
      maxZoom: EDITOR_CONFIG.ZOOM.MAX,
      duration: ANIMATION_MS,
    });
  }, [flow]);

  const handleResetZoom = useCallback(() => {
    flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: ANIMATION_MS });
  }, [flow]);

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const node = flow.getNode(nodeId);
      if (!node) return;
      const w = node.measured?.width ?? 0;
      const h = node.measured?.height ?? 0;
      flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: flow.getZoom(),
        duration: ANIMATION_MS,
      });
    },
    [flow]
  );

  return {
    viewport,
    syncViewport,
    setViewport,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleResetZoom,
    centerOnNode,
  };
}
