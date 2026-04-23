/**
 * Hook for managing keyboard shortcuts and navigation in the editor
 * Handles undo/redo, node navigation, selection, and deletion shortcuts
 */

import { useEffect, useState, useRef } from 'react';
import { WorkflowNode } from '../components/Editor';
import { EDITOR_CONFIG } from '../config/editor.config';
import type { DeleteConfirmState, DeleteConnectionConfirmState } from '../types/editor.types';

interface UseEditorKeyboardOptions {
  // Node state
  nodes: WorkflowNode[];
  selectedNodes: Set<string>;
  focusedNodeIndex: number;
  selectedConnection: string | null;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // State setters
  setSelectedNodes: (nodes: Set<string>) => void;
  setFocusedNodeIndex: (index: number | ((prev: number) => number)) => void;
  setDeleteConfirm: (state: DeleteConfirmState) => void;
  setDeleteConnectionConfirm: (state: DeleteConnectionConfirmState) => void;

  // Delete confirm state (to check if dialog is open)
  deleteConfirm: DeleteConfirmState;
  deleteConnectionConfirm: DeleteConnectionConfirmState;

  // Accessibility
  announceMessage: (message: string) => void;
  setNodes: (setter: (prevNodes: WorkflowNode[]) => WorkflowNode[]) => void;
}

export function useEditorKeyboard({
  nodes,
  selectedNodes,
  focusedNodeIndex,
  selectedConnection,
  undo,
  redo,
  canUndo,
  canRedo,
  setSelectedNodes,
  setFocusedNodeIndex,
  setDeleteConfirm,
  setDeleteConnectionConfirm,
  deleteConfirm,
  deleteConnectionConfirm,
  announceMessage,
  setNodes,
}: UseEditorKeyboardOptions) {
  const [clipboard, setClipboard] = useState<WorkflowNode[]>([]);

  // Copy, Cut, Paste shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Copy (Ctrl+C)
      if (isCtrlOrMeta && e.key === 'c' && selectedNodes.size > 0) {
        e.preventDefault();
        const copiedNodes = nodes.filter(n => selectedNodes.has(n.id));
        setClipboard(copiedNodes);
        announceMessage(`${copiedNodes.length} node${copiedNodes.length > 1 ? 's' : ''} copied.`);
      }

      // Cut (Ctrl+X)
      else if (isCtrlOrMeta && e.key === 'x' && selectedNodes.size > 0) {
        e.preventDefault();
        const cutNodes = nodes.filter(n => selectedNodes.has(n.id));
        setClipboard(cutNodes);
        setDeleteConfirm({ open: true, nodeIds: Array.from(selectedNodes) });
        announceMessage(`${cutNodes.length} node${cutNodes.length > 1 ? 's' : ''} cut.`);
      }

      // Paste (Ctrl+V)
      else if (isCtrlOrMeta && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        const newNodes: WorkflowNode[] = [];
        const newSelectedNodeIds = new Set<string>();

        clipboard.forEach(nodeToPaste => {
          const newNode: WorkflowNode = {
            ...nodeToPaste,
            id: `node-${Date.now()}-${Math.random()}`,
            position: {
              x: nodeToPaste.position.x + EDITOR_CONFIG.GRID.SIZE * 2,
              y: nodeToPaste.position.y + EDITOR_CONFIG.GRID.SIZE * 2,
            },
          };
          newNodes.push(newNode);
          newSelectedNodeIds.add(newNode.id);
        });

        setNodes(prevNodes => [...prevNodes, ...newNodes]);
        setSelectedNodes(newSelectedNodeIds);
        announceMessage(`${newNodes.length} node${newNodes.length > 1 ? 's' : ''} pasted.`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    nodes,
    selectedNodes,
    clipboard,
    announceMessage,
    setNodes,
    setSelectedNodes,
    setDeleteConfirm,
  ]);

  // Toggle-enable shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && selectedNodes.size > 0) {
        e.preventDefault();
        setNodes(prevNodes =>
          prevNodes.map(node =>
            selectedNodes.has(node.id) ? { ...node, enabled: !(node.enabled ?? true) } : node
          )
        );
        const newState = nodes.find(n => selectedNodes.has(n.id))?.enabled ?? true;
        announceMessage(`Selected nodes ${!newState ? 'enabled' : 'disabled'}.`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodes, setNodes, announceMessage]);

  // Undo/Redo shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Node navigation and nudging shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedNodes.size > 0) {
        // Nudging selected nodes
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -1;
        else if (e.key === 'ArrowDown') dy = 1;
        else if (e.key === 'ArrowLeft') dx = -1;
        else if (e.key === 'ArrowRight') dx = 1;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          if (e.shiftKey) {
            // Move faster with shift
            dx *= 10;
            dy *= 10;
          }
          setNodes(prevNodes =>
            prevNodes.map(node =>
              selectedNodes.has(node.id)
                ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } }
                : node
            )
          );
        }
      } else {
        // Focus navigation
        // Tab forward
        if (e.key === 'Tab' && !e.shiftKey && nodes.length > 0) {
          e.preventDefault();
          setFocusedNodeIndex(prev => (prev + 1) % nodes.length);
          announceMessage(`Focused on node ${nodes[(focusedNodeIndex + 1) % nodes.length].title}`);
        }
        // Tab backward
        else if (e.key === 'Tab' && e.shiftKey && nodes.length > 0) {
          e.preventDefault();
          setFocusedNodeIndex(prev => (prev - 1 + nodes.length) % nodes.length);
          announceMessage(
            `Focused on node ${nodes[(focusedNodeIndex - 1 + nodes.length) % nodes.length].title}`
          );
        }
        // Enter to select
        else if (e.key === 'Enter' && focusedNodeIndex >= 0) {
          e.preventDefault();
          const nodeId = nodes[focusedNodeIndex].id;
          setSelectedNodes(new Set([nodeId]));
          announceMessage(`Selected ${nodes[focusedNodeIndex].title}`);
        }
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedNodes(new Set());
        setFocusedNodeIndex(-1);
        announceMessage('Deselected all nodes');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedNodeIndex,
    nodes,
    selectedNodes,
    announceMessage,
    setFocusedNodeIndex,
    setSelectedNodes,
    setNodes,
  ]);

  // Delete shortcuts (Delete, Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDeleteKey = EDITOR_CONFIG.SHORTCUTS.DELETE.includes(e.key);

      // Delete selected nodes
      if (isDeleteKey && selectedNodes.size > 0 && !deleteConfirm.open) {
        e.preventDefault();
        setDeleteConfirm({ open: true, nodeIds: Array.from(selectedNodes) });
      }

      // Delete selected connection
      if (
        isDeleteKey &&
        selectedConnection &&
        !deleteConnectionConfirm.open &&
        selectedNodes.size === 0
      ) {
        e.preventDefault();
        setDeleteConnectionConfirm({ open: true, connectionId: selectedConnection });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodes,
    selectedConnection,
    deleteConfirm.open,
    deleteConnectionConfirm.open,
    setDeleteConfirm,
    setDeleteConnectionConfirm,
  ]);

  // This hook doesn't return anything - it just sets up event listeners
  return {};
}
