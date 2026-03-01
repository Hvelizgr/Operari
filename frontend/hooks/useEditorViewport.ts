/**
 * Hook for managing the editor canvas viewport state
 * Handles zoom, pan, fit view, and viewport transformations
 */

import { useState, useCallback, useRef, RefObject, WheelEvent, useEffect } from 'react';
import { EDITOR_CONFIG } from '../config/editor.config';
import type { ViewportState } from '../types/editor.types';
import type { WorkflowNode } from '../components/Editor';

interface UseEditorViewportProps {
    nodes: WorkflowNode[];
    windowSize: { width: number; height: number };
    canvasRef: RefObject<HTMLDivElement | null>;
}

interface UseEditorViewportReturn {
    viewport: ViewportState;
    setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
    handleWheel: (e: WheelEvent<HTMLDivElement>) => void;
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

    const initializedRef = useRef(false);

    useEffect(() => {
        if (!initializedRef.current && windowSize.width > 0 && windowSize.height > 0 && nodes.length === 0) {
            initializedRef.current = true;
        }
    }, [windowSize.width, windowSize.height, nodes.length]);

    // Use ref to access current viewport in the native event listener
    const viewportRef = useRef(viewport);
    useEffect(() => {
        viewportRef.current = viewport;
    }, [viewport]);

    // Register wheel event with { passive: false } to allow preventDefault
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleNativeWheel = (e: globalThis.WheelEvent) => {
            e.preventDefault();

            const currentViewport = viewportRef.current;
            const delta = -e.deltaY * EDITOR_CONFIG.ZOOM.SENSITIVITY;
            const newZoom = Math.min(
                Math.max(currentViewport.zoom + delta, EDITOR_CONFIG.ZOOM.MIN),
                EDITOR_CONFIG.ZOOM.MAX
            );

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomPoint = {
                x: (mouseX - currentViewport.x) / currentViewport.zoom,
                y: (mouseY - currentViewport.y) / currentViewport.zoom,
            };

            setViewport({
                x: mouseX - zoomPoint.x * newZoom,
                y: mouseY - zoomPoint.y * newZoom,
                zoom: newZoom,
            });
        };

        canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

        return () => {
            canvas.removeEventListener('wheel', handleNativeWheel);
        };
    }, [canvasRef]);

    // Keep the React event handler as a no-op for compatibility
    const handleWheel = useCallback(
        (e: WheelEvent<HTMLDivElement>) => {
            // Wheel handling is done via native event listener with { passive: false }
            // This handler is kept for API compatibility but does nothing
        },
        []
    );

    const handleZoomIn = useCallback(() => {
        setViewport((prev) => ({
            ...prev,
            zoom: Math.min(prev.zoom + 0.1, EDITOR_CONFIG.ZOOM.MAX),
        }));
    }, []);

    const handleZoomOut = useCallback(() => {
        setViewport((prev) => ({
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
        nodes.forEach((node) => {
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

        const centerX =
            -(minX - padding - (canvasWidth / newZoom - width) / 2) * newZoom;
        const centerY =
            -(minY - padding - (canvasHeight / newZoom - height) / 2) * newZoom;

        setViewport({ x: centerX, y: centerY, zoom: newZoom });
    }, [nodes, windowSize.width, windowSize.height]);

    const handleResetZoom = useCallback(() => {
        setViewport({ x: 0, y: 0, zoom: 1 });
    }, []);

    const handleViewportChange = useCallback((x: number, y: number) => {
        setViewport((prev) => ({ ...prev, x, y }));
    }, []);

    return {
        viewport,
        setViewport,
        handleWheel,
        handleZoomIn,
        handleZoomOut,
        handleFitView,
        handleResetZoom,
        handleViewportChange,
    };
}
