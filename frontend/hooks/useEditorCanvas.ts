
import { useRef, useState, useCallback, useEffect, useMemo, MouseEvent, DragEvent } from 'react';
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
import { useBlastRadius } from '../hooks/useBlastRadius';
import { useExecutionHeatmap } from '../hooks/useExecutionHeatmap';
import { apiFetch } from '../utils/api';
import { createNewNode, createDroppedNode, generateExecutionMetrics } from '../components/Editor/EditorCanvas.utils';
import { useCollaboration } from './useCollaboration';
import { getAutoLayout } from '../utils/layoutUtils';
import { calculateComplexityScore } from '../utils/complexityScore';
import { scanWorkflowSecurity } from '../utils/securityScanner';
import { lintWorkflow } from '../utils/architectureLinter';

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
    confettiCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function useEditorCanvas({ lang, confettiCanvasRef }: UseEditorCanvasProps) {
    const windowSize = useWindowSize();
    const canvasRef = useRef<HTMLDivElement>(null);
    const { nodeTypes: dbNodeTypes } = useNodeTypes();
    const { executeCommand, undo, redo, canUndo, canRedo, history, currentIndex } = useAdvancedUndoRedo(50);
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
        createConnection,
        clearConnectionSelection,
    } = useEditorConnections({
        nodes,
        viewport,
        canvasRef,
        confettiCanvasRef,
        executeCommand,
        announceMessage,
    });

    // Blast Radius (Impact Analysis)
    const {
        blastRadiusMode,
        focusedNodeId: blastRadiusFocusedNode,
        blastRadius,
        affectedConnections: blastRadiusConnections,
        setBlastRadiusMode,
        setFocusedNode: setBlastRadiusFocusedNode,
        toggleBlastRadiusMode,
        isNodeInBlastRadius,
        isNodeDimmed,
        isConnectionInBlastRadius,
        getNodeBlastRadiusStyle,
    } = useBlastRadius({ connections });

    // Execution Heatmap
    const [heatmapEnabled, setHeatmapEnabled] = useState(false);
    const {
        recordExecution,
        getNodeHeatLevel,
        getNodeHeatColor,
        getNodeBorderColor,
        getNodeStats,
        clearStats
    } = useExecutionHeatmap({ enabled: heatmapEnabled });

    const toggleHeatmap = useCallback(async () => {
        const newState = !heatmapEnabled;
        setHeatmapEnabled(newState);

        if (newState) {
            try {
                // Fetch stats from backend to populate heatmap (hardcoded ID for now as per system design)
                const data = await apiFetch('/api/analytics/workflows/current-workflow/stats');
                if (data.nodeStats && Array.isArray(data.nodeStats)) {
                    clearStats();
                    data.nodeStats.forEach((stat: any) => {
                        // Adapt API response to Heatmap hook expected format
                        recordExecution(
                            stat.nodeId,
                            stat.status === 'SUCCESS',
                            stat._avg?.duration || 0
                        );
                    });
                }
            } catch (error) {
                console.error('Failed to fetch heatmap stats', error);
            }
        }
    }, [heatmapEnabled, clearStats, recordExecution]);

    // --- REAL-TIME COLLABORATION ---
    const [currentUser, setCurrentUser] = useState<any>(null);
    useEffect(() => {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('nanoflow_user') : null;
        if (userStr) {
            try {
                setCurrentUser(JSON.parse(userStr));
            } catch {
                localStorage.removeItem('nanoflow_user');
                setCurrentUser({ id: 'anon-' + Math.random().toString(36).substr(2, 5), name: 'Anonymous' });
            }
        } else {
            setCurrentUser({ id: 'anon-' + Math.random().toString(36).substr(2, 5), name: 'Anonymous' });
        }
    }, []);

    const { remoteUsers, broadcastChanges, broadcastCursor } = useCollaboration(
        'current-workflow', // Global room for now
        currentUser,
        { nodes, connections, setNodes, setConnections }
    );

    // Broadcast local changes
    useEffect(() => {
        broadcastChanges({ nodes, connections });
    }, [nodes, connections, broadcastChanges]);

    // --- FETCH INITIAL WORKFLOW ---
    useEffect(() => {
        const fetchWorkflow = async () => {
            try {
                // If URL has ?reset=true, clear local storage
                if (typeof window !== 'undefined' && window.location.search.includes('reset=true')) {
                    localStorage.removeItem('nanoflow-workflow-current-workflow');
                    window.history.replaceState({}, '', window.location.pathname); // remove query param
                }

                // Try to load from API
                const response = await fetch('/api/workflows/current-workflow');
                if (response.ok) {
                    const data = await response.json();

                    if (data.nodes && Array.isArray(data.nodes)) {
                        console.log('Fetching workflow from server:', data.name);

                        // Check if we have unsaved local changes that are NEWER?
                        // For now, let's PRIORITIZE server if we are loading the page
                        // But useAutosave might overwrite it back if we don't sync.

                        // Filter out duplicate IDs (keep first occurrence)
                        const seenNodeIds = new Set<string>();
                        const uniqueNodes = data.nodes.filter((node: any) => {
                            if (seenNodeIds.has(node.id)) {
                                console.warn(`Duplicate node ID detected and removed: ${node.id}`);
                                return false;
                            }
                            seenNodeIds.add(node.id);
                            return true;
                        });

                        const seenConnIds = new Set<string>();
                        const uniqueConnections = (data.connections || []).filter((conn: any) => {
                            if (seenConnIds.has(conn.id)) {
                                console.warn(`Duplicate connection ID detected and removed: ${conn.id}`);
                                return false;
                            }
                            seenConnIds.add(conn.id);
                            return true;
                        });

                        setNodes(uniqueNodes);
                        setConnections(uniqueConnections);

                        // Force sync local storage to match server to prevent conflict
                        localStorage.setItem('nanoflow-workflow-current-workflow', JSON.stringify({
                            nodes: uniqueNodes,
                            connections: uniqueConnections,
                            version: '1.0',
                            timestamp: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
                            workflowId: 'current-workflow'
                        }));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch initial workflow:', error);
            }
        };

        fetchWorkflow();
    }, [setNodes, setConnections]);

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
    const { saveStatus, enableAutosave, setEnableAutosave, forceSave } = useAutosave({
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
    const [editorMode, setEditorMode] = useState<'move' | 'connect'>('move');
    const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
    const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState(false);

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
        [viewport.x, viewport.y, draggingNode, creatingConnection, selectionBox, startSelectionBox, setConfigNodeId, editorMode]
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

                // Regular node drag
                return prevNodes.map((node: WorkflowNode) =>
                    node.id === draggingNode
                        ? { ...node, position: newPosition }
                        : node
                );
            });
        },
        [draggingNode, nodeDragStart, viewport.zoom, setNodes]
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
                    ? nodes.filter(n => childIds.has(n.id)).map(n => ({ id: n.id, position: { ...n.position } }))
                    : [];
                const childrenFinalPositions = isFrame
                    ? nodes.filter(n => childIds.has(n.id)).map(n => ({ id: n.id, position: { ...n.position } }))
                    : [];

                // Calculate delta for undo of children
                const deltaX = finalPos.x - initialPos.x;
                const deltaY = finalPos.y - initialPos.y;

                executeCommand({
                    execute: () => {
                        setNodes(prev => prev.map(n => {
                            if (n.id === draggingNode) {
                                return { ...n, position: finalPos, parentId: newParentId };
                            }
                            // Restore children final positions for frame drag
                            const childFinal = childrenFinalPositions.find(c => c.id === n.id);
                            if (childFinal) {
                                return { ...n, position: childFinal.position };
                            }
                            return n;
                        }));
                    },
                    undo: () => {
                        setNodes(prev => prev.map(n => {
                            if (n.id === draggingNode) {
                                return { ...n, position: { x: initialPos.x, y: initialPos.y }, parentId: oldParentId };
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
                        }));
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

            // Sync cursor position for collaboration
            const worldX = (e.clientX - viewport.x) / viewport.zoom;
            const worldY = (e.clientY - viewport.y) / viewport.zoom;
            broadcastCursor({ x: worldX, y: worldY });
        },
        [isPanning, panStart, draggingNode, creatingConnection, selectionBox, viewport, nodes, setViewport, updateSelectionBox, updateCreatingConnectionPosition, broadcastCursor]
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

    const handleNodeAddFromSearch = useCallback((nodeType: NodeType | string, x?: number, y?: number) => {
        const position = (x !== undefined && y !== undefined) 
            ? { x: (x - viewport.x) / viewport.zoom, y: (y - viewport.y) / viewport.zoom }
            : undefined;
        const newNode = createNewNode(nodeType, viewport, windowSize, lang, position);
        setNodes(prev => [...prev, newNode]);
    }, [viewport, lang, windowSize, setNodes]);

    const handleAddNode = useCallback((newNode: WorkflowNode) => {
        setNodes(prev => [...prev, newNode]);
    }, [setNodes]);

    const handleCanvasDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleCanvasDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        if (!canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const fileExtension = file.name.split('.').pop()?.toLowerCase();
            
            let nodeType = 'ReadFile';
            if (fileExtension === 'pdf') {
                nodeType = 'ExtractTextFromPDF';
            } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExtension || '')) {
                nodeType = 'ExtractTextFromImage';
            } else if (['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
                nodeType = 'SpreadsheetFile';
            } else if (['json'].includes(fileExtension || '')) {
                nodeType = 'ReadJSON';
            }

            const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
            const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;
            
            const newNode: WorkflowNode = {
                id: `${nodeType}-${Date.now()}`,
                type: nodeType,
                title: file.name,
                position: { x, y },
                config: { 
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                },
                inputs: [],
                outputs: [{ id: 'output', label: 'Output' }],
                enabled: true,
            };

            setNodes((prev: WorkflowNode[]) => [...prev, newNode]);
            return;
        }

        if (!draggingNodeType) return;

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
    const creatingConnectionRef = useRef(creatingConnection);
    const draggingNodeTypeRef = useRef(draggingNodeType);

    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { nodeDragStartRef.current = nodeDragStart; }, [nodeDragStart]);
    useEffect(() => { draggingNodeRef.current = draggingNode; }, [draggingNode]);
    useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
    useEffect(() => { panStartRef.current = panStart; }, [panStart]);
    useEffect(() => { selectionBoxRef.current = selectionBox; }, [selectionBox]);
    useEffect(() => { creatingConnectionRef.current = creatingConnection; }, [creatingConnection]);
    useEffect(() => { draggingNodeTypeRef.current = draggingNodeType; }, [draggingNodeType]);

    // Refs for handlers to avoid restarting effect on node/viewport updates
    const handleNodeDragEndLocalRef = useRef(handleNodeDragEndLocal);
    const updateSelectionBoxRef = useRef(updateSelectionBox);
    const clearSelectionBoxRef = useRef(clearSelectionBox);
    const updateCreatingConnectionPositionRef = useRef(updateCreatingConnectionPosition);

    useEffect(() => { handleNodeDragEndLocalRef.current = handleNodeDragEndLocal; }, [handleNodeDragEndLocal]);
    useEffect(() => { updateSelectionBoxRef.current = updateSelectionBox; }, [updateSelectionBox]);
    useEffect(() => { clearSelectionBoxRef.current = clearSelectionBox; }, [clearSelectionBox]);
    useEffect(() => { updateCreatingConnectionPositionRef.current = updateCreatingConnectionPosition; }, [updateCreatingConnectionPosition]);

    // Use current Nodes in ref to avoid dependency cycle in effect
    const nodesRef = useRef(nodes);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);

    // Refs for setters to avoid re-running the effect when they change
    const setNodesRef = useRef(setNodes);
    const setViewportRef = useRef(setViewport);
    const setCreatingConnectionRef = useRef(setCreatingConnection);
    const setDraggingNodeTypeRef = useRef(setDraggingNodeType);
    const setIsPanningRef = useRef(setIsPanning);

    useEffect(() => { setNodesRef.current = setNodes; }, [setNodes]);
    useEffect(() => { setViewportRef.current = setViewport; }, [setViewport]);
    useEffect(() => { setCreatingConnectionRef.current = setCreatingConnection; }, [setCreatingConnection]);
    useEffect(() => { setDraggingNodeTypeRef.current = setDraggingNodeType; }, [setDraggingNodeType]);
    useEffect(() => { setIsPanningRef.current = setIsPanning; }, [setIsPanning]);

    useEffect(() => {
        let animationFrameId: number;

        const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
            const currentZoom = viewportRef.current.zoom;

            if (draggingNodeRef.current) {
                const dragStart = nodeDragStartRef.current;
                const newX = e.clientX / currentZoom - dragStart.x;
                const newY = e.clientY / currentZoom - dragStart.y;

                // --- THROTTLE & OPTIMIZE UPDATES ---
                // Cancel previous frame if exists to prevent stacking
                if (animationFrameId) cancelAnimationFrame(animationFrameId);

                animationFrameId = requestAnimationFrame(() => {
                    const draggedNodeId = draggingNodeRef.current;
                    if (!draggedNodeId) return;

                    setNodesRef.current((prevNodes) => {
                        const draggedNode = prevNodes.find(n => n.id === draggedNodeId);
                        if (!draggedNode) return prevNodes;

                        const newPosition = { x: newX, y: newY };

                        // Basic diff check to prevent renders if mouse didn't move enough
                        if (Math.abs(draggedNode.position.x - newPosition.x) < 0.5 && 
                            Math.abs(draggedNode.position.y - newPosition.y) < 0.5) {
                            return prevNodes;
                        }

                        // Calculate delta for hierarchical drag
                        const deltaX = newPosition.x - draggedNode.position.x;
                        const deltaY = newPosition.y - draggedNode.position.y;

                        // If dragging a frame, move all children too
                        if (draggedNode.type === 'custom.frame') {
                            const childIds = getDescendantIds(draggedNodeId, prevNodes);
                            return prevNodes.map((n) => {
                                if (n.id === draggedNodeId) {
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
                        return prevNodes.map((n) =>
                            n.id === draggedNodeId ? { ...n, position: newPosition } : n
                        );
                    });
                });
            } else if (isPanningRef.current) {
                const start = panStartRef.current;
                setViewportRef.current((prev) => ({
                    ...prev,
                    x: e.clientX - start.x,
                    y: e.clientY - start.y,
                }));
            } else if (creatingConnectionRef.current) {
                updateCreatingConnectionPositionRef.current(e.clientX, e.clientY);
            } else if (selectionBoxRef.current) {
                updateSelectionBoxRef.current(e.clientX, e.clientY);
            }
        };

        const handleWindowMouseUp = () => {
            if (draggingNodeRef.current) handleNodeDragEndLocalRef.current();
            if (isPanningRef.current) setIsPanningRef.current(false);
            if (creatingConnectionRef.current) setCreatingConnectionRef.current(null);
            if (draggingNodeTypeRef.current) setDraggingNodeTypeRef.current(null);
            if (selectionBoxRef.current) clearSelectionBoxRef.current();
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
        !!draggingNode,
        isPanning,
        !!creatingConnection,
        !!draggingNodeType,
        !!selectionBox,
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
            const deletedConnections = connections.filter(c =>
                allNodesToDelete.has(c.source) || allNodesToDelete.has(c.target)
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
    }, [deleteConfirm.nodeIds, nodes, connections, executeCommand, setNodes, setConnections, setSelectedNodes]);


    const handleCancelDelete = useCallback(() => {
        setDeleteConfirm({ open: false, nodeIds: [] });
    }, []);

    // Delete a single node by ID with proper connection cleanup (for hover toolbar)
    const handleDeleteNodeById = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // For frames, collect all children that will be deleted
        const allNodesToDelete = new Set([nodeId]);
        if (node.type === 'custom.frame') {
            const descendants = getDescendantIds(nodeId, nodes);
            descendants.forEach(id => allNodesToDelete.add(id));
        }

        const deletedNodes = nodes.filter(n => allNodesToDelete.has(n.id));
        const deletedConnections = connections.filter(c =>
            allNodesToDelete.has(c.source) || allNodesToDelete.has(c.target)
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
    }, [nodes, connections, executeCommand, setNodes, setConnections, setSelectedNodes]);

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

    // Detach: Remove all connections from selected nodes
    const handleDetachConnections = useCallback(() => {
        if (selectedNodes.size === 0) return;

        const selectedNodeIds = Array.from(selectedNodes);
        const connectionsToRemove = connections.filter(c =>
            selectedNodeIds.includes(c.source) || selectedNodeIds.includes(c.target)
        );

        if (connectionsToRemove.length === 0) return;

        executeCommand({
            execute: () => {
                setConnections((prev: Connection[]) =>
                    prev.filter(c =>
                        !selectedNodeIds.includes(c.source) && !selectedNodeIds.includes(c.target)
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
    }, [nodes, connections, executeCommand, setNodes, setConnections, setSelectedNodes, setSelectedConnection]);

    const handleLoadWorkflow = useCallback((loadedNodes: WorkflowNode[], loadedConnections: Connection[]) => {
        // Filter out duplicate IDs
        const seenNodeIds = new Set<string>();
        const uniqueNodes = loadedNodes.filter((node) => {
            if (seenNodeIds.has(node.id)) {
                console.warn(`Duplicate node ID in loaded workflow: ${node.id}`);
                return false;
            }
            seenNodeIds.add(node.id);
            return true;
        });

        const seenConnIds = new Set<string>();
        const uniqueConnections = loadedConnections.filter((conn) => {
            if (seenConnIds.has(conn.id)) {
                console.warn(`Duplicate connection ID in loaded workflow: ${conn.id}`);
                return false;
            }
            seenConnIds.add(conn.id);
            return true;
        });

        setNodes(uniqueNodes);
        setConnections(uniqueConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
    }, [setNodes, setConnections, setSelectedNodes, setSelectedConnection]);

    const handleSelectTemplate = useCallback((templateNodes: WorkflowNode[], templateConnections: Connection[]): { nodes: WorkflowNode[], connections: Connection[] } => {
        // Generate unique IDs for all nodes to avoid conflicts with previous executions
        const timestamp = Date.now();
        const idMap = new Map<string, string>(); // Maps old ID to new ID

        // Create nodes with new unique IDs
        const newNodes = templateNodes.map((node, index) => {
            const newId = `${node.type}-${timestamp}-${index}`;
            idMap.set(node.id, newId);
            return {
                ...node,
                id: newId,
                // Update parentId if it exists (for frames)
                parentId: node.parentId ? undefined : undefined, // Will be resolved after all IDs are mapped
            };
        });

        // Update parentId references after all IDs are mapped
        const nodesWithParents = newNodes.map(node => {
            const originalNode = templateNodes.find(n => idMap.get(n.id) === node.id);
            if (originalNode?.parentId && idMap.has(originalNode.parentId)) {
                return { ...node, parentId: idMap.get(originalNode.parentId) };
            }
            return node;
        });

        // Create connections with new IDs and updated source/target references
        const newConnections = templateConnections.map((conn, index) => ({
            ...conn,
            id: `conn-${timestamp}-${index}`,
            source: idMap.get(conn.source) || conn.source,
            target: idMap.get(conn.target) || conn.target,
        }));

        // Filter out any connections with unmapped sources/targets
        const validConnections = newConnections.filter(conn =>
            nodesWithParents.some(n => n.id === conn.source) &&
            nodesWithParents.some(n => n.id === conn.target)
        );

        setNodes(nodesWithParents);
        setConnections(validConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);

        // Return transformed data for immediate use (e.g., forceSave)
        return { nodes: nodesWithParents, connections: validConnections };
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
        setNodes((prev) => {
            const node = prev.find(n => n.id === nodeId);
            if (node) {
                const newNode = {
                    ...node,
                    id: `node-${Date.now()}`,
                    position: { x: node.position.x + 50, y: node.position.y + 50 },
                };
                return [...prev, newNode];
            }
            return prev;
        });
        handleCloseContextMenu();
    }, [setNodes, handleCloseContextMenu]);

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

    const handleContextMenuToggleEnable = useCallback(() => {
        if (contextMenu?.nodeId) {
            setNodes(prevNodes =>
                prevNodes.map(node =>
                    node.id === contextMenu.nodeId
                        ? { ...node, enabled: !(node.enabled ?? true) }
                        : node
                )
            );
        }
        handleCloseContextMenu();
    }, [contextMenu, setNodes, handleCloseContextMenu]);

    const handleContextMenuToggleBreakpoint = useCallback(() => {
        if (contextMenu?.nodeId) {
            setNodes(prevNodes =>
                prevNodes.map(node =>
                    node.id === contextMenu.nodeId
                        ? { ...node, breakpoint: !node.breakpoint }
                        : node
                )
            );
        }
        handleCloseContextMenu();
    }, [contextMenu, setNodes, handleCloseContextMenu]);

    const handleContextMenuTogglePinData = useCallback(() => {
        if (contextMenu?.nodeId) {
            setNodes(prevNodes =>
                prevNodes.map(node => {
                    if (node.id === contextMenu.nodeId) {
                        if (node.pinnedData !== undefined) {
                            const { pinnedData, ...rest } = node;
                            return rest;
                        } else {
                            return { ...node, pinnedData: { message: 'Pinned output - replace with actual data' } };
                        }
                    }
                    return node;
                })
            );
        }
        handleCloseContextMenu();
    }, [contextMenu, setNodes, handleCloseContextMenu]);

    const handleContextMenuDuplicate = useCallback(() => {
        if (contextMenu?.nodeId) {
            handleDuplicateNode(contextMenu.nodeId);
        }
    }, [contextMenu, handleDuplicateNode]);

    const handleNodeClick = useCallback((nodeId: string) => {
        handleNodeSelect(nodeId, false);
    }, [handleNodeSelect]);

    // Memoized analysis results
    const complexityResult = useMemo(() => 
        calculateComplexityScore(nodes, connections), 
        [nodes, connections]
    );

    const securityResult = useMemo(() => 
        scanWorkflowSecurity(nodes), 
        [nodes]
    );

    const lintResult = useMemo(() => 
        lintWorkflow(nodes, connections), 
        [nodes, connections]
    );

    // Auto-layout handler
    const handleAutoLayout = useCallback(() => {
        const result = getAutoLayout(nodes, connections);
        setNodes(result.nodes);
    }, [nodes, connections, setNodes]);

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
        forceSave,
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
        handleContextMenuToggleEnable,
        handleContextMenuToggleBreakpoint,
        handleContextMenuTogglePinData,
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
        handleDeleteNodeById,
        isRunDialogOpen,
        handleOpenRunDialog,
        handleCloseRunDialog,

        // Blast Radius (Impact Analysis)
        blastRadiusMode,
        blastRadiusFocusedNode,
        blastRadius,
        blastRadiusConnections,
        setBlastRadiusMode,
        setBlastRadiusFocusedNode,
        toggleBlastRadiusMode,
        isNodeInBlastRadius,
        isNodeDimmed,
        isConnectionInBlastRadius,
        getNodeBlastRadiusStyle,

        // Execution Heatmap
        heatmapEnabled,
        toggleHeatmap,
        getNodeHeatColor,
        getNodeBorderColor,
        getNodeStats,
        clearStats,

        // Collaboration
        remoteUsers,
        broadcastCursor,

        // Analysis Results
        complexityResult,
        securityResult,
        lintResult,
        handleAutoLayout,
    };
}
