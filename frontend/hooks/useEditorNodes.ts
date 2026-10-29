/**
 * Hook for managing workflow nodes state in the editor
 * Handles node state, selection state, and related configuration
 */

import { useCallback, useState } from 'react';

import { WorkflowNode } from '../components/Editor';
import { NodeType } from '../components/Node';
import { INITIAL_NODES } from '../constants/editor.constants';

interface UseEditorNodesOptions {
  executeCommand: (command: { execute: () => void; undo: () => void }) => void;
}

export function useEditorNodes({ executeCommand }: UseEditorNodesOptions) {
  // Node state
  const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [draggingNodeType, setDraggingNodeType] = useState<NodeType | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);

  // Node selection
  const handleNodeSelect = useCallback((nodeId: string, isShiftKey: boolean) => {
    if (isShiftKey) {
      setSelectedNodes(prev => {
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

  // Real user edits (config, title, retry policy, etc.) go through
  // executeCommand so undo/redo can rewind them. The old state is
  // captured INSIDE the setNodes callback so the snapshot is always from
  // the committed state, not a stale closure.
  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<WorkflowNode>) => {
      let capturedOldState: WorkflowNode | null = null;
      executeCommand({
        execute: () => {
          setNodes((prev: WorkflowNode[]) => {
            const oldNode = prev.find(n => n.id === nodeId);
            if (!oldNode) return prev;
            capturedOldState = { ...oldNode };
            return prev.map((node: WorkflowNode) =>
              node.id === nodeId ? { ...node, ...updates } : node
            );
          });
        },
        undo: () => {
          if (!capturedOldState) return;
          const snapshot = capturedOldState;
          setNodes((prev: WorkflowNode[]) =>
            prev.map((node: WorkflowNode) => (node.id === nodeId ? snapshot : node))
          );
        },
      });
    },
    [executeCommand]
  );

  // Config panel
  const handleCloseConfigPanel = useCallback(() => {
    setConfigNodeId(null);
  }, []);

  // Highlight nodes
  const handleHighlightNodes = useCallback((nodeIds: string[]) => {
    setHighlightedNodes(nodeIds);
  }, []);

  // Move node by keyboard
  const handleNodeMove = useCallback(
    (nodeId: string, direction: 'up' | 'down' | 'left' | 'right') => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      const moveAmount = 20; // EDITOR_CONFIG.CANVAS.MOVE_STEP
      const newPosition = { ...node.position };

      switch (direction) {
        case 'up':
          newPosition.y -= moveAmount;
          break;
        case 'down':
          newPosition.y += moveAmount;
          break;
        case 'left':
          newPosition.x -= moveAmount;
          break;
        case 'right':
          newPosition.x += moveAmount;
          break;
      }

      handleNodeUpdate(nodeId, { position: newPosition });
    },
    [nodes, handleNodeUpdate]
  );

  return {
    // State
    nodes,
    setNodes,
    selectedNodes,
    setSelectedNodes,
    highlightedNodes,
    draggingNodeType,
    setDraggingNodeType,
    configNodeId,
    setConfigNodeId,

    // Handlers
    handleNodeSelect,
    handleNodeUpdate,
    handleNodeMove,
    handleCloseConfigPanel,
    handleHighlightNodes,
  };
}
