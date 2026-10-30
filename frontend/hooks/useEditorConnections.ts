/**
 * Hook for managing workflow connections state in the editor
 * Handles connection state, creation, selection, and cycle detection.
 * Dragging a wire between handles is owned by React Flow; this hook only
 * validates and persists the result.
 */

import { useCallback, useEffect, useState } from 'react';

import { WorkflowNode } from '../components/Editor';
import { Connection } from '../components/Editor';
import { INITIAL_CONNECTIONS } from '../constants/editor.constants';
import { getCyclicConnections, hasCycle } from '../utils/cycleDetection';

interface UseEditorConnectionsOptions {
  nodes: WorkflowNode[];
  executeCommand: (command: { execute: () => void; undo: () => void }) => void;
  announceMessage: (message: string) => void;
}

export function useEditorConnections({
  nodes,
  executeCommand,
  announceMessage,
}: UseEditorConnectionsOptions) {
  const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
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

  // Removing a Switch case removes its port; a wire left on it would be
  // invisible on the canvas yet still routed by the engine.
  useEffect(() => {
    const portCount = new Map(
      nodes
        .filter(n => n.type === 'operari.switch' && Array.isArray(n.outputs))
        .map(n => [n.id, n.outputs!.length])
    );
    if (portCount.size === 0) return;
    setConnections(prev => {
      const kept = prev.filter(c => {
        const count = portCount.get(c.source);
        return count === undefined || (c.sourcePort ?? 0) < count;
      });
      return kept.length === prev.length ? prev : kept;
    });
  }, [nodes]);

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

  /**
   * Persist a new connection. Returns false (and announces why) when the
   * wire is a self-loop, a duplicate of the same source port → target, or
   * would introduce a cycle. Two wires from different output ports of the
   * same node to one target ARE allowed — that is multi-port branching.
   */
  const createConnection = useCallback(
    (sourceNodeId: string, targetNodeId: string, sourcePort = 0) => {
      if (sourceNodeId === targetNodeId) {
        announceMessage('Self-loops are not allowed');
        return false;
      }
      const exists = connections.some(
        c =>
          c.source === sourceNodeId &&
          c.target === targetNodeId &&
          (c.sourcePort ?? 0) === sourcePort
      );
      if (exists) {
        announceMessage('Connection already exists');
        return false;
      }
      const candidate: Connection = {
        id: '__candidate__',
        source: sourceNodeId,
        target: targetNodeId,
        sourcePort,
        targetPort: 0,
      };
      const probe = hasCycle(nodes, [...connections, candidate]);
      if (probe.hasCycle) {
        announceMessage('Connection rejected — would create a cycle');
        return false;
      }

      const newConnection: Connection = { ...candidate, id: `conn-${Date.now()}` };

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

  const clearConnectionSelection = useCallback(() => {
    setSelectedConnection(null);
  }, []);

  return {
    connections,
    setConnections,
    selectedConnection,
    setSelectedConnection,
    cyclicConnections,
    cycleError,
    handleConnectionSelect,
    handleConfirmDeleteConnection,
    createConnection,
    clearConnectionSelection,
  };
}
