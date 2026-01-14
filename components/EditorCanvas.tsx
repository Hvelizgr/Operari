'use client';

import { useRef, useState, useCallback, MouseEvent, useEffect, DragEvent } from 'react';
import { motion } from 'framer-motion';
import EditorNode, { WorkflowNode, getNodeInputPort, getNodeOutputPort } from './EditorNode';
import EditorConnection, { Connection } from './EditorConnection';
import Onboarding, { EmptyStateMessage, ONBOARDING_STEPS_EN, ONBOARDING_STEPS_ES } from './Onboarding';
import WorkflowRunner from './WorkflowRunner';
import { useAdvancedUndoRedo } from '../hooks/useAdvancedUndoRedo';
import { Undo2, Redo2, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { NodeType } from './NodePalette';
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
import { useEditorConnections } from '../hooks/useEditorConnections';
import { EDITOR_CONFIG } from '../config/editor.config';
import { INITIAL_NODES } from '../constants/editor.constants';
import { useEditorViewport } from '../hooks/useEditorViewport';
import { useEditorNodes } from '../hooks/useEditorNodes';
import { useEditorSelection } from '../hooks/useEditorSelection';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';

// Editor-specific types
import type {
    CreatingConnectionState,
    SelectionBoxState,
    DeleteConfirmState,
    DeleteConnectionConfirmState,
    ContextMenuState,
    ExecutionMetric,
} from '../types/editor.types';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
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

    // Viewport management (zoom, pan, fit view)
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

    // Connection management hook
    const {
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
        handlePortDragStart,
        handlePortDragEnd,
        handleConnectionSelect,
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

    // Selection box management hook
    const {
        selectionBox,
        setSelectionBox,
        isSelecting,
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

    const { saveStatus, enableAutosave, setEnableAutosave } = useAutosave({
        nodes,
        connections,
        workflowId: 'current-workflow',
        debounceMs: EDITOR_CONFIG.CANVAS.DEBOUNCE_MS,
    });

    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ open: false, nodeIds: [] });
    const [deleteConnectionConfirm, setDeleteConnectionConfirm] = useState<DeleteConnectionConfirmState>({ open: false, connectionId: null });
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetric[]>([]);

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('nanoflow-onboarding-seen');
        if (!hasSeenOnboarding && nodes.length > 0) {
            setShowOnboarding(true);
        }
    }, [nodes.length]);

    // Keyboard shortcuts and navigation
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
    }, [viewport, lang, windowSize.width, windowSize.height, setNodes]);

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
    }, [draggingNodeType, viewport, lang, setNodes, setDraggingNodeType]);

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
            if (selectionBoxRef.current) clearSelectionBox();
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
    }, [draggingNode, isPanning, creatingConnection, draggingNodeType, selectionBox]); // Using refs for stable callbacks

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
            clearConnectionSelection();
        }
    }, [clearConnectionSelection]);

    const handleConnectionSelectLocal = useCallback((connectionId: string) => {
        setSelectedConnection(connectionId);
        setSelectedNodes(new Set());
    }, []);

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
    }, []);

    const handleSelectTemplate = useCallback((templateNodes: WorkflowNode[], templateConnections: Connection[]) => {
        setNodes(templateNodes);
        setConnections(templateConnections);
        setSelectedNodes(new Set());
        setSelectedConnection(null);
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
                                onClick={handleConnectionSelectLocal}
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

                {selectionBox && getSelectionBoxStyle() && (
                    <div
                        className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                        style={getSelectionBoxStyle()!}
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
                    onConfirm={onConfirmDeleteConnection}
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
