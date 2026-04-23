import { useRef, useState, useCallback, useEffect, MouseEvent, DragEvent } from 'react';
import { WorkflowNode, Connection } from '@cairn/shared';
import { ONBOARDING_STEPS_EN, ONBOARDING_STEPS_ES } from '../components/Common';
import { useAdvancedUndoRedo } from '../hooks/useAdvancedUndoRedo';
import { NodeType } from '../components/Node';
import { useAccessibility } from '../context/AccessibilityContext';
import useWindowSize from '../hooks/useWindowSize';
import { useNodeTypes } from '../hooks/useNodeTypes';
import { useAutosave } from '../hooks/useAutosave';
import { useEditorConnections } from '../hooks/useEditorConnections';
import { EDITOR_CONFIG } from '../config/editor.config';
import { useEditorViewport } from '../hooks/useEditorViewport';
import { useEditorNodes } from '../hooks/useEditorNodes';
import { useEditorSelection } from '../hooks/useEditorSelection';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import {
  createNewNode,
  createDroppedNode,
  generateExecutionMetrics,
} from '../components/Editor/EditorCanvas.utils';
import { getAutoLayout } from '../utils/layoutUtils';

// Editor-specific types
import type {
  DeleteConfirmState,
  DeleteConnectionConfirmState,
  ContextMenuState,
  ExecutionMetric,
  ViewportState,
} from '../types/editor.types';

// Helper: Get all descendant node IDs (handles nested frames)
function getDescendantIds(parentId: string, nodes: WorkflowNode[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter(n => n.parentId === currentId);
    for (const child of children) {
      descendants.add(child.id);
      if (child.type === 'custom.frame') {
        queue.push(child.id); // Check for nested frame children
      }
    }
  }

  return descendants;
}

// Helper: Find the frame that contains a node based on position
function findContainingFrame(node: WorkflowNode, nodes: WorkflowNode[]): string | undefined {
  // Don't assign frame to itself or other frames
  if (node.type === 'custom.frame') return undefined;

  const frames = nodes.filter(n => n.type === 'custom.frame' && n.id !== node.id);

  // Calculate node center (approximate node dimensions)
  const nodeWidth = 275;
  const nodeHeight = 120;
  const nodeCenter = {
    x: node.position.x + nodeWidth / 2,
    y: node.position.y + nodeHeight / 2,
  };

  // Find the smallest (most nested) frame that contains this node
  let containingFrame: WorkflowNode | undefined;
  let smallestArea = Infinity;

  for (const frame of frames) {
    const frameConfig = frame.config as any;
    const frameWidth = frameConfig?.width || 400;
    const frameHeight = frameConfig?.height || 300;

    const isInside =
      nodeCenter.x >= frame.position.x &&
      nodeCenter.x <= frame.position.x + frameWidth &&
      nodeCenter.y >= frame.position.y &&
      nodeCenter.y <= frame.position.y + frameHeight;

    if (isInside) {
      const area = frameWidth * frameHeight;
      if (area < smallestArea) {
        smallestArea = area;
        containingFrame = frame;
      }
    }
  }

  return containingFrame?.id;
}

interface UseEditorCanvasProps {
  lang: 'en' | 'es';
  /** Persist target. Defaults to 'current-workflow' (the scratchpad)
   * when no real runbook is loaded. */
  workflowId?: string;
  /** Header used by the YAML-native save path so the round-trip
   * preserves runbook metadata (slug, description, schedule, …). */
  runbookHeader?: {
    name: string;
    slug?: string | null;
    description?: string | null;
    category?: string | null;
    schedule?: string | null;
  };
}

