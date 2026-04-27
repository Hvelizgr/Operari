/**
 * Hook for managing workflow connections state in the editor
 * Handles connection state, creation, selection, and cycle detection
 */

import { RefObject, useCallback, useEffect, useState } from 'react';

import { WorkflowNode } from '../components/Editor';
import { Connection } from '../components/Editor';
import { EDITOR_CONFIG } from '../config/editor.config';
import { INITIAL_CONNECTIONS } from '../constants/editor.constants';
import type { CreatingConnectionState, ViewportState } from '../types/editor.types';
import { getCyclicConnections, hasCycle } from '../utils/cycleDetection';

interface UseEditorConnectionsOptions {
  nodes: WorkflowNode[];
  viewport: ViewportState;
  canvasRef: RefObject<HTMLDivElement | null>;
  executeCommand: (command: { execute: () => void; undo: () => void }) => void;
  announceMessage: (message: string) => void;
}

export function useEditorConnections({
  nodes,
  viewport,
  canvasRef,
  executeCommand,
  announceMessage,
}: UseEditorConnectionsOptions) {
  // Connection state
  const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [creatingConnection, setCreatingConnection] = useState<CreatingConnectionState | null>(
    null
  );
  const [hoveredInputNode, setHoveredInputNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [cyclicConnections, setCyclicConnections] = useState<string[]>([]);
  const [cycleError, setCycleError] = useState<string | null>(null);

  // Cycle detection
  useEffect(() => {
    const result = hasCycle(nodes, connections);
    if (result.hasCycle && result.cyclePath) {
      const cyclicConns = getCyclicConnections(connections, result.cyclePath);
      setCyclicConnections(cyclicConns);
      setCycleError(`Cycle detected: ${result.cyclePath.join(' → ')}`);
    } else {
      setCyclicConnections([]);
      setCycleError(null);
    }
  }, [nodes, connections]);

  // Port drag start - initiates connection creation
  const handlePortDragStart = useCallback(
    (nodeId: string, portId: string, type: 'source' | 'target', pos: { x: number; y: number }) => {
      if (type === 'source' && canvasRef.current) {
        setCreatingConnection({
          sourceNodeId: nodeId,
          sourcePortId: portId,
          startPos: pos,
          currentPos: pos,
        });
      }
    },
    [canvasRef]
  );

  // Port drag end - cancels connection creation
  const handlePortDragEnd = useCallback(() => {
    setCreatingConnection(null);
    setHoveredInputNode(null);
  }, []);

  // Connection selection
  const handleConnectionSelect = useCallback((connectionId: string) => {
    setSelectedConnection(connectionId);
  }, []);

  // Delete connection with undo/redo
  const handleConfirmDeleteConnection = useCallback(
    (connectionId: string) => {
      const deletedConnection = connections.find(c => c.id === connectionId);

      if (deletedConnection) {
        executeCommand({
          execute: () => {
            setConnections((prev: Connection[]) => prev.filter(c => c.id !== connectionId));
            setSelectedConnection(null);
            announceMessage('Connection deleted');
          },
          undo: () => {
            setConnections((prev: Connection[]) => [...prev, deletedConnection]);
            announceMessage('Connection restored');
          },
        });
      }
    },
    [connections, executeCommand, announceMessage]
  );

  // Update creating connection position during drag
  const updateCreatingConnectionPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!creatingConnection || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      setCreatingConnection(prev =>
        prev
          ? {
              ...prev,
              currentPos: {
                x: (clientX - rect.left - viewport.x) / viewport.zoom,
                y: (clientY - rect.top - viewport.y) / viewport.zoom,
              },
            }
          : null
      );

      // Target detection: the pole buttons are tiny (24px circles
      // clipped by the edge of the card), so requiring the cursor
      // to land near the exact pole coordinate made connecting to
      // entity-shape nodes (trigger/limit/action, 64x64) or to
      // small/busy cards feel flaky. Instead: snap to any node
      // whose entire bounding box contains the cursor, OR whose
      // input-pole anchor is within SNAP_RADIUS (fallback for
      // dropping slightly beyond the node edge).
      const cursorLogical = {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
      const snapRadius = EDITOR_CONFIG.GRID.SNAP_RADIUS / viewport.zoom;

      let foundHover = false;
      for (const node of nodes) {
        if (node.id === creatingConnection.sourceNodeId) continue;
        // Frames and notes are not connection targets.
        if (node.type === 'custom.frame' || node.type === 'custom.note') continue;

        // Read the rendered node size. Entity-shape nodes
        // (trigger/action/controller/limit) are 64 (or 128 for
        // controllers) square; job cards are ~275 wide x
        // dimensions.height. Inflate the hit box by the snap
        // radius so dropping a hair past the edge still snaps.
        type WithDims = { dimensions?: { width?: number; height?: number }; type?: string };
        const nType = (node.type || '').toLowerCase();
        const isController =
          nType.includes('controller') ||
          nType === 'condition' ||
          nType === 'switch' ||
          nType === 'operari.switch' ||
          nType === 'if' ||
          nType === 'operari.if';
        const isEntity =
          nType.includes('trigger') ||
          nType === 'start' ||
          nType.includes('action') ||
          nType.includes('email') ||
          nType.includes('slack') ||
          nType.includes('discord') ||
          nType.includes('limit') ||
          nType === 'loop' ||
          nType === 'iterator' ||
          nType === 'operari.loop';

        const dims = (node as WithDims).dimensions;
        const nodeW = isController ? 128 : isEntity ? 64 : (dims?.width ?? 275);
        const nodeH = isController || isEntity ? 64 : (dims?.height ?? 120);

        const left = node.position.x - snapRadius;
        const right = node.position.x + nodeW + snapRadius;
        const top = node.position.y - snapRadius;
        const bottom = node.position.y + nodeH + snapRadius;

        if (
          cursorLogical.x >= left &&
          cursorLogical.x <= right &&
          cursorLogical.y >= top &&
          cursorLogical.y <= bottom
        ) {
          setHoveredInputNode(node.id);
          foundHover = true;
          break;
        }
      }
      if (!foundHover) {
        setHoveredInputNode(null);
      }
    },
    [creatingConnection, canvasRef, viewport, nodes]
  );

  // Complete connection creation
  const completeConnection = useCallback(() => {
    if (creatingConnection && hoveredInputNode) {
      const sourceId = creatingConnection.sourceNodeId;
      const targetId = hoveredInputNode;
      // Parse the port id (e.g. "out-1") into a numeric index
      // so the runtime engine can route the right branch (e.g.
      // approval's `approved` vs `rejected`).
      const sourcePortIdx = (() => {
        const m = /^out-(\d+)$/.exec(creatingConnection.sourcePortId ?? '');
        return m ? parseInt(m[1], 10) : 0;
      })();

      // Reject self-loops. The runtime engine has no concept of a
      // step calling itself; allowing it just produces a runbook
      // that explodes at run time.
      if (sourceId === targetId) {
        announceMessage('Self-loops are not allowed');
        setCreatingConnection(null);
        setHoveredInputNode(null);
        return;
      }

      // Reject duplicates (same source/target/sourcePort triple).
      // Two connections from different output ports of the same
      // node to the same target ARE allowed — that is the whole
      // point of multi-port branching.
      const duplicate = connections.some(
        c => c.source === sourceId && c.target === targetId && (c.sourcePort ?? 0) === sourcePortIdx
      );
      if (duplicate) {
        announceMessage('Connection already exists');
        setCreatingConnection(null);
        setHoveredInputNode(null);
        return;
      }

      // Reject connections that would introduce a cycle. Cycles
      // are still detected after-the-fact via the existing
      // cycleDetection effect (and painted red), but blocking
      // them at creation time prevents the operator from getting
      // there in the first place.
      const candidate: Connection = {
        id: `__candidate__`,
        source: sourceId,
        target: targetId,
        sourcePort: sourcePortIdx,
        targetPort: 0,
      };
      const probe = hasCycle(nodes, [...connections, candidate]);
      if (probe.hasCycle) {
        announceMessage('Connection rejected — would create a cycle');
        setCreatingConnection(null);
        setHoveredInputNode(null);
        return;
      }

      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        source: sourceId,
        target: targetId,
        sourcePort: sourcePortIdx,
        targetPort: 0,
      };

      executeCommand({
        execute: () => {
          setConnections((prev: Connection[]) => [...prev, newConnection]);
        },
        undo: () => {
          setConnections((prev: Connection[]) => prev.filter(c => c.id !== newConnection.id));
        },
      });
    }
    setCreatingConnection(null);
    setHoveredInputNode(null);
  }, [creatingConnection, hoveredInputNode, executeCommand, connections, nodes]);

  // Create connection programmatically (for soldering system - xyOps integration)
  const createConnection = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      // Mirror the same guards as completeConnection (the
      // interactive path) so the programmatic surface can't sneak
      // a bad connection in past the validation.
      if (sourceNodeId === targetNodeId) {
        announceMessage('Self-loops are not allowed');
        return false;
      }
      const exists = connections.some(c => c.source === sourceNodeId && c.target === targetNodeId);
      if (exists) {
        announceMessage('Connection already exists');
        return false;
      }
      const candidate: Connection = {
        id: '__candidate__',
        source: sourceNodeId,
        target: targetNodeId,
        sourcePort: 0,
        targetPort: 0,
      };
      const probe = hasCycle(nodes, [...connections, candidate]);
      if (probe.hasCycle) {
        announceMessage('Connection rejected — would create a cycle');
        return false;
      }

      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourcePort: 0,
        targetPort: 0,
      };

      executeCommand({
        execute: () => {
          setConnections((prev: Connection[]) => [...prev, newConnection]);
          announceMessage(`Connection created from ${sourceNodeId} to ${targetNodeId}`);
        },
        undo: () => {
          setConnections((prev: Connection[]) => prev.filter(c => c.id !== newConnection.id));
          announceMessage(`Connection removed`);
        },
      });

      return true;
    },
    [connections, executeCommand, announceMessage, nodes]
  );

  // Clear connection selection
  const clearConnectionSelection = useCallback(() => {
    setSelectedConnection(null);
  }, []);

  return {
    // State
    connections,
    setConnections,
    creatingConnection,
    setCreatingConnection,
    hoveredInputNode,
    setHoveredInputNode,
    selectedConnection,
    setSelectedConnection,
    cyclicConnections,
    cycleError,

    // Handlers
    handlePortDragStart,
    handlePortDragEnd,
    handleConnectionSelect,
    handleConfirmDeleteConnection,
    updateCreatingConnectionPosition,
    completeConnection,
    createConnection,
    clearConnectionSelection,
  };
}
