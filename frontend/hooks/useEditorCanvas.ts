
import { useRef, useState, useCallback, useEffect, MouseEvent, DragEvent } from 'react';
import { WorkflowNode, Connection } from '@nanoflow/shared';
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
import { createNewNode, createDroppedNode, generateExecutionMetrics } from '../components/Editor/EditorCanvas.utils';

// Editor-specific types
import type {
    DeleteConfirmState,
    DeleteConnectionConfirmState,
    ContextMenuState,
    ExecutionMetric,
    ViewportState,
} from '../types/editor.types';

interface UseEditorCanvasProps {
    lang: 'en' | 'es';
}

export function useEditorCanvas({ lang }: UseEditorCanvasProps) {
    const windowSize = useWindowSize();
    const canvasRef = useRef<HTMLDivElement>(null);
    const { nodeTypes: dbNodeTypes } = useNodeTypes();
    const { executeCommand, undo, redo, canUndo, canRedo } = useAdvancedUndoRedo(50);
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
        handleWheel,
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

    // Autosave
    const { saveStatus, enableAutosave, setEnableAutosave } = useAutosave({
        nodes,
        connections,
        workflowId: 'current-workflow',
        debounceMs: EDITOR_CONFIG.CANVAS.DEBOUNCE_MS,
    });

    // Local state
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ open: false, nodeIds: [] });
    const [deleteConnectionConfirm, setDeleteConnectionConfirm] = useState<DeleteConnectionConfirmState>({ open: false, connectionId: null });
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetric[]>([]);

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
    });

    // --- Event Handlers matching EditorCanvas logic ---

    const handleMouseDown = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (e.button === 0 && !draggingNode && !creatingConnection && canvasRef.current) {
                const isShiftClick = e.shiftKey;
                if (!isShiftClick) {
                    startSelectionBox(e.clientX, e.clientY);
                    setConfigNodeId(null);
                }
                setIsPanning(!isShiftClick && !selectionBox);
                setPanStart({
                    x: e.clientX - viewport.x,
                    y: e.clientY - viewport.y,
                });
            }
        },
        [viewport.x, viewport.y, draggingNode, creatingConnection, selectionBox, startSelectionBox, setConfigNodeId]
    );

    const handleNodeDragStartLocal = useCallback(
        (nodeId: string, e: MouseEvent) => {
            const node = nodes.find((n) => n.id === nodeId);
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

            const newPosition = {
                x: e.clientX / viewport.zoom - nodeDragStart.x,
                y: e.clientY / viewport.zoom - nodeDragStart.y,
            };

            setNodes((prevNodes: WorkflowNode[]) =>
                prevNodes.map((node: WorkflowNode) =>
                    node.id === draggingNode
                        ? { ...node, position: newPosition }
                        : node
                )
            );
        },
        [draggingNode, nodeDragStart, viewport.zoom, setNodes]
    );

    const handleNodeDragEndLocal = useCallback(() => {
        if (draggingNode) {
            const node = nodes.find(n => n.id === draggingNode);
            const initialPos = nodeDragStart;

            if (node) {
                const finalPos = node.position;

                executeCommand({
                    execute: () => {
                        setNodes(prev => prev.map(n =>
                            n.id === draggingNode ? { ...n, position: finalPos } : n
                        ));
                    },
                    undo: () => {
                        setNodes(prev => prev.map(n =>
                            n.id === draggingNode ? { ...n, position: { x: initialPos.x, y: initialPos.y } } : n
                        ));
                    },
                });
            }
        }
        setDraggingNode(null);
    }, [draggingNode, nodes, nodeDragStart, executeCommand, setNodes, setDraggingNode]);

    const handleCanvasMouseMove = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (isPanning && !draggingNode && !selectionBox) {
                setViewport((prev) => ({
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
        [isPanning, panStart, draggingNode, creatingConnection, selectionBox, viewport, nodes, setViewport, updateSelectionBox, updateCreatingConnectionPosition]
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

    const handleExecutionStateChange = useCallback((updatedNodes: WorkflowNode[]) => {
        setNodes((prevNodes: WorkflowNode[]) => {
            const newMetrics = generateExecutionMetrics(updatedNodes, prevNodes);

            if (newMetrics.length > 0) {
                setExecutionMetrics(prev => [...prev, ...newMetrics]);
            }
            return updatedNodes;
        });
    }, [setNodes]);

    const handleNodeAddFromSearch = useCallback((nodeType: NodeType) => {
        const newNode = createNewNode(nodeType, viewport, windowSize, lang);
        setNodes(prev => [...prev, newNode]);
    }, [viewport, lang, windowSize, setNodes]);

    const handleCanvasDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleCanvasDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        if (!draggingNodeType || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const newNode = createDroppedNode(draggingNodeType, e.clientX, e.clientY, rect, viewport, lang);

        setNodes((prev: WorkflowNode[]) => [...prev, newNode]);
        setDraggingNodeType(null);
    }, [draggingNodeType, viewport, lang, setNodes, setDraggingNodeType]);

    // Refs and global event listeners
    const viewportRef = useRef(viewport);
    const nodeDragStartRef = useRef(nodeDragStart);
    const draggingNodeRef = useRef(draggingNode);
    const isPanningRef = useRef(isPanning);
    const panStartRef = useRef(panStart);
    const selectionBoxRef = useRef(selectionBox);

    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { nodeDragStartRef.current = nodeDragStart; }, [nodeDragStart]);
    useEffect(() => { draggingNodeRef.current = draggingNode; }, [draggingNode]);
    useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
    useEffect(() => { panStartRef.current = panStart; }, [panStart]);
    useEffect(() => { selectionBoxRef.current = selectionBox; }, [selectionBox]);

    useEffect(() => {
        const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
            const currentZoom = viewportRef.current.zoom;

            if (draggingNodeRef.current) {
                const dragStart = nodeDragStartRef.current;
                const newPosition = {
                    x: e.clientX / currentZoom - dragStart.x,
                    y: e.clientY / currentZoom - dragStart.y,
                };

                setNodes((prevNodes) =>
                    prevNodes.map((n) =>
                        n.id === draggingNodeRef.current ? { ...n, position: newPosition } : n
                    )
                );
            } else if (isPanningRef.current) {
                const start = panStartRef.current;
                setViewport((prev) => ({
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
    }, [draggingNode, isPanning, creatingConnection, draggingNodeType, selectionBox, handleNodeDragEndLocal, updateSelectionBox, setViewport, setNodes, setCreatingConnection, setDraggingNodeType, clearSelectionBox]);

    // Deletion Logic
    const handleConfirmDelete = useCallback(() => {
        if (deleteConfirm.nodeIds.length > 0) {
            const deletedNodes = nodes.filter(n => deleteConfirm.nodeIds.includes(n.id));
            const deletedConnections = connections.filter(c =>
                deleteConfirm.nodeIds.includes(c.source) || deleteConfirm.nodeIds.includes(c.target)
            );

            executeCommand({
                execute: () => {
                    setNodes((prev: WorkflowNode[]) => prev.filter(n => !deleteConfirm.nodeIds.includes(n.id)));
                    setConnections((prev: Connection[]) =>
                        prev.filter(c => !deleteConfirm.nodeIds.includes(c.source) && !deleteConfirm.nodeIds.includes(c.target))
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
    }, [deleteConfirm.nodeIds, nodes, connections, executeCommand, setNodes, setConnections, setSelectedNodes]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirm({ open: false, nodeIds: [] });
    }, []);

    const handleCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !e.shiftKey) {
            setSelectedNodes(new Set());
            clearConnectionSelection();
        }
    }, [clearConnectionSelection, setSelectedNodes]);

    const handleConnectionSelectLocal = useCallback((connectionId: string) => {
        setSelectedConnection(connectionId);
        setSelectedNodes(new Set());
    }, [setSelectedConnection, setSelectedNodes]);

    const onConfirmDeleteConnection = useCallback(() => {
        if (deleteConnectionConfirm.connectionId) {
            handleConfirmDeleteConnection(deleteConnectionConfirm.connectionId);
        }
        setDeleteConnectionConfirm({ open: false, connectionId: null });
    }, [deleteConnectionConfirm.connectionId, handleConfirmDeleteConnection]);

    const handleCancelDeleteConnection = useCallback(() => {
        setDeleteConnectionConfirm({ open: false, connectionId: null });
    }, []);

    const handleLoadWorkflow = useCallback((loadedNodes: WorkflowNode[], loadedConnections: Connection[]) => {
        setNodes(loadedNodes);
        setConnections(loadedConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
    }, [setNodes, setConnections, setSelectedNodes, setSelectedConnection]);

    const handleSelectTemplate = useCallback((templateNodes: WorkflowNode[], templateConnections: Connection[]) => {
        setNodes(templateNodes);
        setConnections(templateConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
    }, [setNodes, setConnections, setSelectedNodes, setSelectedConnection]);

    const handleSearchNodeSelect = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const centerX = -(node.position.x - windowSize.width / 2 / viewport.zoom) * viewport.zoom;
            const centerY = -(node.position.y - windowSize.height / 2 / viewport.zoom) * viewport.zoom;
            setViewport(prev => ({ ...prev, x: centerX, y: centerY }));
            setSelectedNodes(new Set([nodeId]));
        }
    }, [nodes, viewport.zoom, windowSize.width, windowSize.height, setViewport, setSelectedNodes]);

    const handleContextMenu = useCallback((e: React.MouseEvent, type: 'node' | 'canvas', nodeId?: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type, nodeId });
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleDuplicateNode = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const newNode = {
                ...node,
                id: `node-${Date.now()}`,
                position: { x: node.position.x + 50, y: node.position.y + 50 },
            };
            setNodes((prev) => [...prev, newNode]);
        }
        handleCloseContextMenu();
    }, [nodes, setNodes, handleCloseContextMenu]);

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

    const handleViewportChangeAdapter = useCallback((newViewport: ViewportState) => {
        setViewport(newViewport);
    }, [setViewport]);

    const handleContextMenuDuplicate = useCallback(() => {
        if (contextMenu?.nodeId) {
            handleDuplicateNode(contextMenu.nodeId);
        }
    }, [contextMenu, handleDuplicateNode]);

    const handleNodeClick = useCallback((nodeId: string) => {
        handleNodeSelect(nodeId, false);
    }, [handleNodeSelect]);

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
        selectionBox,
        getSelectionBoxStyle,

        // Handlers
        handleWheel,
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
        handleNodeSelect,
        handleNodeClick, // New stable handler
        handleNodeMove,
        handleNodeUpdate,
        handleCloseConfigPanel,
        handleHighlightNodes,
        handleConnectionSelect: handleConnectionSelectLocal,
        handleConfirmDelete,
        handleCancelDelete,
        handleConfirmDeleteConnection: onConfirmDeleteConnection,
        handleCancelDeleteConnection,
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
    };
}
