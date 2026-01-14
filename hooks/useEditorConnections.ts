/**
 * Hook for managing workflow connections state in the editor
 * Handles connection state, creation, selection, and cycle detection
 */

import { useState, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import { WorkflowNode, getNodeInputPort } from '../components/EditorNode';
import { Connection } from '../components/EditorConnection';
import { INITIAL_CONNECTIONS } from '../constants/editor.constants';
import { hasCycle, getCyclicConnections } from '../utils/cycleDetection';
import { EDITOR_CONFIG } from '../config/editor.config';
import type { CreatingConnectionState, ViewportState } from '../types/editor.types';

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
    const [creatingConnection, setCreatingConnection] = useState<CreatingConnectionState | null>(null);
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
    const handleConfirmDeleteConnection = useCallback((connectionId: string) => {
        const deletedConnection = connections.find(c => c.id === connectionId);

        if (deletedConnection) {
            executeCommand({
                execute: () => {
                    setConnections((prev: Connection[]) =>
                        prev.filter(c => c.id !== connectionId)
                    );
                    setSelectedConnection(null);
                    announceMessage('Connection deleted');
                },
                undo: () => {
                    setConnections((prev: Connection[]) => [...prev, deletedConnection]);
                    announceMessage('Connection restored');
                },
            });
        }
    }, [connections, executeCommand, announceMessage]);

    // Update creating connection position during drag
    const updateCreatingConnectionPosition = useCallback(
        (clientX: number, clientY: number) => {
            if (!creatingConnection || !canvasRef.current) return;

            const rect = canvasRef.current.getBoundingClientRect();
            setCreatingConnection((prev) =>
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

            // Check for hovered input nodes
            let foundHover = false;
            for (const node of nodes) {
                if (node.id === creatingConnection.sourceNodeId) continue;
                const inputPort = getNodeInputPort(node);
                const dx = inputPort.x - ((clientX - rect.left - viewport.x) / viewport.zoom);
                const dy = inputPort.y - ((clientY - rect.top - viewport.y) / viewport.zoom);
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < EDITOR_CONFIG.GRID.SNAP_RADIUS) {
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
            const newConnection: Connection = {
                id: `conn-${Date.now()}`,
                source: creatingConnection.sourceNodeId,
                target: hoveredInputNode,
                sourcePort: 0,
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
    }, [creatingConnection, hoveredInputNode, executeCommand]);

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
        clearConnectionSelection,
    };
}
