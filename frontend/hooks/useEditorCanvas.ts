import { Connection, WorkflowNode } from '@operari/shared';
import type { EdgeChange, NodeChange, XYPosition } from '@xyflow/react';
import { DragEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  createDroppedNode,
  createNewNode,
  generateExecutionMetrics,
} from '../components/Editor/EditorCanvas.utils';
import { NodeType } from '../components/Node';
import { EDITOR_CONFIG } from '../config/editor.config';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAdvancedUndoRedo } from '../hooks/useAdvancedUndoRedo';
import { useAutosave } from '../hooks/useAutosave';
import { useEditorConnections } from '../hooks/useEditorConnections';
import { useEditorDialogs } from '../hooks/useEditorDialogs';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { useEditorNodes } from '../hooks/useEditorNodes';
import { useEditorOnboarding } from '../hooks/useEditorOnboarding';
import { useEditorSnapToGrid } from '../hooks/useEditorSnapToGrid';
import { useEditorViewport } from '../hooks/useEditorViewport';
import { useNodeTypes } from '../hooks/useNodeTypes';
import useWindowSize from '../hooks/useWindowSize';
// Editor-specific types
import type {
  ContextMenuState,
  DeleteConfirmState,
  DeleteConnectionConfirmState,
  ExecutionMetric,
} from '../types/editor.types';
import {
  applyPositionChanges,
  findContainingFrame,
  getDescendantIds,
} from '../utils/canvas/frames';
import { getAutoLayout } from '../utils/layoutUtils';

interface UseEditorCanvasProps {
  lang: 'en' | 'es';
  /** Persist target. Defaults to 'current-workflow' (the scratchpad)
   * when no real runbook is loaded. */
  runbookId?: string;
  /** Header used by the YAML-native save path so the round-trip
   * preserves runbook metadata (slug, description, schedule, …). */
  runbookHeader?: {
    name: string;
    slug?: string | null;
    description?: string | null;
    category?: string | null;
    schedule?: string | null;
  };
  /** True while ?id= is still loading (or failed to load). */
  autosavePaused?: boolean;
  isActive?: boolean;
}

