'use client';

import { useRef, useState, useCallback, WheelEvent, MouseEvent, useEffect, DragEvent } from 'react';
import { motion } from 'framer-motion';
import EditorNode, { WorkflowNode, getNodeInputPort, getNodeOutputPort } from './EditorNode';
import EditorConnection, { Connection } from './EditorConnection';
import Onboarding, { EmptyStateMessage, ONBOARDING_STEPS_EN, ONBOARDING_STEPS_ES } from './Onboarding';
import WorkflowRunner from './WorkflowRunner';
import { useAdvancedUndoRedo } from '../hooks/useAdvancedUndoRedo';
import { Undo2, Redo2, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import NodePalette, { NodeType } from './NodePalette';
import ConfirmDialog from './ConfirmDialog';
import SaveLoadMenu from './SaveLoadMenu';
import NodeConfigPanel from './NodeConfigPanel';
import TemplateGallery from './TemplateGallery';
import MiniMap from './MiniMap';
import SearchBar from './SearchBar';
import ZoomControls from './ZoomControls';
import ContextMenu from './ContextMenu';
import MetricsDashboard from './MetricsDashboard';
import ThemeToggle from './ThemeToggle';
import { useAccessibility } from '../context/AccessibilityContext';
import useWindowSize from '../hooks/useWindowSize';
import { useNodeTypes } from '../hooks/useNodeTypes';
import { useAutosave, SaveStatus } from '../hooks/useAutosave';
import { hasCycle, getCyclicConnections } from '../utils/cycleDetection';
import { EDITOR_CONFIG } from '../config/editor.config';
import { INITIAL_NODES, INITIAL_CONNECTIONS } from '../constants/editor.constants';

// Editor-specific types
import type {
    ViewportState,
    CreatingConnectionState,
    SelectionBoxState,
    DeleteConfirmState,
    DeleteConnectionConfirmState,
    ContextMenuState,
    ExecutionMetric,
} from '../types/editor.types';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
    const windowSize = useWindowSize();
    const { nodeTypes: dbNodeTypes, loading: loadingNodeTypes } = useNodeTypes(); // Fetch DB nodes
    const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
    const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
    const { executeCommand, undo, redo, canUndo, canRedo } = useAdvancedUndoRedo(50);
    const { highContrast, announceMessage } = useAccessibility();
    const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1);

    const { saveStatus, enableAutosave, setEnableAutosave } = useAutosave({
        nodes,
        connections,
        workflowId: 'current-workflow',
        debounceMs: EDITOR_CONFIG.CANVAS.DEBOUNCE_MS,
    });

    const [viewport, setViewport] = useState<ViewportState>({
        x: 0,
        y: 0,
        zoom: 1,
    });

    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
    const [creatingConnection, setCreatingConnection] = useState<CreatingConnectionState | null>(null);
    const [hoveredInputNode, setHoveredInputNode] = useState<string | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [draggingNodeType, setDraggingNodeType] = useState<NodeType | null>(null);
    const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
    const [configNodeId, setConfigNodeId] = useState<string | null>(null);
    const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
    const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ open: false, nodeIds: [] });
    const [deleteConnectionConfirm, setDeleteConnectionConfirm] = useState<DeleteConnectionConfirmState>({ open: false, connectionId: null });
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetric[]>([]);
    const [cyclicConnections, setCyclicConnections] = useState<string[]>([]);
    const [cycleError, setCycleError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('nanoflow-onboarding-seen');
        if (!hasSeenOnboarding && nodes.length > 0) {
            setShowOnboarding(true);
        }
    }, [nodes.length]);

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab' && !e.shiftKey && nodes.length > 0) {
                e.preventDefault();
                setFocusedNodeIndex(prev => (prev + 1) % nodes.length);
                announceMessage(`Focused on node ${nodes[(focusedNodeIndex + 1) % nodes.length].title}`);
            } else if (e.key === 'Tab' && e.shiftKey && nodes.length > 0) {
                e.preventDefault();
                setFocusedNodeIndex(prev => (prev - 1 + nodes.length) % nodes.length);
                announceMessage(`Focused on node ${nodes[(focusedNodeIndex - 1 + nodes.length) % nodes.length].title}`);
            } else if (e.key === 'ArrowRight' && focusedNodeIndex >= 0) {
                e.preventDefault();
                setFocusedNodeIndex(prev => Math.min(prev + 1, nodes.length - 1));
                if (focusedNodeIndex < nodes.length - 1) {
                    announceMessage(`Moved to ${nodes[focusedNodeIndex + 1].title}`);
                }
            } else if (e.key === 'ArrowLeft' && focusedNodeIndex >= 0) {
                e.preventDefault();
                setFocusedNodeIndex(prev => Math.max(prev - 1, 0));
                if (focusedNodeIndex > 0) {
                    announceMessage(`Moved to ${nodes[focusedNodeIndex - 1].title}`);
                }
            } else if (e.key === 'Enter' && focusedNodeIndex >= 0) {
                e.preventDefault();
                const nodeId = nodes[focusedNodeIndex].id;
                setSelectedNodes(new Set([nodeId]));
                announceMessage(`Selected ${nodes[focusedNodeIndex].title}`);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedNodes(new Set());
                setFocusedNodeIndex(-1);
                announceMessage('Deselected all nodes');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedNodeIndex, nodes, announceMessage]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isDeleteKey = EDITOR_CONFIG.SHORTCUTS.DELETE.includes(e.key);
            if (isDeleteKey && selectedNodes.size > 0 && !deleteConfirm.open) {
                e.preventDefault();
                setDeleteConfirm({ open: true, nodeIds: Array.from(selectedNodes) });
            }
            if (isDeleteKey && selectedConnection && !deleteConnectionConfirm.open && selectedNodes.size === 0) {
                e.preventDefault();
                setDeleteConnectionConfirm({ open: true, connectionId: selectedConnection });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodes, selectedConnection, deleteConfirm.open, deleteConnectionConfirm.open]);

    const handleWheel = useCallback(
        (e: WheelEvent<HTMLDivElement>) => {
            e.preventDefault();

            const delta = -e.deltaY * EDITOR_CONFIG.ZOOM.SENSITIVITY;
            const newZoom = Math.min(Math.max(viewport.zoom + delta, EDITOR_CONFIG.ZOOM.MIN), EDITOR_CONFIG.ZOOM.MAX);

            if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const zoomPoint = {
                    x: (mouseX - viewport.x) / viewport.zoom,
                    y: (mouseY - viewport.y) / viewport.zoom,
                };

                setViewport({
                    x: mouseX - zoomPoint.x * newZoom,
                    y: mouseY - zoomPoint.y * newZoom,
                    zoom: newZoom,
                });
            }
        },
        [viewport]
    );

    const handleMouseDown = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (e.button === 0 && !draggingNode && !creatingConnection && canvasRef.current) {
                const isShiftClick = e.shiftKey;
                if (!isShiftClick) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    setSelectionBox({
                        start: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                        end: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                    });
                    setConfigNodeId(null);
                }
                setIsPanning(!isShiftClick && !selectionBox);
                setPanStart({
                    x: e.clientX - viewport.x,
                    y: e.clientY - viewport.y,
                });
            }
        },
        [viewport.x, viewport.y, draggingNode, creatingConnection, selectionBox]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (isPanning && !draggingNode) {
                setViewport((prev) => ({
                    ...prev,
                    x: e.clientX - panStart.x,
                    y: e.clientY - panStart.y,
                }));
            }
        },
        [isPanning, panStart, draggingNode]
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const handleNodeDragStart = useCallback(
        (nodeId: string, e: MouseEvent) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return;

            setDraggingNode(nodeId);
            setNodeDragStart({
                x: e.clientX / viewport.zoom - node.position.x,
                y: e.clientY / viewport.zoom - node.position.y,
            });
        },
        [nodes, viewport.zoom]
    );

    const handleNodeDrag = useCallback(
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
        [draggingNode, nodeDragStart, viewport.zoom]
    );

    const handleNodeDragEnd = useCallback(() => {
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
    }, [draggingNode, nodes, nodeDragStart, executeCommand]);

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
        []
    );

    const handlePortDragEnd = useCallback(() => {
        setCreatingConnection(null);
        setHoveredInputNode(null);
    }, []);

    const handleCanvasMouseMove = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            if (isPanning && !draggingNode && !selectionBox) {
                setViewport((prev) => ({
                    ...prev,
                    x: e.clientX - panStart.x,
                    y: e.clientY - panStart.y,
                }));
            }

            if (selectionBox && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setSelectionBox((prev) => prev ? {
                    ...prev,
                    end: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                } : null);

                const box = {
                    x1: Math.min(selectionBox.start.x, e.clientX - rect.left),
                    y1: Math.min(selectionBox.start.y, e.clientY - rect.top),
                    x2: Math.max(selectionBox.start.x, e.clientX - rect.left),
                    y2: Math.max(selectionBox.start.y, e.clientY - rect.top),
                };

                const selected = new Set<string>();
                nodes.forEach((node) => {
                    const nodeScreenX = node.position.x * viewport.zoom + viewport.x;
                    const nodeScreenY = node.position.y * viewport.zoom + viewport.y;
                    const nodeWidth = EDITOR_CONFIG.CANVAS.NODE_WIDTH * viewport.zoom;
                    const nodeHeight = EDITOR_CONFIG.CANVAS.NODE_HEIGHT * viewport.zoom;

                    if (
                        nodeScreenX < box.x2 &&
                        nodeScreenX + nodeWidth > box.x1 &&
                        nodeScreenY < box.y2 &&
                        nodeScreenY + nodeHeight > box.y1
                    ) {
                        selected.add(node.id);
                    }
                });
                setSelectedNodes(selected);
            }

            if (creatingConnection && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setCreatingConnection((prev) =>
                    prev
                        ? {
                            ...prev,
                            currentPos: {
                                x: (e.clientX - rect.left - viewport.x) / viewport.zoom,
                                y: (e.clientY - rect.top - viewport.y) / viewport.zoom,
                            },
                        }
                        : null
                );

                let foundHover = false;
                for (const node of nodes) {
                    if (node.id === creatingConnection.sourceNodeId) continue;
                    const inputPort = getNodeInputPort(node);
                    const dx = inputPort.x - ((e.clientX - rect.left - viewport.x) / viewport.zoom);
                    const dy = inputPort.y - ((e.clientY - rect.top - viewport.y) / viewport.zoom);
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
            }
        },
        [isPanning, panStart, draggingNode, creatingConnection, selectionBox, viewport, nodes]
    );

    const handleCanvasMouseUp = useCallback(() => {
        setIsPanning(false);
        setSelectionBox(null);

        if (creatingConnection && hoveredInputNode) {
            const newConnection: Connection = {
                id: `conn-${Date.now()}`,
                source: creatingConnection.sourceNodeId,
                target: hoveredInputNode,
                sourcePort: 0, // Fallback for now
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
            const newMetrics: typeof executionMetrics = [];

            updatedNodes.forEach((updatedNode) => {
                const prevNode = prevNodes.find(n => n.id === updatedNode.id);

                if (prevNode?.executionState === 'running' &&
                    (updatedNode.executionState === 'success' || updatedNode.executionState === 'error')) {
                    newMetrics.push({
                        nodeId: updatedNode.id,
                        nodeName: updatedNode.title,
                        executionTime: Math.floor(Math.random() * 1000) + 500,
                        status: updatedNode.executionState,
                        timestamp: Date.now(),
                    });
                }
            });

            if (newMetrics.length > 0) {
                setExecutionMetrics(prev => [...prev, ...newMetrics]);
            }

            return updatedNodes;
        });
    }, [executionMetrics]);

    const handleNodeAddFromSearch = useCallback((nodeType: NodeType) => {
        const centerX = (windowSize.width / 2 - viewport.x) / viewport.zoom;
        const centerY = (windowSize.height / 2 - viewport.y) / viewport.zoom;
        const newNode: WorkflowNode = {
            id: `node-${Date.now()}`,
            position: { x: centerX - 128, y: centerY - 32 },
            title: nodeType.label[lang],
            type: nodeType.type,
            inputs: [{ id: 'in', label: 'Input' }],
            outputs: [{ id: 'out', label: 'Output' }],
        };
        setNodes(prev => [...prev, newNode]);
    }, [viewport, lang, windowSize.width, windowSize.height]);

    const handleNodePaletteDragStart = useCallback((nodeType: NodeType) => {
        setDraggingNodeType(nodeType);
    }, []);

    const handleCanvasDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleCanvasDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        if (!draggingNodeType || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
        const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;

        const newNode: WorkflowNode = {
            id: `node-${Date.now()}`,
            position: { x, y },
            title: draggingNodeType.label[lang],
            type: draggingNodeType.type,
        };

        setNodes((prev: WorkflowNode[]) => [...prev, newNode]);
        setDraggingNodeType(null);
    }, [draggingNodeType, viewport, lang]);

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
        setSelectedConnection(null);
    }, []);

    const handleCloseConfigPanel = useCallback(() => {
        setConfigNodeId(null);
    }, []);



    const handleNodeDelete = useCallback((nodeId: string) => {
        setDeleteConfirm({ open: true, nodeIds: [nodeId] });
    }, []);

    // Refs for stable access inside event listeners without re-binding
    const viewportRef = useRef(viewport);
    const nodeDragStartRef = useRef(nodeDragStart);
    const draggingNodeRef = useRef(draggingNode);
    const isPanningRef = useRef(isPanning);
    const panStartRef = useRef(panStart);
    const selectionBoxRef = useRef(selectionBox);

    // Sync refs
    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { nodeDragStartRef.current = nodeDragStart; }, [nodeDragStart]);
    useEffect(() => { draggingNodeRef.current = draggingNode; }, [draggingNode]);
    useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
    useEffect(() => { panStartRef.current = panStart; }, [panStart]);
    useEffect(() => { selectionBoxRef.current = selectionBox; }, [selectionBox]);

    // Global Event Listeners for Dragging/Panning/Selection
    useEffect(() => {
        const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
            const currentZoom = viewportRef.current.zoom;

            if (draggingNodeRef.current) {
                // Inline drag logic to avoid dependencies
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
            } else if (selectionBoxRef.current && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setSelectionBox((prev) => prev ? {
                    ...prev,
                    end: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                } : null);
            }
        };

        const handleWindowMouseUp = () => {
            if (draggingNodeRef.current) handleNodeDragEnd();
            if (isPanningRef.current) setIsPanning(false);
            if (creatingConnection) setCreatingConnection(null);
            if (draggingNodeType) setDraggingNodeType(null);
            if (selectionBoxRef.current) setSelectionBox(null);
        };

        // Only attach if interaction is active
        if (draggingNode || isPanning || creatingConnection || draggingNodeType || selectionBox) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [draggingNode, isPanning, creatingConnection, draggingNodeType, selectionBox, handleNodeDragEnd]); // Reduced dependencies!

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
    }, [deleteConfirm.nodeIds, nodes, connections, executeCommand]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirm({ open: false, nodeIds: [] });
    }, []);

    const handleCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !e.shiftKey) {
            setSelectedNodes(new Set());
            setSelectedConnection(null);
        }
    }, []);

    const handleConnectionSelect = useCallback((connectionId: string) => {
        setSelectedConnection(connectionId);
        setSelectedNodes(new Set());
    }, []);

    const handleConfirmDeleteConnection = useCallback(() => {
        if (deleteConnectionConfirm.connectionId) {
            const deletedConnection = connections.find(c => c.id === deleteConnectionConfirm.connectionId);

            if (deletedConnection) {
                executeCommand({
                    execute: () => {
                        setConnections((prev: Connection[]) =>
                            prev.filter(c => c.id !== deleteConnectionConfirm.connectionId)
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
        }
        setDeleteConnectionConfirm({ open: false, connectionId: null });
    }, [deleteConnectionConfirm.connectionId, connections, executeCommand, announceMessage]);

    const handleCancelDeleteConnection = useCallback(() => {
        setDeleteConnectionConfirm({ open: false, connectionId: null });
    }, []);

    const handleLoadWorkflow = useCallback((loadedNodes: WorkflowNode[], loadedConnections: Connection[]) => {
        setNodes(loadedNodes);
        setConnections(loadedConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
    }, []);

    const handleSelectTemplate = useCallback((templateNodes: WorkflowNode[], templateConnections: Connection[]) => {
        setNodes(templateNodes);
        setConnections(templateConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
    }, []);

    const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
        const oldNode = nodes.find(n => n.id === nodeId);

        if (oldNode) {
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
        }
    }, [nodes, executeCommand]);

    const handleNodeMove = useCallback((nodeId: string, direction: 'up' | 'down' | 'left' | 'right') => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        const moveAmount = EDITOR_CONFIG.CANVAS.MOVE_STEP;
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
    }, [nodes, handleNodeUpdate]);

    const handleNodeOpenSettings = useCallback((nodeId: string) => {
        setSelectedNodes(new Set([nodeId]));
        setConfigNodeId(nodeId);
    }, []);

    const handleViewportChange = useCallback((x: number, y: number) => {
        setViewport(prev => ({ ...prev, x, y }));
    }, []);

    const handleHighlightNodes = useCallback((nodeIds: string[]) => {
        setHighlightedNodes(nodeIds);
    }, []);

    const handleSearchNodeSelect = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const centerX = -(node.position.x - windowSize.width / 2 / viewport.zoom) * viewport.zoom;
            const centerY = -(node.position.y - windowSize.height / 2 / viewport.zoom) * viewport.zoom;
            setViewport(prev => ({ ...prev, x: centerX, y: centerY }));
            setSelectedNodes(new Set([nodeId]));
        }
    }, [nodes, viewport.zoom, windowSize.width, windowSize.height]);

    const handleZoomIn = useCallback(() => {
        setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.1, EDITOR_CONFIG.ZOOM.MAX) }));
    }, []);

    const handleZoomOut = useCallback(() => {
        setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.1, EDITOR_CONFIG.ZOOM.MIN) }));
    }, []);

    const handleFitView = useCallback(() => {
        if (nodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + 260);
            maxY = Math.max(maxY, node.position.y + 120);
        });

        const padding = 100;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const canvasWidth = windowSize.width;
        const canvasHeight = windowSize.height;

        const zoomX = canvasWidth / width;
        const zoomY = canvasHeight / height;
        const newZoom = Math.min(zoomX, zoomY, EDITOR_CONFIG.ZOOM.MAX);

        const centerX = -(minX - padding - (canvasWidth / newZoom - width) / 2) * newZoom;
        const centerY = -(minY - padding - (canvasHeight / newZoom - height) / 2) * newZoom;

        setViewport({ x: centerX, y: centerY, zoom: newZoom });
    }, [nodes, windowSize.width, windowSize.height]);

    const handleResetZoom = useCallback(() => {
        setViewport({ x: 0, y: 0, zoom: 1 });
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, type: 'node' | 'canvas', nodeId?: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type, nodeId });
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleFitView();
        }, 100);
        return () => clearTimeout(timer);
    }, [handleFitView]);

    const gridPattern = `
    <pattern id="grid" width="${EDITOR_CONFIG.GRID.SIZE}" height="${EDITOR_CONFIG.GRID.SIZE}" patternUnits="userSpaceOnUse">
      <path d="M ${EDITOR_CONFIG.GRID.SIZE} 0 L 0 0 0 ${EDITOR_CONFIG.GRID.SIZE}" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>
    </pattern>
  `;

    const SaveStatusIndicator = () => {
        const statusConfig: Record<SaveStatus, {
            icon: typeof Loader2;
            text: string;
            className: string;
            iconClassName: string;
        }> = {
            saving: {
                icon: Loader2,
                text: lang === 'en' ? 'Saving...' : 'Guardando...',
                className: 'text-blue-400',
                iconClassName: 'animate-spin'
            },
            saved: {
                icon: CheckCircle2,
                text: lang === 'en' ? 'Saved' : 'Guardado',
                className: 'text-green-400',
                iconClassName: ''
            },
            error: {
                icon: AlertCircle,
                text: lang === 'en' ? 'Error' : 'Error',
                className: 'text-red-400',
                iconClassName: ''
            },
            conflict: {
                icon: AlertCircle,
                text: lang === 'en' ? 'Conflict' : 'Conflicto',
                className: 'text-yellow-400',
                iconClassName: ''
            }
        };

        const config = statusConfig[saveStatus];
        const Icon = config.icon;

        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 ${config.className}`}>
                <Icon size={14} className={config.iconClassName} />
                <span className="text-xs font-medium">{config.text}</span>
            </div>
        );
    };

    return (
        <>
            <a
                href="#workflow-canvas"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
                {lang === 'en' ? 'Skip to workflow canvas' : 'Saltar al lienzo de flujo de trabajo'}
            </a>
            <div
                id="workflow-canvas"
                ref={canvasRef}
                className={`
                    relative w-full h-screen overflow-hidden cursor-grab active:cursor-grabbing select-none
                    ${highContrast ? 'bg-black' : 'bg-background'}
                `}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                onClick={handleCanvasClick}
                onContextMenu={(e) => handleContextMenu(e, 'canvas')}
                role="application"
                aria-label={lang === 'en' ? 'Workflow editor canvas' : 'Lienzo del editor de flujo de trabajo'}
                aria-describedby="canvas-instructions"
            >
                <div id="canvas-instructions" className="sr-only">
                    {lang === 'en'
                        ? 'Use Tab to navigate between nodes, Arrow keys to move focus, Enter to select, Escape to deselect, Delete to remove selected nodes'
                        : 'Use Tab para navegar entre nodos, teclas de flecha para mover el foco, Enter para seleccionar, Escape para deseleccionar, Delete para eliminar nodos seleccionados'}
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-2 z-40">
                    <SaveStatusIndicator />
                    <button
                        onClick={() => setEnableAutosave(!enableAutosave)}
                        className={`p-2 ${enableAutosave ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-900/50'} text-slate-200 rounded-lg transition-colors shadow-lg border border-slate-700`}
                        title={enableAutosave ? (lang === 'en' ? 'Autosave enabled' : 'Autoguardado activado') : (lang === 'en' ? 'Autosave disabled' : 'Autoguardado desactivado')}
                    >
                        <Save size={18} className={enableAutosave ? '' : 'opacity-40'} />
                    </button>
                    <ThemeToggle lang={lang} />
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg transition-colors shadow-lg border border-slate-700"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={18} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg transition-colors shadow-lg border border-slate-700"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 size={18} />
                    </button>
                </div>

                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-background to-background" />

                <svg className="absolute inset-0 w-full h-full pointer-events-none text-slate-700/50">
                    <defs>
                        <pattern id="grid" width={EDITOR_CONFIG.GRID.SIZE} height={EDITOR_CONFIG.GRID.SIZE} patternUnits="userSpaceOnUse">
                            <circle cx="1" cy="1" r="1" fill="currentColor" fillOpacity="0.3" />
                        </pattern>
                        <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <pattern
                            id="grid"
                            width={EDITOR_CONFIG.GRID.SIZE * viewport.zoom}
                            height={EDITOR_CONFIG.GRID.SIZE * viewport.zoom}
                            patternUnits="userSpaceOnUse"
                        >
                            <circle
                                cx={EDITOR_CONFIG.GRID.SIZE * viewport.zoom / 2}
                                cy={EDITOR_CONFIG.GRID.SIZE * viewport.zoom / 2}
                                r={1}
                                fill={highContrast ? '#444' : '#ffffff20'}
                            />
                        </pattern>
                    </defs>
                    <motion.rect
                        width="100%"
                        height="100%"
                        fill="url(#grid)"
                        animate={{
                            x: viewport.x % (EDITOR_CONFIG.GRID.SIZE * viewport.zoom),
                            y: viewport.y % (EDITOR_CONFIG.GRID.SIZE * viewport.zoom),
                        }}
                        transition={{
                            type: 'tween',
                            duration: 0,
                        }}
                        style={{
                            transformOrigin: '0 0',
                            transform: `scale(${viewport.zoom})`,
                        }}
                    />
                </svg>

                <motion.svg
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{
                        transformOrigin: '0 0',
                    }}
                    animate={{
                        x: viewport.x,
                        y: viewport.y,
                        scale: viewport.zoom,
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                    }}
                >
                    {connections.map((connection) => {
                        const sourceNode = nodes.find((n) => n.id === connection.source);
                        const targetNode = nodes.find((n) => n.id === connection.target);

                        if (!sourceNode || !targetNode) return null;

                        const isExecuting = sourceNode.executionState === 'running' || targetNode.executionState === 'running';
                        const isCyclic = cyclicConnections.includes(connection.id);

                        return (
                            <EditorConnection
                                key={connection.id}
                                connection={connection}
                                sourcePos={getNodeOutputPort(sourceNode, connection.sourcePort || 0)}
                                targetPos={getNodeInputPort(targetNode, connection.targetPort || 0)}
                                isSelected={selectedConnection === connection.id}
                                isExecuting={isExecuting}
                                isCyclic={isCyclic}
                                onClick={handleConnectionSelect}
                            />
                        );
                    })}
                    {creatingConnection && (() => {
                        const sourceNode = nodes.find((n) => n.id === creatingConnection.sourceNodeId);
                        if (!sourceNode) return null;
                        return (
                            <EditorConnection
                                key="temp-connection"
                                connection={{ id: 'temp', source: creatingConnection.sourceNodeId, target: '' }}
                                sourcePos={creatingConnection.startPos}
                                targetPos={creatingConnection.currentPos}
                            />
                        );
                    })()}
                </motion.svg>

                <motion.div
                    className="absolute top-0 left-0 w-full h-full"
                    animate={{
                        x: viewport.x,
                        y: viewport.y,
                        scale: viewport.zoom,
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                    }}
                    style={{
                        transformOrigin: '0 0',
                    }}
                >
                    {nodes.map((node, index) => (
                        <EditorNode
                            key={node.id}
                            node={node}
                            typeDefinition={dbNodeTypes.find(t => t.type === node.type)} // Pass definition
                            onDragStart={handleNodeDragStart}
                            onDrag={handleNodeDrag}
                            onDragEnd={handleNodeDragEnd}
                            isDragging={draggingNode === node.id}
                            onPortDragStart={handlePortDragStart}
                            onPortDragEnd={handlePortDragEnd}
                            isConnectionTarget={hoveredInputNode === node.id}
                            isSelected={selectedNodes.has(node.id)}
                            isHighlighted={highlightedNodes.includes(node.id) || focusedNodeIndex === index}
                            onClick={(id) => handleNodeSelect(id, false)}
                            onMove={handleNodeMove}
                        />
                    ))}
                </motion.div>

                <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-slate-300 font-mono pointer-events-none">
                    Zoom: {Math.round(viewport.zoom * 100)}% | Pan: ({Math.round(viewport.x)}, {Math.round(viewport.y)}) | Nodes: {nodes.length} | Selected: {selectedNodes.size}
                </div>

                {selectionBox && (
                    <div
                        className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                        style={{
                            left: Math.min(selectionBox.start.x, selectionBox.end.x),
                            top: Math.min(selectionBox.start.y, selectionBox.end.y),
                            width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                            height: Math.abs(selectionBox.end.y - selectionBox.start.y),
                        }}
                    />
                )}

                {cycleError && (
                    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                        <AlertCircle size={18} />
                        <span className="text-sm font-medium">{cycleError}</span>
                    </div>
                )}

                {nodes.length === 0 && <EmptyStateMessage lang={lang} />}

                {/* NodePalette removed - functionality moved to SearchBar */}

                <SaveLoadMenu
                    nodes={nodes}
                    connections={connections}
                    onLoad={handleLoadWorkflow}
                    lang={lang}
                />

                <TemplateGallery
                    onSelectTemplate={handleSelectTemplate}
                    lang={lang}
                />

                <MiniMap
                    nodes={nodes}
                    viewport={viewport}
                    canvasSize={windowSize}
                    onViewportChange={handleViewportChange}
                    lang={lang}
                />

                <SearchBar
                    nodes={nodes}
                    onNodeSelect={handleSearchNodeSelect}
                    onNodeAdd={handleNodeAddFromSearch}
                    onHighlightNodes={handleHighlightNodes}
                    lang={lang}
                    availableNodeTypes={dbNodeTypes} // Pass dynamic nodes
                />

                <MetricsDashboard
                    metrics={executionMetrics}
                    lang={lang}
                />

                <WorkflowRunner
                    nodes={nodes}
                    connections={connections}
                    onExecutionStateChange={handleExecutionStateChange}
                    lang={lang}
                />

                {showOnboarding && (
                    <Onboarding
                        currentStep={onboardingStep}
                        steps={lang === 'es' ? ONBOARDING_STEPS_ES : ONBOARDING_STEPS_EN}
                        onNext={handleOnboardingNext}
                        onSkip={handleOnboardingSkip}
                        onClose={handleOnboardingClose}
                    />
                )}

                <ConfirmDialog
                    isOpen={deleteConfirm.open}
                    title={lang === 'en' ? 'Delete Node' + (deleteConfirm.nodeIds.length > 1 ? 's' : '') : 'Eliminar Nodo' + (deleteConfirm.nodeIds.length > 1 ? 's' : '')}
                    message={lang === 'en'
                        ? `Are you sure you want to delete ${deleteConfirm.nodeIds.length} node${deleteConfirm.nodeIds.length > 1 ? 's' : ''}? All connected edges will also be removed.`
                        : `¿Estás seguro de que quieres eliminar ${deleteConfirm.nodeIds.length} nodo${deleteConfirm.nodeIds.length > 1 ? 's' : ''}? Todas las conexiones también se eliminarán.`}
                    confirmLabel={lang === 'en' ? 'Delete' : 'Eliminar'}
                    cancelLabel={lang === 'en' ? 'Cancel' : 'Cancelar'}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />

                <NodeConfigPanel
                    node={configNodeId ? nodes.find(n => n.id === configNodeId) || null : null}
                    nodeTypeDefinition={configNodeId && dbNodeTypes ? dbNodeTypes.find(t => t.type === nodes.find(n => n.id === configNodeId)?.type) : undefined}
                    onUpdate={handleNodeUpdate}
                    onClose={handleCloseConfigPanel}
                    lang={lang}
                />

                <ConfirmDialog
                    isOpen={deleteConnectionConfirm.open}
                    title={lang === 'en' ? 'Delete Connection' : 'Eliminar Conexión'}
                    message={lang === 'en' ? 'Are you sure you want to delete this connection?' : '¿Estás seguro de que quieres eliminar esta conexión?'}
                    confirmLabel={lang === 'en' ? 'Delete' : 'Eliminar'}
                    cancelLabel={lang === 'en' ? 'Cancel' : 'Cancelar'}
                    onConfirm={handleConfirmDeleteConnection}
                    onCancel={handleCancelDeleteConnection}
                />

                <ZoomControls
                    zoom={viewport.zoom}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onFitView={handleFitView}
                    onResetZoom={handleResetZoom}
                    lang={lang}
                />

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        type={contextMenu.type}
                        nodeId={contextMenu.nodeId}
                        onClose={handleCloseContextMenu}
                        onDelete={() => {
                            if (contextMenu.nodeId) {
                                setDeleteConfirm({ open: true, nodeIds: [contextMenu.nodeId] });
                            }
                        }}
                        onDuplicate={() => {
                            if (contextMenu.nodeId) {
                                const node = nodes.find(n => n.id === contextMenu.nodeId);
                                if (node) {
                                    const newNode = {
                                        ...node,
                                        id: `node-${Date.now()}`,
                                        position: { x: node.position.x + 50, y: node.position.y + 50 },
                                    };
                                    setNodes((prev: WorkflowNode[]) => [...prev, newNode]);
                                }
                            }
                        }}
                        lang={lang}
                    />
                )}
            </div>
        </>
    );
}
