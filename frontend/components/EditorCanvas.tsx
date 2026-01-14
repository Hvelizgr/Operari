'use client';

import { useRef, useState, useCallback, MouseEvent, useEffect, DragEvent } from 'react';
import type { WorkflowNode } from './EditorNode';
import type { Connection } from './EditorConnection';
import { ONBOARDING_STEPS_EN, ONBOARDING_STEPS_ES } from './Onboarding';
import ConnectionsLayer from './ConnectionsLayer';
import NodesLayer from './NodesLayer';
import GridLayer from './GridLayer';
import EditorOverlays from './EditorOverlays';
import { useAdvancedUndoRedo } from '../hooks/useAdvancedUndoRedo';
import { NodeType } from './NodePalette';
import EditorToolbar from './EditorToolbar';
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

// Editor-specific types
import type {
    DeleteConfirmState,
    DeleteConnectionConfirmState,
    ContextMenuState,
    ExecutionMetric,
    ViewportState,
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

    // Selection box management hook
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
            } else if (selectionBoxRef.current) {
                updateSelectionBox(e.clientX, e.clientY);
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




    // Handlers for Overlays
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
    }, [contextMenu, setDeleteConfirm, handleCloseContextMenu]);

    const handleViewportChangeAdapter = useCallback((newViewport: ViewportState) => {
        setViewport(newViewport);
    }, [setViewport]);

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

                <EditorToolbar
                    saveStatus={saveStatus}
                    enableAutosave={enableAutosave}
                    setEnableAutosave={setEnableAutosave}
                    undo={undo}
                    redo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    lang={lang}
                />

                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-background to-background" />

                <GridLayer
                    viewport={viewport}
                    highContrast={highContrast}
                />

                <ConnectionsLayer
                    connections={connections}
                    nodes={nodes}
                    selectedConnection={selectedConnection}
                    creatingConnection={creatingConnection}
                    cyclicConnections={cyclicConnections}
                    viewport={viewport}
                    onConnectionClick={handleConnectionSelectLocal}
                />

                <NodesLayer
                    nodes={nodes}
                    nodeTypes={dbNodeTypes}
                    viewport={viewport}
                    draggingNode={draggingNode}
                    hoveredInputNode={hoveredInputNode}
                    selectedNodes={selectedNodes}
                    highlightedNodes={highlightedNodes}
                    focusedNodeIndex={focusedNodeIndex}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDrag={handleNodeDrag}
                    onNodeDragEnd={handleNodeDragEnd}
                    onPortDragStart={handlePortDragStart}
                    onPortDragEnd={handlePortDragEnd}
                    onNodeClick={(id) => handleNodeSelect(id, false)}
                    onNodeMove={handleNodeMove}
                />



                {selectionBox && getSelectionBoxStyle() && (
                    <div
                        className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                        style={getSelectionBoxStyle()!}
                    />
                )}

                <EditorOverlays
                    nodes={nodes}
                    connections={connections}
                    viewport={viewport}
                    windowSize={windowSize}
                    dbNodeTypes={dbNodeTypes}
                    executionMetrics={executionMetrics}
                    cycleError={cycleError}
                    deleteConfirm={deleteConfirm}
                    deleteConnectionConfirm={deleteConnectionConfirm}
                    contextMenu={contextMenu}
                    configNodeId={configNodeId}
                    showOnboarding={showOnboarding}
                    onboardingStep={onboardingStep}
                    lang={lang}
                    selectedNodesCount={selectedNodes.size}
                    onLoadWorkflow={handleLoadWorkflow}
                    onSelectTemplate={handleSelectTemplate}
                    onViewportChange={handleViewportChangeAdapter}
                    onNodeAdd={handleNodeAddFromSearch}
                    onHighlightNodes={handleHighlightNodes}
                    onSearchNodeSelect={handleSearchNodeSelect}
                    onExecutionStateChange={handleExecutionStateChange}
                    onOnboardingNext={handleOnboardingNext}
                    onOnboardingSkip={handleOnboardingSkip}
                    onOnboardingClose={handleOnboardingClose}
                    onDeleteConfirm={handleConfirmDelete}
                    onDeleteCancel={handleCancelDelete}
                    onDeleteConnectionConfirm={onConfirmDeleteConnection}
                    onDeleteConnectionCancel={handleCancelDeleteConnection}
                    onConfigUpdate={handleNodeUpdate}
                    onConfigClose={handleCloseConfigPanel}
                    onContextMenuClose={handleCloseContextMenu}
                    onContextMenuDuplicate={() => {
                        if (contextMenu?.nodeId) {
                            handleDuplicateNode(contextMenu.nodeId);
                        }
                    }}
                    onContextMenuDelete={handleDeleteFromContextMenu}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onFitView={handleFitView}
                    onResetZoom={handleResetZoom}
                />




            </div>
        </>
    );
}
