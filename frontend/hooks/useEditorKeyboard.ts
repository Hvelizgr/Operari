/**
 * Hook for managing keyboard shortcuts and navigation in the editor
 * Handles undo/redo, node navigation, selection, and deletion shortcuts
 */

import { useEffect } from 'react';
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
}: UseEditorKeyboardOptions) {
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

    // Node navigation shortcuts (Tab, Arrow keys, Enter, Escape)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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
                announceMessage(`Focused on node ${nodes[(focusedNodeIndex - 1 + nodes.length) % nodes.length].title}`);
            }
            // Arrow Right
            else if (e.key === 'ArrowRight' && focusedNodeIndex >= 0) {
                e.preventDefault();
                setFocusedNodeIndex(prev => Math.min(prev + 1, nodes.length - 1));
                if (focusedNodeIndex < nodes.length - 1) {
                    announceMessage(`Moved to ${nodes[focusedNodeIndex + 1].title}`);
                }
            }
            // Arrow Left
            else if (e.key === 'ArrowLeft' && focusedNodeIndex >= 0) {
                e.preventDefault();
                setFocusedNodeIndex(prev => Math.max(prev - 1, 0));
                if (focusedNodeIndex > 0) {
                    announceMessage(`Moved to ${nodes[focusedNodeIndex - 1].title}`);
                }
            }
            // Enter to select
            else if (e.key === 'Enter' && focusedNodeIndex >= 0) {
                e.preventDefault();
                const nodeId = nodes[focusedNodeIndex].id;
                setSelectedNodes(new Set([nodeId]));
                announceMessage(`Selected ${nodes[focusedNodeIndex].title}`);
            }
            // Escape to deselect
            else if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedNodes(new Set());
                setFocusedNodeIndex(-1);
                announceMessage('Deselected all nodes');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedNodeIndex, nodes, announceMessage, setFocusedNodeIndex, setSelectedNodes]);

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
            if (isDeleteKey && selectedConnection && !deleteConnectionConfirm.open && selectedNodes.size === 0) {
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
