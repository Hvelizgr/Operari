/**
 * Hook for managing multi-selection (selection box) in the editor
 * Handles selection box state, drawing, and detecting nodes within the box
 */

import { useState, useCallback, RefObject } from 'react';
import { WorkflowNode } from '../components/Editor';
import { EDITOR_CONFIG } from '../config/editor.config';
import type { SelectionBoxState, ViewportState } from '../types/editor.types';

interface UseEditorSelectionOptions {
  nodes: WorkflowNode[];
  viewport: ViewportState;
  canvasRef: RefObject<HTMLDivElement | null>;
  selectedNodes: Set<string>;
  setSelectedNodes: (nodes: Set<string>) => void;
  draggingNode: string | null;
  creatingConnection: any; // CreatingConnectionState | null
}

export function useEditorSelection({
  nodes,
  viewport,
  canvasRef,
  selectedNodes,
  setSelectedNodes,
  draggingNode,
  creatingConnection,
}: UseEditorSelectionOptions) {
  // Selection box state
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);

  // Start selection box
  const startSelectionBox = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      setSelectionBox({
        start: { x: clientX - rect.left, y: clientY - rect.top },
        end: { x: clientX - rect.left, y: clientY - rect.top },
      });
    },
    [canvasRef]
  );

  // Update selection box and detect nodes within it
  const updateSelectionBox = useCallback(
    (clientX: number, clientY: number) => {
      if (!selectionBox || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();

      // Update selection box end position
      setSelectionBox(prev =>
        prev
          ? {
              ...prev,
              end: { x: clientX - rect.left, y: clientY - rect.top },
            }
          : null
      );

      // Calculate selection box bounds
      const box = {
        x1: Math.min(selectionBox.start.x, clientX - rect.left),
        y1: Math.min(selectionBox.start.y, clientY - rect.top),
        x2: Math.max(selectionBox.start.x, clientX - rect.left),
        y2: Math.max(selectionBox.start.y, clientY - rect.top),
      };

      // Detect nodes within selection box
      const selected = new Set<string>();
      nodes.forEach(node => {
        const nodeScreenX = node.position.x * viewport.zoom + viewport.x;
        const nodeScreenY = node.position.y * viewport.zoom + viewport.y;
        const nodeWidth = EDITOR_CONFIG.CANVAS.NODE_WIDTH * viewport.zoom;
        const nodeHeight = EDITOR_CONFIG.CANVAS.NODE_HEIGHT * viewport.zoom;

        if (
          nodeScreenX < box.x2 &&
          nodeScreenX + nodeWidth > box.x1 &&
          nodeScreenY < box.y2 &&
          nodeScreenY + nodeHeight > box.y1
        ) {
          selected.add(node.id);
        }
      });

      setSelectedNodes(selected);
    },
    [selectionBox, canvasRef, nodes, viewport, setSelectedNodes]
  );

  // Clear selection box
  const clearSelectionBox = useCallback(() => {
    setSelectionBox(null);
  }, []);

  // Check if selection is active
  const isSelecting = selectionBox !== null;

  // Get selection box style for rendering
  const getSelectionBoxStyle = useCallback(() => {
    if (!selectionBox) return null;

    return {
      left: Math.min(selectionBox.start.x, selectionBox.end.x),
      top: Math.min(selectionBox.start.y, selectionBox.end.y),
      width: Math.abs(selectionBox.end.x - selectionBox.start.x),
      height: Math.abs(selectionBox.end.y - selectionBox.start.y),
    };
  }, [selectionBox]);

  return {
    // State
    selectionBox,
    setSelectionBox,
    isSelecting,

    // Handlers
    startSelectionBox,
    updateSelectionBox,
    clearSelectionBox,
    getSelectionBoxStyle,
  };
}