export function useEditorCanvas({ lang, workflowId, runbookHeader }: UseEditorCanvasProps) {
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
    draggingNode,
    setDraggingNode,
    nodeDragStart,
    setNodeDragStart,
    draggingNodeType,
    setDraggingNodeType,
    configNodeId,
    setConfigNodeId,
    handleNodeSelect,
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
    setViewport,
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleResetZoom,
    handleViewportChange,
  } = useEditorViewport({ nodes, windowSize, canvasRef });

  // Connection management
  const {
    connections,
    setConnections,
    creatingConnection,
    setCreatingConnection,
    hoveredInputNode,
    selectedConnection,
    setSelectedConnection,
    cyclicConnections,
    cycleError,
    handlePortDragStart,
    handlePortDragEnd,
    handleConfirmDeleteConnection,
    updateCreatingConnectionPosition,
    completeConnection,
    createConnection,
    clearConnectionSelection,
  } = useEditorConnections({
    nodes,
    viewport,
    canvasRef,
    executeCommand,
    announceMessage,
  });

  // Selection management
  const {
    selectionBox,
    startSelectionBox,
    updateSelectionBox,
    clearSelectionBox,
    getSelectionBoxStyle,
  } = useEditorSelection({
    nodes,
    viewport,
    canvasRef,
    selectedNodes,
    setSelectedNodes,
    draggingNode,
    creatingConnection,
  });

  // Autosave — when a real runbook is loaded via ?id= the autosave
  // targets that workflow id, so the editor edits the actual row in
  // the DB instead of the always-overwritten 'current-workflow'
  // scratchpad. The runbookHeader unlocks the YAML-native save path.
  const { saveStatus, enableAutosave, setEnableAutosave } = useAutosave({
    nodes,
    connections,
    workflowId: workflowId ?? 'current-workflow',
    runbookHeader,
    debounceMs: EDITOR_CONFIG.CANVAS.DEBOUNCE_MS,
  });

  // Local state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
    nodeIds: [],
  });
  const [deleteConnectionConfirm, setDeleteConnectionConfirm] =
    useState<DeleteConnectionConfirmState>({ open: false, connectionId: null });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetric[]>([]);
  const [editorMode, setEditorMode] = useState<'move' | 'connect'>('move');
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState(false);
  // Snap-to-grid for node drag. Persisted in localStorage so the
  // operator's preference survives reloads. Default off because the
  // existing runbooks were authored without snap and force-snapping
  // them on first edit would scramble layouts.
  const [snapToGrid, setSnapToGridState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('nanorun-editor-snap-to-grid') === '1';
  });
  const toggleSnapToGrid = useCallback(() => {
    setSnapToGridState(prev => {
      const next = !prev;
      try {
        localStorage.setItem('nanorun-editor-snap-to-grid', next ? '1' : '0');
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);
  const SNAP_GRID_PX = 20;

  const handleOpenRunDialog = () => setIsRunDialogOpen(true);
  const handleCloseRunDialog = () => setIsRunDialogOpen(false);
  const handleOpenShortcutsGuide = () => setIsShortcutsGuideOpen(true);
  const handleCloseShortcutsGuide = () => setIsShortcutsGuideOpen(false);

  // Onboarding effect
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('nanoflow-onboarding-seen');
    if (!hasSeenOnboarding && nodes.length > 0) {
      setShowOnboarding(true);
    }
  }, [nodes.length]);

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
  });

  // --- Event Handlers matching EditorCanvas logic ---

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button === 0 && !draggingNode && !creatingConnection && canvasRef.current) {
        const isShiftClick = e.shiftKey;

        // Only pan if in move mode and not shift-clicking for box selection
        if (editorMode === 'move' && !isShiftClick) {
          setIsPanning(!selectionBox);
          setPanStart({
            x: e.clientX - viewport.x,
            y: e.clientY - viewport.y,
          });
        } else if (!isShiftClick) {
          startSelectionBox(e.clientX, e.clientY);
          setConfigNodeId(null);
        }
      }
    },
    [
      viewport.x,
      viewport.y,
      draggingNode,
      creatingConnection,
      selectionBox,
      startSelectionBox,
      setConfigNodeId,
      editorMode,
    ]
  );

  const handleNodeDragStartLocal = useCallback(
    (nodeId: string, e: MouseEvent) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      setDraggingNode(nodeId);
      setNodeDragStart({
        x: e.clientX / viewport.zoom - node.position.x,
        y: e.clientY / viewport.zoom - node.position.y,
      });
    },
    [nodes, viewport.zoom, setDraggingNode, setNodeDragStart]
  );

  const handleNodeDragLocal = useCallback(
    (e: MouseEvent) => {
      if (!draggingNode) return;

      let nextX = e.clientX / viewport.zoom - nodeDragStart.x;
      let nextY = e.clientY / viewport.zoom - nodeDragStart.y;
      // Snap when enabled — round to the nearest 20px multiple
      // so the dragged node clicks into a grid cell. The grid is
      // not rendered visually because the existing GridLayer is
      // already a pattern at zoom-1 — adding it would double-paint.
      if (snapToGrid) {
        nextX = Math.round(nextX / SNAP_GRID_PX) * SNAP_GRID_PX;
        nextY = Math.round(nextY / SNAP_GRID_PX) * SNAP_GRID_PX;
      }
      const newPosition = { x: nextX, y: nextY };

      setNodes((prevNodes: WorkflowNode[]) => {
        const draggedNode = prevNodes.find(n => n.id === draggingNode);
        if (!draggedNode) return prevNodes;

        // Calculate delta from old position to new position
        const deltaX = newPosition.x - draggedNode.position.x;
        const deltaY = newPosition.y - draggedNode.position.y;

        // If dragging a frame, move all children too
        if (draggedNode.type === 'custom.frame') {
          const childIds = getDescendantIds(draggingNode, prevNodes);
          return prevNodes.map((node: WorkflowNode) => {
            if (node.id === draggingNode) {
              return { ...node, position: newPosition };
            }
            if (childIds.has(node.id)) {
              return {
                ...node,
                position: {
                  x: node.position.x + deltaX,
                  y: node.position.y + deltaY,
                },
              };
            }
            return node;
          });
        }

        // Multi-selection drag: if the node being dragged is part
        // of the current selection AND there are other selected
        // nodes, move every selected node by the same delta.
        // Falls through to single-node drag when only one node is
        // selected (or none — clicking-and-dragging an unselected
        // node).
        if (selectedNodes.has(draggingNode) && selectedNodes.size > 1) {
          return prevNodes.map((node: WorkflowNode) => {
            if (node.id === draggingNode) {
              return { ...node, position: newPosition };
            }
            if (selectedNodes.has(node.id)) {
              return {
                ...node,
                position: {
                  x: node.position.x + deltaX,
                  y: node.position.y + deltaY,
                },
              };
            }
            return node;
          });
        }

        // Regular single-node drag
        return prevNodes.map((node: WorkflowNode) =>
          node.id === draggingNode ? { ...node, position: newPosition } : node
        );
      });
    },
    [draggingNode, nodeDragStart, viewport.zoom, setNodes, selectedNodes, snapToGrid]
  );

  const handleNodeDragEndLocal = useCallback(() => {
    if (draggingNode) {
      const node = nodes.find(n => n.id === draggingNode);
      const initialPos = nodeDragStart;

      if (node) {
        const finalPos = node.position;

        // Check if node landed inside a frame (only for non-frame nodes)
        const newParentId = findContainingFrame(node, nodes);
        const oldParentId = node.parentId;

        // For frames, also track children positions for undo
        const isFrame = node.type === 'custom.frame';
        const childIds = isFrame ? getDescendantIds(draggingNode, nodes) : new Set<string>();
        const childrenInitialPositions = isFrame
          ? nodes
              .filter(n => childIds.has(n.id))
              .map(n => ({ id: n.id, position: { ...n.position } }))
          : [];
        const childrenFinalPositions = isFrame
          ? nodes
              .filter(n => childIds.has(n.id))
              .map(n => ({ id: n.id, position: { ...n.position } }))
          : [];

        // Calculate delta for undo of children
        const deltaX = finalPos.x - initialPos.x;
        const deltaY = finalPos.y - initialPos.y;

        executeCommand({
          execute: () => {
            setNodes(prev =>
              prev.map(n => {
                if (n.id === draggingNode) {
                  return { ...n, position: finalPos, parentId: newParentId };
                }
                // Restore children final positions for frame drag
                const childFinal = childrenFinalPositions.find(c => c.id === n.id);
                if (childFinal) {
                  return { ...n, position: childFinal.position };
                }
                return n;
              })
            );
          },
          undo: () => {
            setNodes(prev =>
              prev.map(n => {
                if (n.id === draggingNode) {
                  return {
                    ...n,
                    position: { x: initialPos.x, y: initialPos.y },
                    parentId: oldParentId,
                  };
                }
                // Restore children to initial positions
                if (childIds.has(n.id)) {
                  return {
                    ...n,
                    position: {
                      x: n.position.x - deltaX,
                      y: n.position.y - deltaY,
                    },
                  };
                }
                return n;
              })
            );
          },
        });
      }
    }
    setDraggingNode(null);
  }, [draggingNode, nodes, nodeDragStart, executeCommand, setNodes, setDraggingNode]);

  const handleCanvasMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isPanning && !draggingNode && !selectionBox) {
        setViewport(prev => ({
          ...prev,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }));
      }

      if (selectionBox) {
        updateSelectionBox(e.clientX, e.clientY);
      }

      if (creatingConnection && canvasRef.current) {
        updateCreatingConnectionPosition(e.clientX, e.clientY);
      }
    },
    [
      isPanning,
      panStart,
      draggingNode,
      creatingConnection,
      selectionBox,
      viewport,
      nodes,
      setViewport,
      updateSelectionBox,
      updateCreatingConnectionPosition,
    ]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    clearSelectionBox();
    completeConnection();
  }, [completeConnection, clearSelectionBox]);

  const handleOnboardingNext = useCallback(() => {
    const steps = lang === 'es' ? ONBOARDING_STEPS_ES : ONBOARDING_STEPS_EN;
    if (onboardingStep < steps.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      setShowOnboarding(false);
      localStorage.setItem('nanoflow-onboarding-seen', 'true');
    }
  }, [onboardingStep, lang]);

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem('nanoflow-onboarding-seen', 'true');
  }, []);

  const handleOnboardingClose = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem('nanoflow-onboarding-seen', 'true');
  }, []);

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
      const newNode = createNewNode(nodeType, viewport, windowSize, lang);
      setNodes(prev => [...prev, newNode]);
    },
    [viewport, lang, windowSize, setNodes]
  );

  const handleAddNode = useCallback(
    (newNode: WorkflowNode) => {
      setNodes(prev => [...prev, newNode]);
    },
    [setNodes]
  );

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

      setNodes((prev: WorkflowNode[]) => [...prev, newNode]);
      setDraggingNodeType(null);
    },
    [draggingNodeType, viewport, lang, setNodes, setDraggingNodeType]
  );

  // Refs and global event listeners
  const viewportRef = useRef(viewport);
  const nodeDragStartRef = useRef(nodeDragStart);
  const draggingNodeRef = useRef(draggingNode);
  const isPanningRef = useRef(isPanning);
  const panStartRef = useRef(panStart);
  const selectionBoxRef = useRef(selectionBox);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    nodeDragStartRef.current = nodeDragStart;
  }, [nodeDragStart]);
  useEffect(() => {
    draggingNodeRef.current = draggingNode;
  }, [draggingNode]);
  useEffect(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);
  useEffect(() => {
    panStartRef.current = panStart;
  }, [panStart]);
  useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  useEffect(() => {
    const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
      const currentZoom = viewportRef.current.zoom;

      if (draggingNodeRef.current) {
        const dragStart = nodeDragStartRef.current;
        const newPosition = {
          x: e.clientX / currentZoom - dragStart.x,
          y: e.clientY / currentZoom - dragStart.y,
        };

        setNodes(prevNodes => {
          const draggedNode = prevNodes.find(n => n.id === draggingNodeRef.current);
          if (!draggedNode) return prevNodes;

          // Calculate delta for hierarchical drag
          const deltaX = newPosition.x - draggedNode.position.x;
          const deltaY = newPosition.y - draggedNode.position.y;

          // If dragging a frame, move all children too
          if (draggedNode.type === 'custom.frame') {
            const childIds = getDescendantIds(draggingNodeRef.current!, prevNodes);
            return prevNodes.map(n => {
              if (n.id === draggingNodeRef.current) {
                return { ...n, position: newPosition };
              }
              if (childIds.has(n.id)) {
                return {
                  ...n,
                  position: {
                    x: n.position.x + deltaX,
                    y: n.position.y + deltaY,
                  },
                };
              }
              return n;
            });
          }

          // Regular node drag
          return prevNodes.map(n =>
            n.id === draggingNodeRef.current ? { ...n, position: newPosition } : n
          );
        });
      } else if (isPanningRef.current) {
        const start = panStartRef.current;
        setViewport(prev => ({
          ...prev,
          x: e.clientX - start.x,
          y: e.clientY - start.y,
        }));
      } else if (selectionBoxRef.current) {
        updateSelectionBox(e.clientX, e.clientY);
      }
    };

    const handleWindowMouseUp = () => {
      if (draggingNodeRef.current) handleNodeDragEndLocal();
      if (isPanningRef.current) setIsPanning(false);
      if (creatingConnection) setCreatingConnection(null);
      if (draggingNodeType) setDraggingNodeType(null);
      if (selectionBoxRef.current) clearSelectionBox();
    };

    if (draggingNode || isPanning || creatingConnection || draggingNodeType || selectionBox) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [
    draggingNode,
    isPanning,
    creatingConnection,
    draggingNodeType,
    selectionBox,
    handleNodeDragEndLocal,
    updateSelectionBox,
    setViewport,
    setNodes,
    setCreatingConnection,
    setDraggingNodeType,
    clearSelectionBox,
  ]);

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

  const handleCanvasClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !e.shiftKey) {
        setSelectedNodes(new Set());
        clearConnectionSelection();
      }
    },
    [clearConnectionSelection, setSelectedNodes]
  );

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
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const centerX = -(node.position.x - windowSize.width / 2 / viewport.zoom) * viewport.zoom;
        const centerY = -(node.position.y - windowSize.height / 2 / viewport.zoom) * viewport.zoom;
        setViewport(prev => ({ ...prev, x: centerX, y: centerY }));
        setSelectedNodes(new Set([nodeId]));
      }
    },
    [nodes, viewport.zoom, windowSize.width, windowSize.height, setViewport, setSelectedNodes]
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
        setNodes(prev => [...prev, newNode]);
      }
      handleCloseContextMenu();
    },
    [nodes, setNodes, handleCloseContextMenu]
  );

  const handleDeleteFromContextMenu = useCallback(() => {
    if (contextMenu?.nodeId) {
      setDeleteConfirm({ open: true, nodeIds: [contextMenu.nodeId] });
    }
    handleCloseContextMenu();
  }, [contextMenu, handleCloseContextMenu]);

  // Fit view on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitView();
    }, 100);
    return () => clearTimeout(timer);
  }, [handleFitView]);

  const handleViewportChangeAdapter = useCallback(
    (newViewport: ViewportState) => {
      setViewport(newViewport);
    },
    [setViewport]
  );

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

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      handleNodeSelect(nodeId, false);
      // Open the config panel on a single click. Previously this only
      // happened on double-click, which was not discoverable — most
      // operators thought there was no way to configure a node and
      // left every step on its defaults. Single-click + select is the
      // standard pattern in n8n / Retool / Temporal UI.
      setConfigNodeId(nodeId);
    },
    [handleNodeSelect, setConfigNodeId]
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
    highlightedNodes,
    focusedNodeIndex,
    draggingNode,
    hoveredInputNode,
    selectedConnection,
    creatingConnection,
    cyclicConnections,
    configNodeId,
    undo,
    redo,
    canUndo,
    canRedo,
    undoHistory: history,
    undoIndex: currentIndex,
    selectionBox,
    getSelectionBoxStyle,
    editorMode,
    setEditorMode,

    // Handlers
    handleMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasDrop,
    handleCanvasDragOver,
    handleCanvasClick,
    handleContextMenu,
    handleNodeDragStart: handleNodeDragStartLocal,
    handleNodeDrag: handleNodeDragLocal,
    handleNodeDragEnd: handleNodeDragEndLocal,
    handlePortDragStart,
    handlePortDragEnd,
    handleCloseContextMenu,
    handleDuplicateNode,
    handleContextMenuDuplicate,
    handleDeleteFromContextMenu,
    handleContextMenuToggleEnable,
    handleNodeClick,
    handleNodeMove,
    handleNodeUpdate, // This is already here, just need to use it
    onNodeUpdate: handleNodeUpdate, // Add this for clarity
    setNodes, // Expose raw setter for batch updates (Auto-Layout)
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
    handleViewportChangeAdapter,
    createConnection,
    handleAddNode,
    isRunDialogOpen,
    handleOpenRunDialog,
    handleCloseRunDialog,
    snapToGrid,
    toggleSnapToGrid,
  };
}