export function useEditorCanvas({
  lang,
  runbookId,
  runbookHeader,
  autosavePaused,
  isActive,
}: UseEditorCanvasProps) {
  const windowSize = useWindowSize();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { nodeTypes: dbNodeTypes } = useNodeTypes();
  const { executeCommand, undo, redo, canUndo, canRedo, history, currentIndex } =
    useAdvancedUndoRedo(50);
  const { highContrast, announceMessage } = useAccessibility();
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1);

  // Node management hook
  const {
    nodes,
    setNodes,
    selectedNodes,
    setSelectedNodes,
    highlightedNodes,
    draggingNodeType,
    setDraggingNodeType,
    configNodeId,
    setConfigNodeId,
    handleNodeUpdate,
    handleNodeMove,
    handleCloseConfigPanel,
    handleHighlightNodes,
  } = useEditorNodes({
    executeCommand,
  });

  // Viewport management
  const {
    viewport,
    syncViewport,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleResetZoom,
    centerOnNode,
  } = useEditorViewport();

  // Connection management
  const {
    connections,
    setConnections,
    selectedConnection,
    setSelectedConnection,
    cyclicConnections,
    cycleError,
    handleConfirmDeleteConnection,
    createConnection,
    clearConnectionSelection,
  } = useEditorConnections({
    nodes,
    executeCommand,
    announceMessage,
  });

  // Autosave — when a real runbook is loaded via ?id= the autosave
  // targets that workflow id, so the editor edits the actual row in
  // the DB instead of the always-overwritten 'current-workflow'
  // scratchpad. The runbookHeader unlocks the YAML-native save path.
  const { saveStatus, enableAutosave, setEnableAutosave, forceOverwrite, noteServerWrite } =
    useAutosave({
      nodes,
      connections,
      runbookId: runbookId ?? 'current-workflow',
      runbookHeader,
      debounceMs: EDITOR_CONFIG.CANVAS.DEBOUNCE_MS,
      paused: autosavePaused,
      isActive,
    });

  // Local state
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
    nodeIds: [],
  });
  const [deleteConnectionConfirm, setDeleteConnectionConfirm] =
    useState<DeleteConnectionConfirmState>({ open: false, connectionId: null });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetric[]>([]);
  const [editorMode, setEditorMode] = useState<'move' | 'connect'>('move');

  // Dialog toggles, onboarding flow and snap-to-grid are independent
  // of drag/select/pan arbitration — they live in their own leaf hooks
  // so this file stays focused on canvas mechanics.
  const {
    isRunDialogOpen,
    isShortcutsGuideOpen,
    handleOpenRunDialog,
    handleCloseRunDialog,
    handleOpenShortcutsGuide,
    handleCloseShortcutsGuide,
  } = useEditorDialogs();

  const {
    showOnboarding,
    onboardingStep,
    handleOnboardingNext,
    handleOnboardingSkip,
    handleOnboardingClose,
  } = useEditorOnboarding(nodes, lang);

  const { snapToGrid, toggleSnapToGrid } = useEditorSnapToGrid();

  // useEditorKeyboard runs before addNodes is declared below.
  const addNodesRef = useRef<(added: WorkflowNode[]) => void>(() => {});
  const addNodesLate = useCallback((added: WorkflowNode[]) => addNodesRef.current(added), []);

  // Keyboard shortcuts
  useEditorKeyboard({
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
    addNodes: addNodesLate,
  });

  // --- Event Handlers matching EditorCanvas logic ---

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const dragSnapshotRef = useRef<Map<
    string,
    { position: WorkflowNode['position']; parentId?: string }
  > | null>(null);

  // One undo entry per resize gesture: snapshot the frame when the
  // resizer starts, commit the command when it reports resizing=false.
  const resizeSnapshotRef = useRef<Map<string, WorkflowNode>>(new Map());

  const handleFlowNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positions = new Map<string, XYPosition>();
      const dragged = new Set<string>();
      const sizes = new Map<string, { width: number; height: number }>();
      const resizeEnded: string[] = [];
      const selection = new Map<string, boolean>();
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          positions.set(change.id, change.position);
          if (change.dragging !== undefined) dragged.add(change.id);
        } else if (change.type === 'dimensions' && change.resizing !== undefined) {
          if (!resizeSnapshotRef.current.has(change.id)) {
            const node = nodesRef.current.find(n => n.id === change.id);
            if (node) resizeSnapshotRef.current.set(change.id, node);
          }
          if (change.dimensions) sizes.set(change.id, change.dimensions);
          if (!change.resizing) resizeEnded.push(change.id);
        } else if (change.type === 'select') {
          selection.set(change.id, change.selected);
        }
      }
      if (positions.size > 0 || sizes.size > 0) {
        setNodes(prev => {
          const moved = positions.size > 0 ? applyPositionChanges(prev, positions, dragged) : prev;
          if (sizes.size === 0) return moved;
          return moved.map(n => {
            const size = sizes.get(n.id);
            return size ? { ...n, config: { ...n.config, ...size } } : n;
          });
        });
      }
      for (const id of resizeEnded) {
        const before = resizeSnapshotRef.current.get(id);
        resizeSnapshotRef.current.delete(id);
        if (!before) continue;
        // nodesRef lags the setNodes above by one render, so read the
        // committed frame inside the updater rather than from the ref.
        let after: WorkflowNode | undefined;
        setNodes(prev => {
          after = prev.find(n => n.id === id);
          return prev;
        });
        const restore = (snapshot: () => WorkflowNode | undefined) =>
          setNodes(prev => {
            const s = snapshot();
            return s ? prev.map(n => (n.id === id ? s : n)) : prev;
          });
        executeCommand({
          execute: () => restore(() => after),
          undo: () => restore(() => before),
        });
      }
      if (selection.size > 0) {
        setSelectedNodes(prev => {
          const next = new Set(prev);
          for (const [id, selected] of selection) {
            if (selected) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      }
    },
    [setNodes, setSelectedNodes, executeCommand]
  );

  const handleFlowEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type !== 'select') continue;
        if (change.selected) setSelectedConnection(change.id);
        else setSelectedConnection(prev => (prev === change.id ? null : prev));
      }
    },
    [setSelectedConnection]
  );

  const handleFlowNodeDragStart = useCallback(() => {
    dragSnapshotRef.current = new Map(
      nodesRef.current.map(n => [n.id, { position: n.position, parentId: n.parentId }])
    );
  }, []);

  const handleFlowNodeDragStop = useCallback(
    (draggedIds: string[]) => {
      const before = dragSnapshotRef.current;
      dragSnapshotRef.current = null;
      if (!before) return;

      const current = nodesRef.current;
      const dragged = new Set(draggedIds);
      const finalState = new Map<
        string,
        { position: WorkflowNode['position']; parentId?: string }
      >();
      const initialState = new Map<
        string,
        { position: WorkflowNode['position']; parentId?: string }
      >();
      for (const node of current) {
        const prev = before.get(node.id);
        if (!prev) continue;
        const parentId =
          dragged.has(node.id) && node.type !== 'custom.frame'
            ? findContainingFrame(node, current)
            : node.parentId;
        const moved =
          prev.position.x !== node.position.x ||
          prev.position.y !== node.position.y ||
          prev.parentId !== parentId;
        if (!moved) continue;
        finalState.set(node.id, { position: node.position, parentId });
        initialState.set(node.id, prev);
      }
      if (finalState.size === 0) return;

      const applyState = (
        state: Map<string, { position: WorkflowNode['position']; parentId?: string }>
      ) =>
        setNodes(prev =>
          prev.map(n => {
            const s = state.get(n.id);
            return s ? { ...n, position: s.position, parentId: s.parentId } : n;
          })
        );

      executeCommand({
        execute: () => applyState(finalState),
        undo: () => applyState(initialState),
      });
    },
    [executeCommand, setNodes]
  );

  const handleFlowConnect = useCallback(
    (source: string, target: string, sourcePort: number) => {
      createConnection(source, target, sourcePort);
    },
    [createConnection]
  );

  const addNodes = useCallback(
    (added: WorkflowNode[]) => {
      if (added.length === 0) return;
      const ids = new Set(added.map(n => n.id));
      executeCommand({
        execute: () => setNodes(prev => [...prev, ...added]),
        undo: () => {
          setNodes(prev => prev.filter(n => !ids.has(n.id)));
          setSelectedNodes(prev => new Set([...prev].filter(id => !ids.has(id))));
        },
      });
    },
    [executeCommand, setNodes, setSelectedNodes]
  );

  /** Swap in a whole new node list (auto-layout) as one undo step. */
  const replaceNodes = useCallback(
    (next: WorkflowNode[]) => {
      const before = nodesRef.current;
      executeCommand({
        execute: () => setNodes(next),
        undo: () => setNodes(before),
      });
    },
    [executeCommand, setNodes]
  );

  addNodesRef.current = addNodes;

  const handleExecutionStateChange = useCallback(
    (updatedNodes: WorkflowNode[]) => {
      setNodes((prevNodes: WorkflowNode[]) => {
        const newMetrics = generateExecutionMetrics(updatedNodes, prevNodes);

        if (newMetrics.length > 0) {
          setExecutionMetrics(prev => [...prev, ...newMetrics]);
        }
        return updatedNodes;
      });
    },
    [setNodes]
  );

  const handleNodeAddFromSearch = useCallback(
    (nodeType: NodeType) => {
      addNodes([createNewNode(nodeType, viewport, windowSize, lang)]);
    },
    [viewport, lang, windowSize, addNodes]
  );

  const handleAddNode = useCallback((newNode: WorkflowNode) => addNodes([newNode]), [addNodes]);

  const handleCanvasDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      if (!draggingNodeType || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const newNode = createDroppedNode(
        draggingNodeType,
        e.clientX,
        e.clientY,
        rect,
        viewport,
        lang
      );

      addNodes([newNode]);
      setDraggingNodeType(null);
    },
    [draggingNodeType, viewport, lang, addNodes, setDraggingNodeType]
  );

  // Deletion Logic
  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm.nodeIds.length > 0) {
      // For frames, also collect all children that will be deleted
      const allNodesToDelete = new Set(deleteConfirm.nodeIds);

      for (const nodeId of deleteConfirm.nodeIds) {
        const node = nodes.find(n => n.id === nodeId);
        if (node?.type === 'custom.frame') {
          // Get all descendants of this frame
          const descendants = getDescendantIds(nodeId, nodes);
          descendants.forEach(id => allNodesToDelete.add(id));
        }
      }

      const nodeIdsToDelete = Array.from(allNodesToDelete);
      const deletedNodes = nodes.filter(n => allNodesToDelete.has(n.id));
      const deletedConnections = connections.filter(
        c => allNodesToDelete.has(c.source) || allNodesToDelete.has(c.target)
      );

      executeCommand({
        execute: () => {
          setNodes((prev: WorkflowNode[]) => prev.filter(n => !allNodesToDelete.has(n.id)));
          setConnections((prev: Connection[]) =>
            prev.filter(c => !allNodesToDelete.has(c.source) && !allNodesToDelete.has(c.target))
          );
          setSelectedNodes(new Set());
        },
        undo: () => {
          setNodes((prev: WorkflowNode[]) => [...prev, ...deletedNodes]);
          setConnections((prev: Connection[]) => [...prev, ...deletedConnections]);
        },
      });
    }
    setDeleteConfirm({ open: false, nodeIds: [] });
  }, [
    deleteConfirm.nodeIds,
    nodes,
    connections,
    executeCommand,
    setNodes,
    setConnections,
    setSelectedNodes,
  ]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ open: false, nodeIds: [] });
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodes(new Set());
    clearConnectionSelection();
  }, [clearConnectionSelection, setSelectedNodes]);

  const handleConnectionSelectLocal = useCallback(
    (connectionId: string) => {
      setSelectedConnection(connectionId);
      setSelectedNodes(new Set());
    },
    [setSelectedConnection, setSelectedNodes]
  );

  const onConfirmDeleteConnection = useCallback(() => {
    if (deleteConnectionConfirm.connectionId) {
      handleConfirmDeleteConnection(deleteConnectionConfirm.connectionId);
    }
    setDeleteConnectionConfirm({ open: false, connectionId: null });
  }, [deleteConnectionConfirm.connectionId, handleConfirmDeleteConnection]);

  const handleCancelDeleteConnection = useCallback(() => {
    setDeleteConnectionConfirm({ open: false, connectionId: null });
  }, []);

  // Detach: Remove all connections from selected nodes
  const handleDetachConnections = useCallback(() => {
    if (selectedNodes.size === 0) return;

    const selectedNodeIds = Array.from(selectedNodes);
    const connectionsToRemove = connections.filter(
      c => selectedNodeIds.includes(c.source) || selectedNodeIds.includes(c.target)
    );

    if (connectionsToRemove.length === 0) return;

    executeCommand({
      execute: () => {
        setConnections((prev: Connection[]) =>
          prev.filter(
            c => !selectedNodeIds.includes(c.source) && !selectedNodeIds.includes(c.target)
          )
        );
      },
      undo: () => {
        setConnections((prev: Connection[]) => [...prev, ...connectionsToRemove]);
      },
    });
  }, [selectedNodes, connections, executeCommand, setConnections]);

  // Clear All: Remove all nodes and connections
  const handleClearAll = useCallback(() => {
    if (nodes.length === 0) return;

    const allNodes = [...nodes];
    const allConnections = [...connections];

    executeCommand({
      execute: () => {
        setNodes([]);
        setConnections([]);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
      },
      undo: () => {
        setNodes(allNodes);
        setConnections(allConnections);
      },
      description: 'Clear all nodes',
    });
  }, [
    nodes,
    connections,
    executeCommand,
    setNodes,
    setConnections,
    setSelectedNodes,
    setSelectedConnection,
  ]);

  const handleLoadWorkflow = useCallback(
    (loadedNodes: WorkflowNode[], loadedConnections: Connection[]) => {
      setNodes(loadedNodes);
      setConnections(loadedConnections);
      setSelectedNodes(new Set());
      setSelectedConnection(null);
    },
    [setNodes, setConnections, setSelectedNodes, setSelectedConnection]
  );

  const handleSelectTemplate = useCallback(
    (templateNodes: WorkflowNode[], templateConnections: Connection[]) => {
      // Templates from templates/*.yaml don't ship `position:` data
      // in their YAML (we stayed out of layout so the file stays
      // hand-editable). specToNodes defaults to x = index*200, y = 0
      // — which stacks every step on a single horizontal row and,
      // because job cards are 275 wide but the spacing is 200,
      // overlaps each card by 75 pixels. The user sees a tangled
      // pile of cards with cables routing through them.
      //
      // Run the dagre auto-layout so the DAG lays out cleanly
      // before it lands on the canvas. Keep the user's existing
      // fit-view/reset-zoom flow intact so they can frame it.
      const laidOut = getAutoLayout(templateNodes, templateConnections);
      setNodes(laidOut.nodes);
      setConnections(templateConnections);
      setSelectedNodes(new Set());
      setSelectedConnection(null);
    },
    [setNodes, setConnections, setSelectedNodes, setSelectedConnection]
  );

  const handleSearchNodeSelect = useCallback(
    (nodeId: string) => {
      if (!nodes.some(n => n.id === nodeId)) return;
      centerOnNode(nodeId);
      setSelectedNodes(new Set([nodeId]));
    },
    [nodes, centerOnNode, setSelectedNodes]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, type: 'node' | 'canvas', nodeId?: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type, nodeId });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const newNode = {
          ...node,
          id: `node-${Date.now()}`,
          position: { x: node.position.x + 50, y: node.position.y + 50 },
        };
        addNodes([newNode]);
      }
      handleCloseContextMenu();
    },
    [nodes, addNodes, handleCloseContextMenu]
  );

  const handleRequestDeleteSelected = useCallback(() => {
    if (selectedNodes.size > 0) {
      setDeleteConfirm({ open: true, nodeIds: Array.from(selectedNodes) });
    }
  }, [selectedNodes]);

  const handleDuplicateSelected = useCallback(() => {
    const copies = nodes
      .filter(n => selectedNodes.has(n.id))
      .map((node, i) => ({
        ...node,
        id: `node-${Date.now()}-${i}`,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
      }));
    if (copies.length === 0) return;
    addNodes(copies);
    setSelectedNodes(new Set(copies.map(n => n.id)));
  }, [nodes, selectedNodes, addNodes, setSelectedNodes]);

  const handleDeleteFromContextMenu = useCallback(() => {
    if (contextMenu?.nodeId) {
      setDeleteConfirm({ open: true, nodeIds: [contextMenu.nodeId] });
    }
    handleCloseContextMenu();
  }, [contextMenu, handleCloseContextMenu]);

  // Gentle fit-view on first load only — runs once after the initial
  // nodes are loaded, then never again. Uses a ref to track whether
  // the initial fit has already fired so React Strict Mode double-mounts
  // don't re-trigger it and navigation back to the editor doesn't
  // snap the viewport away from where the user left it.
  const hasInitialFit = useRef(false);
  useEffect(() => {
    if (hasInitialFit.current || nodes.length === 0) return;
    hasInitialFit.current = true;
    const timer = setTimeout(() => {
      handleFitView();
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const handleContextMenuToggleEnable = useCallback(() => {
    if (contextMenu?.nodeId) {
      setNodes(prevNodes =>
        prevNodes.map(node =>
          node.id === contextMenu.nodeId ? { ...node, enabled: !(node.enabled ?? true) } : node
        )
      );
    }
    handleCloseContextMenu();
  }, [contextMenu, setNodes, handleCloseContextMenu]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (contextMenu?.nodeId) {
      handleDuplicateNode(contextMenu.nodeId);
    }
  }, [contextMenu, handleDuplicateNode]);

  // Selection itself is driven by React Flow's select changes (so
  // shift/cmd-click multi-select works); a click only opens the panel.
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // Open the config panel on a single click. Previously this only
      // happened on double-click, which was not discoverable — most
      // operators thought there was no way to configure a node and
      // left every step on its defaults. Single-click + select is the
      // standard pattern in n8n / Retool / Temporal UI.
      setConfigNodeId(nodeId);
    },
    [setConfigNodeId]
  );

  return {
    // Refs
    canvasRef,
    windowSize,

    // State
    nodes,
    connections,
    viewport,
    saveStatus,
    enableAutosave,
    setEnableAutosave,
    forceOverwrite,
    noteServerWrite,
    showOnboarding,
    onboardingStep,
    contextMenu,
    deleteConfirm,
    deleteConnectionConfirm,
    highContrast,
    dbNodeTypes,
    executionMetrics,
    cycleError,
    selectedNodes,
    setSelectedNodes,
    highlightedNodes,
    focusedNodeIndex,
    selectedConnection,
    cyclicConnections,
    configNodeId,
    undo,
    redo,
    canUndo,
    canRedo,
    undoHistory: history,
    undoIndex: currentIndex,
    editorMode,
    setEditorMode,

    // Handlers
    handleFlowNodesChange,
    handleFlowEdgesChange,
    handleFlowNodeDragStart,
    handleFlowNodeDragStop,
    handleFlowConnect,
    handleCanvasDrop,
    handleCanvasDragOver,
    handlePaneClick,
    handleContextMenu,
    handleCloseContextMenu,
    handleDuplicateNode,
    handleDuplicateSelected,
    handleRequestDeleteSelected,
    handleContextMenuDuplicate,
    handleDeleteFromContextMenu,
    handleContextMenuToggleEnable,
    handleNodeClick,
    handleNodeMove,
    handleNodeUpdate, // This is already here, just need to use it
    onNodeUpdate: handleNodeUpdate, // Add this for clarity
    setNodes, // Expose raw setter for batch updates (Auto-Layout)
    addNodes,
    replaceNodes,
    handleCloseConfigPanel,
    setConfigNodeId,
    handleHighlightNodes,
    handleConnectionSelect: handleConnectionSelectLocal,
    handleConfirmDelete,
    handleCancelDelete,
    handleConfirmDeleteConnection: onConfirmDeleteConnection,
    handleCancelDeleteConnection,
    handleDetachConnections,
    handleClearAll,
    handleLoadWorkflow,
    handleSelectTemplate,
    handleSearchNodeSelect,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleResetZoom,
    handleOnboardingNext,
    handleOnboardingSkip,
    handleOnboardingClose,
    handleExecutionStateChange,
    handleNodeAddFromSearch,
    syncViewport,
    createConnection,
    handleAddNode,
    isRunDialogOpen,
    handleOpenRunDialog,
    handleCloseRunDialog,
    snapToGrid,
    toggleSnapToGrid,
  };
}
