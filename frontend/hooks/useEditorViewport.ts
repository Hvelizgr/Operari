/**
 * Hook for managing the editor canvas viewport state
 * Handles zoom, pan, fit view, and viewport transformations
 */

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import type { WorkflowNode } from '../components/Editor';
import { EDITOR_CONFIG } from '../config/editor.config';
import type { ViewportState } from '../types/editor.types';

interface UseEditorViewportProps {
  nodes: WorkflowNode[];
  windowSize: { width: number; height: number };
  canvasRef: RefObject<HTMLDivElement | null>;
}

interface UseEditorViewportReturn {
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitView: () => void;
  handleResetZoom: () => void;
  handleViewportChange: (x: number, y: number) => void;
}

export function useEditorViewport({
  nodes,
  windowSize,
  canvasRef,
}: UseEditorViewportProps): UseEditorViewportReturn {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  // React (since v17) registers `onWheel` listeners with `{ passive: true }`
  // unconditionally, which means `e.preventDefault()` is a no-op and the
  // browser scrolls the page instead of zooming the canvas. The console
  // also logs "Unable to preventDefault inside passive event listener"
  // for every tick of the scroll wheel.
  //
  // Workaround: attach the native wheel listener ourselves via
  // addEventListener({ passive: false }), so preventDefault actually
  // stops page scroll. viewportRef tracks the latest state so the
  // listener stays in sync without re-attaching on every zoom step.
  const viewportStateRef = useRef(viewport);
  useEffect(() => {
    viewportStateRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const vp = viewportStateRef.current;
      const delta = -e.deltaY * EDITOR_CONFIG.ZOOM.SENSITIVITY;
      const newZoom = Math.min(
        Math.max(vp.zoom + delta, EDITOR_CONFIG.ZOOM.MIN),
        EDITOR_CONFIG.ZOOM.MAX
      );

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomPoint = {
        x: (mouseX - vp.x) / vp.zoom,
        y: (mouseY - vp.y) / vp.zoom,
      };

      setViewport({
        x: mouseX - zoomPoint.x * newZoom,
        y: mouseY - zoomPoint.y * newZoom,
        zoom: newZoom,
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [canvasRef]);

  const handleZoomIn = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom + 0.1, EDITOR_CONFIG.ZOOM.MAX),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom - 0.1, EDITOR_CONFIG.ZOOM.MIN),
    }));
  }, []);

  const handleFitView = useCallback(() => {
    if (nodes.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + 260);
      maxY = Math.max(maxY, node.position.y + 120);
    });

    const padding = 100;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const canvasWidth = windowSize.width;
    const canvasHeight = windowSize.height;

    const zoomX = canvasWidth / width;
    const zoomY = canvasHeight / height;
    const newZoom = Math.min(zoomX, zoomY, EDITOR_CONFIG.ZOOM.MAX);

    const centerX = -(minX - padding - (canvasWidth / newZoom - width) / 2) * newZoom;
    const centerY = -(minY - padding - (canvasHeight / newZoom - height) / 2) * newZoom;

    setViewport({ x: centerX, y: centerY, zoom: newZoom });
  }, [nodes, windowSize.width, windowSize.height]);

  const handleResetZoom = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  const handleViewportChange = useCallback((x: number, y: number) => {
    setViewport(prev => ({ ...prev, x, y }));
  }, []);

  return {
    viewport,
    setViewport,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleResetZoom,
    handleViewportChange,
  };
}
