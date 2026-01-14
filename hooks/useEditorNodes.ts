/**
 * Hook for managing workflow nodes state in the editor
 * Handles node state, selection state, and related configuration
 */

import { useState, useCallback } from 'react';
import { WorkflowNode } from '../components/EditorNode';
import { NodeType } from '../components/NodePalette';
import { INITIAL_NODES } from '../constants/editor.constants';

interface UseEditorNodesOptions {
    executeCommand: (command: { execute: () => void; undo: () => void }) => void;
}

export function useEditorNodes({ executeCommand }: UseEditorNodesOptions) {
    // Node state
    const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
    const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
    const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
    const [draggingNodeType, setDraggingNodeType] = useState<NodeType | null>(null);
    const [configNodeId, setConfigNodeId] = useState<string | null>(null);

    // Node selection
    const handleNodeSelect = useCallback((nodeId: string, isShiftKey: boolean) => {
        if (isShiftKey) {
            setSelectedNodes((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(nodeId)) {
                    newSet.delete(nodeId);
                } else {
                    newSet.add(nodeId);
                }
                return newSet;
            });
        } else {
            setSelectedNodes(new Set([nodeId]));
        }
    }, []);

    // Node update with undo/redo
    const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
        // Get current node state for undo
        const oldNode = nodes.find(n => n.id === nodeId);
        if (!oldNode) return;

        const oldState = { ...oldNode };
        const newState = { ...oldNode, ...updates };

        executeCommand({
            execute: () => {
                setNodes((prev: WorkflowNode[]) =>
                    prev.map((node: WorkflowNode) =>
                        node.id === nodeId ? newState : node
                    )
                );
            },
            undo: () => {
                setNodes((prev: WorkflowNode[]) =>
                    prev.map((node: WorkflowNode) =>
                        node.id === nodeId ? oldState : node
                    )
                );
            },
        });
    }, [nodes, executeCommand]);

    // Config panel
    const handleCloseConfigPanel = useCallback(() => {
        setConfigNodeId(null);
    }, []);

    // Highlight nodes
    const handleHighlightNodes = useCallback((nodeIds: string[]) => {
        setHighlightedNodes(nodeIds);
    }, []);

    return {
        // State
        nodes,
        setNodes,
        selectedNodes,
        setSelectedNodes,
        highlightedNodes,
        draggingNode,
        setDraggingNode,
        nodeDragStart,
        setNodeDragStart,
        draggingNodeType,
        setDraggingNodeType,
        configNodeId,
        setConfigNodeId,

        // Handlers
        handleNodeSelect,
        handleNodeUpdate,
        handleCloseConfigPanel,
        handleHighlightNodes,
    };
}
