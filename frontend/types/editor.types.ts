/**
 * Types and interfaces for the EditorCanvas component
 * Extracted from components/EditorCanvas.tsx for better organization
 */

/**
 * Represents the current viewport state of the editor canvas
 */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * State for creating a new connection between nodes
 */
export interface CreatingConnectionState {
  sourceNodeId: string;
  sourcePortId: string;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
}

/**
 * State for the selection box (marquee selection)
 */
export interface SelectionBoxState {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * State for delete confirmation dialog
 */
export interface DeleteConfirmState {
  open: boolean;
  nodeIds: string[];
}

/**
 * State for delete connection confirmation dialog
 */
export interface DeleteConnectionConfirmState {
  open: boolean;
  connectionId: string | null;
}

/**
 * State for context menu
 */
export interface ContextMenuState {
  x: number;
  y: number;
  type: 'node' | 'canvas';
  nodeId?: string;
}

/**
 * Metrics for node execution tracking
 */
export interface ExecutionMetric {
  nodeId: string;
  nodeName: string;
  executionTime: number;
  status: 'success' | 'error';
  timestamp: number;
}

/**
 * Props for the EditorCanvas component
 */
export interface EditorCanvasProps {
  lang: 'en' | 'es';
}
