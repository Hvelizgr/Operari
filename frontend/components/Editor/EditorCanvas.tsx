'use client';

import { useEditorCanvas } from '../../hooks/useEditorCanvas';
import { getAutoLayout } from '../../utils/layoutUtils';
import { calculateComplexityScore } from '../../utils/complexityScore';
import { scanWorkflowSecurity } from '../../utils/securityScanner';
import { lintWorkflow } from '../../utils/architectureLinter';
import { ConnectionsLayer, ConnectionBubblesLayer, NodesLayer, GridLayer, EditorOverlays } from './';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { useExecutionSocket } from '../../hooks/useExecutionSocket';
import dynamic from 'next/dynamic';
const LogTerminal = dynamic(() => import('./terminal/LogTerminal'), { ssr: false });
import { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, X, Zap, Download, Upload, FileText, Bug, Globe, Sparkles } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import PublishTemplateDialog from '../Workflow/PublishTemplateDialog';
import AIAssistant from './AIAssistant';
// ... existing imports
import SnapshotDialog from '../Workflow/SnapshotDialog';
import { useSnapshots } from '../../hooks/useSnapshots';
import { useEditorTools } from '../../hooks/useEditorTools';
import { useEditorSoldering } from '../../hooks/useEditorSoldering';
import SolderingOverlay from './SolderingOverlay';
import RunDialog from '../Workflow/RunDialog';
import CommandPalette, { CommandAction } from './CommandPalette';
import TopBar from './TopBar';
import { createNewNode } from './EditorCanvas.utils';
import WorkflowPropertiesPanel, { WorkflowProperties } from './WorkflowPropertiesPanel';
import './WorkflowNode.css';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
    // Confetti canvas ref for advanced confetti (xyOps addSolderSparks)
    const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [searchTrigger, setSearchTrigger] = useState<number>(0);

    const {
        // Refs
        canvasRef,
        windowSize,

        // State
        nodes,
        setNodes, // Destructure setNodes
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
        handleNodeDragStart,
        handleNodeDrag,
        handleNodeDragEnd,
        handlePortDragStart,
        handlePortDragEnd,
        handleCloseContextMenu,

        handleContextMenuDuplicate,
        handleDeleteFromContextMenu,
        handleContextMenuToggleEnable,
        handleContextMenuToggleBreakpoint,
        handleNodeClick,
        handleNodeMove,
        handleNodeUpdate,
        handleCloseConfigPanel,
        setConfigNodeId,
        handleHighlightNodes,
        handleConnectionSelect,
        handleConfirmDelete,
        handleCancelDelete,
        handleConfirmDeleteConnection,
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
        handleDeleteNodeById,
        forceSave,

        isRunDialogOpen,
        handleOpenRunDialog,
        handleCloseRunDialog,

        // Blast Radius (Impact Analysis)
        blastRadiusMode,
        setBlastRadiusFocusedNode,
        toggleBlastRadiusMode,
        getNodeBlastRadiusStyle,
    } = useEditorCanvas({ lang, confettiCanvasRef });

    // Auto Layout Handler
    const handleAutoLayout = () => {
        const { nodes: layoutedNodes } = getAutoLayout(nodes, connections);
        setNodes(layoutedNodes);
    };

    // Complexity Score - calculated on every node/connection change
    const complexityResult = useMemo(() => {
        return calculateComplexityScore(nodes, connections);
    }, [nodes, connections]);

    // Security Scanner - scan nodes for hardcoded credentials
    const securityResult = useMemo(() => {
        return scanWorkflowSecurity(nodes);
    }, [nodes]);

    // Architecture Linter - validate best practices
    const lintResult = useMemo(() => {
        return lintWorkflow(nodes, connections);
    }, [nodes, connections]);

    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [terminalTab, setTerminalTab] = useState<'logs' | 'history' | 'trace'>('logs');
    const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
    const [isWorkflowPropsOpen, setIsWorkflowPropsOpen] = useState(false);
    const [isMetricsDashboardOpen, setIsMetricsDashboardOpen] = useState(false);
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [runMode, setRunMode] = useState<'run' | 'debug'>('run');
    const [solderDropPos, setSolderDropPos] = useState<{ x: number; y: number } | null>(null);
    const [workflowProperties, setWorkflowProperties] = useState<WorkflowProperties>({
        name: 'Untitled Workflow',
        description: '',
        isActive: false,
        schedule: null,
        tags: [],
        errorHandling: 'stop',
        timeout: 30000,
    });
    const { executeWorkflow, executeFromNode, executing, currentExecutionId, setCurrentExecutionId } = useWorkflowExecution('current-workflow');
    const { logs, nodeStatuses, nodeOutputs } = useExecutionSocket(currentExecutionId);

    // --- SNAPSHOT SYSTEM ---
    const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
    const {
        snapshots,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot
    } = useSnapshots('current-workflow');

    const handleCreateSnapshot = () => {
        createSnapshot(nodes, connections);
    };

    const handleRestoreSnapshot = (id: string) => {
        const data = restoreSnapshot(id);
        if (data) {
            handleLoadWorkflow(data.nodes, data.connections);
            setIsSnapshotDialogOpen(false);
        }
    };
    // -----------------------

    // xyOps Tool System
    const { tool, selectTool, isDrawMode, isMoveMode } = useEditorTools();

    // xyOps Soldering System
    const {
        soldering,
        startSolder,
        updateSolderPosition,
        completeSolder,
        cancelSolder,
        isSoldering,
        pauseSolder,
        resumeSolder,
        pausedSolder
    } = useEditorSoldering({
        canvasRef,
        viewport,
        nodes,
        onConnectionComplete: (sourceId, targetId, sourcePort, targetPort) => {
            // Create connection using the real system (xyOps integration complete!)
            createConnection(sourceId, targetId, sourcePort, targetPort);
        },
        isDrawMode
    });

    const handleExecuteWithInput = async (input: object) => {
        setIsTerminalOpen(true);
        // Ensure latest changes are saved before execution
        await forceSave();
        await executeWorkflow(input, runMode);
    };

    // Direct execution (no modal)
    const handleDirectRun = async () => {
        setIsTerminalOpen(true);
        // Ensure latest changes are saved before execution
        await forceSave();
        await executeWorkflow({}, 'run');
    };

    // Open modal for run with custom input
    const handleOpenRunWithInput = () => {
        setRunMode('run');
        handleOpenRunDialog();
    };

    // Open modal for debug
    const handleOpenDebug = () => {
        setRunMode('debug');
        handleOpenRunDialog();
    };

    // Stop execution (placeholder - needs backend support)
    const handleStopExecution = () => {
        // TODO: Implement stop execution via API
        console.log('Stop execution requested');
    };

    // Test From Node handler - executes workflow starting from a specific node
    const handleTestFromNode = async () => {
        if (contextMenu?.nodeId) {
            setIsTerminalOpen(true);
            await executeFromNode(contextMenu.nodeId, {});
        }
        handleCloseContextMenu();
    };

    // --- Hover Toolbar Handlers (n8n-style) ---
    const handleNodeRunFromToolbar = async (nodeId: string) => {
        setIsTerminalOpen(true);
        await executeFromNode(nodeId, {});
    };

    const handleNodeToggleDisableFromToolbar = (nodeId: string) => {
        setNodes((prevNodes: any[]) =>
            prevNodes.map((node: any) =>
                node.id === nodeId
                    ? { ...node, enabled: !(node.enabled ?? true) }
                    : node
            )
        );
    };

    // Note: handleNodeDeleteFromToolbar is now handled by handleDeleteNodeById from useEditorCanvas

    const handleNodeDuplicateFromToolbar = (nodeId: string) => {
        const node = nodes.find((n: any) => n.id === nodeId);
        if (node) {
            const newNode = {
                ...node,
                id: `${node.type}-${Date.now()}`,
                position: {
                    x: node.position.x + 50,
                    y: node.position.y + 50,
                },
                title: `${node.title} (copy)`,
            };
            setNodes((prev: any[]) => [...prev, newNode]);
        }
    };

    const handleNodeFocusFromToolbar = (nodeId: string) => {
        setConfigNodeId(nodeId);
    };

    // Blast Radius: When a node is clicked, update the focused node for blast radius
    const handleNodeClickWithBlastRadius = (nodeId: string) => {
        handleNodeClick(nodeId);
        // Update blast radius focused node when in blast radius mode
        if (blastRadiusMode !== 'off') {
            setBlastRadiusFocusedNode(nodeId);
        }
    };

    // Watch for successful execution to fire confetti
    useEffect(() => {
        if (logs.length > 0) {
            const lastLog = logs[logs.length - 1];
            if (lastLog.message.includes('Workflow execution completed successfully')) {
                import('canvas-confetti').then((module) => {
                    const confetti = module.default;
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#3b82f6', '#10b981', '#f59e0b']
                    });
                });
            }
        }
    }, [logs]);

    const handleSolderDropSelect = (nodeId: string) => {
        // NOTE: The SearchBar returns the ID if the node exists, OR it forces an 'add' if we clicked an item from the menu?
        // Wait, current SearchBar implementation calls onNodeSelect(id) for existing nodes and onNodeAdd(type) for new nodes.
        // We only care about onNodeAdd here usually, but if user selects existing node... maybe we connect to it?
        // For now let's focus on CREATING new node.

        // Actually SearchBar calls onSearchNodeSelect which centers viewport.
        // We want to intercept onNodeAdd.
    };

    // We will pass an inline function to EditorOverlays instead to close over the state variables

    const handleSolderDropCancel = () => {
        setSolderDropPos(null);
        cancelSolder();
    };

    // --- Command Palette Logic ---
    const commandActions: CommandAction[] = useMemo(() => [
        // General
        { id: 'undo', label: lang === 'en' ? 'Undo' : 'Deshacer', shortcut: ['Ctrl', 'Z'], action: undo },
        { id: 'redo', label: lang === 'en' ? 'Redo' : 'Rehacer', shortcut: ['Ctrl', 'Y'], action: redo },
        { id: 'save', label: lang === 'en' ? 'Save Workflow' : 'Guardar Flujo', shortcut: ['Ctrl', 'S'], action: () => {/* Managed by autosave but force? */ } }, // Optional

        // Navigation
        { id: 'zoom_in', label: lang === 'en' ? 'Zoom In' : 'Acercar', shortcut: ['Ctrl', '+'], action: handleZoomIn },
        { id: 'zoom_out', label: lang === 'en' ? 'Zoom Out' : 'Alejar', shortcut: ['Ctrl', '-'], action: handleZoomOut },
        { id: 'fit_view', label: lang === 'en' ? 'Fit View' : 'Ajustar Vista', shortcut: ['Shift', '1'], action: handleFitView },
        { id: 'reset_zoom', label: lang === 'en' ? 'Reset Zoom' : 'Resetear Zoom', action: handleResetZoom },

        // Nodes
        { id: 'delete', label: lang === 'en' ? 'Delete Selected' : 'Eliminar Selección', shortcut: ['Del'], action: handleConfirmDelete },
        { id: 'duplicate', label: lang === 'en' ? 'Duplicate Selected' : 'Duplicar Selección', shortcut: ['Ctrl', 'D'], action: handleContextMenuDuplicate },
        { id: 'select_all', label: lang === 'en' ? 'Select All' : 'Seleccionar Todo', shortcut: ['Ctrl', 'A'], action: () => {/* TODO */ } },
        { id: 'add_node', label: lang === 'en' ? 'Add Node' : 'Aspirar Nuevo Nodo', shortcut: ['Space'], action: () => setSearchTrigger(Date.now()) },
        { id: 'auto_layout', label: lang === 'en' ? 'Auto Layout' : 'Organizar Flujo', action: handleAutoLayout },

        // Execution
        { id: 'run', label: lang === 'en' ? 'Run Workflow' : 'Ejecutar', shortcut: ['Ctrl', 'Enter'], action: () => handleExecuteWithInput({}) },
        { id: 'terminal', label: lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal', action: () => setIsTerminalOpen(p => !p) },

        // Tools
        { id: 'history', label: lang === 'en' ? 'Version History' : 'Historial de Versiones', action: () => setIsSnapshotDialogOpen(true) },

    ], [lang, undo, redo, handleZoomIn, handleZoomOut, handleFitView, handleResetZoom, handleConfirmDelete, handleContextMenuDuplicate, handleAutoLayout, handleExecuteWithInput]);

    const handleLoadWorkflowWrapped = (nodes: any[], connections: any[]) => {
        setCurrentExecutionId(null);
        handleLoadWorkflow(nodes, connections);
    };

    const handleSelectTemplateWrapped = async (templateNodes: any[], templateConnections: any[]) => {
        setCurrentExecutionId(null);
        // handleSelectTemplate returns the transformed nodes/connections with unique IDs
        const { nodes: transformedNodes, connections: transformedConnections } = handleSelectTemplate(templateNodes, templateConnections);
        // Persist the TRANSFORMED nodes (with new IDs) so backend matches frontend
        await forceSave(transformedNodes, transformedConnections);
    };

    const handlePublishToMarketplace = async (data: any) => {
        try {
            await apiFetch('/api/templates/publish', {
                method: 'POST',
                body: JSON.stringify({
                    ...data,
                    nodes,
                    connections
                })
            });
        } catch (error) {
            console.error('Failed to publish template', error);
            throw error;
        }
    };

    const handleApplyAIWorkflow = async (aiNodes: any[], aiConnections: any[]) => {
        setCurrentExecutionId(null);
        // handleSelectTemplate returns the transformed nodes/connections with unique IDs
        const { nodes: transformedNodes, connections: transformedConnections } = handleSelectTemplate(aiNodes, aiConnections);
        await forceSave(transformedNodes, transformedConnections);
        
        // Show success effect
        const canvas = confettiCanvasRef.current;
        if (canvas) {
            import('canvas-confetti').then((confetti) => {
                const myConfetti = (confetti as any).create(canvas as any, { resize: true });
                myConfetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#3b82f6', '#8b5cf6', '#ec4899']
                });
            });
        }
    };

    // Ctrl+K Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>

            {/* 2. Main Content Area */}
            <div className="flex-1 flex flex-col relative h-full overflow-hidden">

                {/* 2.1 TopBar */}
                <div className="z-40">
                    <TopBar
                        lang={lang}
                        workflowName={workflowProperties.name}
                        onRun={handleDirectRun}
                        onRunWithInput={handleOpenRunWithInput}
                        onDebug={handleOpenDebug}
                        isExecuting={executing}
                        onStop={handleStopExecution}
                        onProperties={() => setIsWorkflowPropsOpen(true)}
                        onAddNode={() => setSearchTrigger(Date.now())}
                        onAutoLayout={handleAutoLayout}
                        saveStatus={saveStatus}
                        onTemplates={() => setIsTemplateGalleryOpen(true)}
                        onMetrics={() => setIsMetricsDashboardOpen(true)}
                        onPublish={() => setIsPublishDialogOpen(true)}
                        blastRadiusMode={blastRadiusMode}
                        onToggleBlastRadius={toggleBlastRadiusMode}
                        complexityScore={complexityResult.score}
                        complexityLevel={complexityResult.level}
                        securityIssueCount={securityResult.issues.length}
                        securitySeverity={securityResult.highestSeverity}
                        lintErrorCount={lintResult.errorCount}
                        lintWarningCount={lintResult.warningCount}
                        lintPassed={lintResult.passed}
                        onExport={() => {
                            const data = JSON.stringify({ nodes, connections }, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `workflow-${new Date().toISOString().slice(0, 10)}.json`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        onImport={(file) => {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                try {
                                    const json = JSON.parse(event.target?.result as string);
                                    if (json.nodes && json.connections) {
                                        handleLoadWorkflowWrapped(json.nodes, json.connections);
                                    } else {
                                        alert(lang === 'en' ? 'Invalid workflow file' : 'Archivo inválido');
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('Error parsing JSON');
                                }
                            };
                            reader.readAsText(file);
                        }}
                    />
                </div>

                {/* 2.2 Canvas & Overlays */}
                <div
                    id="workflow-canvas"
                    ref={canvasRef}
                    className={`
                            wf_container wf_root relative w-full flex-1 overflow-hidden select-none
                            editor-mode-${tool}
                        `}
                    style={{
                        backgroundColor: 'var(--box-background-color)',
                        backgroundImage: 'none'
                    }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={(e) => {
                        handleCanvasMouseMove(e);
                        if (isSoldering) {
                            updateSolderPosition(e.clientX, e.clientY);
                        }
                    }}
                    onMouseUp={(e) => {
                        if (isSoldering) {
                            e.stopPropagation();
                            pauseSolder();
                            setSolderDropPos({ x: e.clientX, y: e.clientY });
                        } else {
                            handleCanvasMouseUp();
                        }
                    }}
                    onMouseLeave={handleCanvasMouseUp}
                    onDrop={handleCanvasDrop}
                    onDragOver={handleCanvasDragOver}
                    onClick={handleCanvasClick}
                    onContextMenu={(e) => handleContextMenu(e, 'canvas')}
                    role="application"
                    aria-label={lang === 'en' ? 'Workflow editor canvas' : 'Lienzo del editor de flujo de trabajo'}
                >
                    <a
                        href="#workflow-canvas"
                        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        {lang === 'en' ? 'Skip to workflow canvas' : 'Saltar al lienzo de flujo de trabajo'}
                    </a>

                    <div id="canvas-instructions" className="sr-only">
                        {lang === 'en'
                            ? 'Use Tab to navigate between nodes, Arrow keys to move focus, Enter to select, Escape to deselect, Delete to remove selected nodes'
                            : 'Use Tab para navegar entre nodos, teclas de flecha para mover el foco, Enter para seleccionar, Escape para deseleccionar, Delete para eliminar nodos seleccionados'}
                    </div>


                    <GridLayer
                        viewport={viewport}
                        highContrast={highContrast}
                    />

                    <ConnectionsLayer
                        connections={connections}
                        nodes={nodes}
                        nodeTypes={dbNodeTypes}
                        viewport={viewport}
                        soldering={soldering}
                        selectedConnection={selectedConnection}
                        creatingConnection={creatingConnection}
                        cyclicConnections={cyclicConnections}
                        onConnectionClick={handleConnectionSelect}
                        nodeStatuses={nodeStatuses}
                    />

                    <ConnectionBubblesLayer
                        connections={connections}
                        nodes={nodes}
                        viewport={viewport}
                        selectedConnection={selectedConnection}
                        onConnectionClick={handleConnectionSelect}
                    />

                    <NodesLayer
                        nodes={nodes}
                        connections={connections}
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
                        onNodeClick={handleNodeClickWithBlastRadius}
                        onNodeMove={handleNodeMove}
                        onNodeUpdate={handleNodeUpdate}
                        onSolderStart={startSolder}
                        onNodeDoubleClick={setConfigNodeId}
                        editorMode={tool === 'draw' ? 'connect' : 'move'}
                        nodeStatuses={nodeStatuses}
                        // Hover toolbar handlers (n8n-style)
                        onNodeRun={handleNodeRunFromToolbar}
                        onNodeToggleDisable={handleNodeToggleDisableFromToolbar}
                        onNodeDelete={handleDeleteNodeById}
                        onNodeDuplicate={handleNodeDuplicateFromToolbar}
                        onNodeFocus={handleNodeFocusFromToolbar}
                        lang={lang}
                        getNodeBlastRadiusStyle={getNodeBlastRadiusStyle}
                    />

                    {/* Selection Box */}
                    {selectionBox && getSelectionBoxStyle() && (
                        <div
                            id="d_wf_selection_draw"
                            style={getSelectionBoxStyle()!}
                        />
                    )}

                    {/* Soldering Overlay */}
                    {isSoldering && soldering && (
                        <SolderingOverlay
                            nodes={nodes}
                            solderingNodeId={soldering.startNodeId}
                            solderingEndPort={soldering.endPort}
                            viewport={viewport}
                            onPortClick={completeSolder}
                        />
                    )}

                    {/* AI Assistant */}
                    <AIAssistant onApplyWorkflow={handleApplyAIWorkflow} lang={lang} />

                    {/* Confetti Canvas */}
                    <canvas
                        ref={confettiCanvasRef}
                        className="effects-canvas"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 200
                        }}
                    />

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
                        nodeOutputs={nodeOutputs}

                        onLoadWorkflow={handleLoadWorkflowWrapped}
                        onSelectTemplate={handleSelectTemplateWrapped}
                        onViewportChange={handleViewportChangeAdapter}
                        onNodeAdd={handleNodeAddFromSearch}
                        onHighlightNodes={handleHighlightNodes}
                        onSearchNodeSelect={handleSearchNodeSelect}

                        onOnboardingNext={handleOnboardingNext}
                        onOnboardingSkip={handleOnboardingSkip}
                        onOnboardingClose={handleOnboardingClose}

                        onDeleteConfirm={handleConfirmDelete}
                        onDeleteCancel={handleCancelDelete}
                        onDeleteConnectionConfirm={handleConfirmDeleteConnection}
                        onDeleteConnectionCancel={handleCancelDeleteConnection}

                        onConfigUpdate={handleNodeUpdate}
                        onConfigClose={handleCloseConfigPanel}

                        onContextMenuClose={handleCloseContextMenu}
                        onContextMenuDuplicate={handleContextMenuDuplicate}
                        onContextMenuDelete={handleDeleteFromContextMenu}
                        onContextMenuToggleEnable={handleContextMenuToggleEnable}
                        onContextMenuToggleBreakpoint={handleContextMenuToggleBreakpoint}
                        onContextMenuTestFromNode={handleTestFromNode}
                        onContextMenuDetachConnections={handleDetachConnections}

                        onUndo={undo}
                        onRedo={redo}
                        onHistory={() => setIsSnapshotDialogOpen(true)}
                        onShortcuts={() => setIsCommandPaletteOpen(true)}
                        onSetModeMove={() => selectTool('move')}
                        onSetModeDraw={() => selectTool('draw')}
                        onClearAll={handleClearAll}
                        canUndo={canUndo}
                        canRedo={canRedo}

                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onFitView={handleFitView}
                        onResetZoom={handleResetZoom}

                        solderDropPos={solderDropPos}
                        onSolderDropCancel={handleSolderDropCancel}
                        searchTrigger={searchTrigger}
                        isTemplateGalleryOpen={isTemplateGalleryOpen}
                        onTemplateGalleryOpenChange={setIsTemplateGalleryOpen}
                        isMetricsDashboardOpen={isMetricsDashboardOpen}
                        onMetricsDashboardOpenChange={setIsMetricsDashboardOpen}
                    />

                    <PublishTemplateDialog
                        isOpen={isPublishDialogOpen}
                        onClose={() => setIsPublishDialogOpen(false)}
                        onPublish={handlePublishToMarketplace}
                        lang={lang}
                        workflowName={workflowProperties.name}
                    />

                    <RunDialog
                        isOpen={isRunDialogOpen}
                        onClose={handleCloseRunDialog}
                        onRun={handleExecuteWithInput}
                        lang={lang}
                        isExecuting={executing}
                        logs={logs}
                        executionId={currentExecutionId}
                    />

                    <SnapshotDialog
                        isOpen={isSnapshotDialogOpen}
                        onClose={() => setIsSnapshotDialogOpen(false)}
                        snapshots={snapshots}
                        onCreate={handleCreateSnapshot}
                        onRestore={handleRestoreSnapshot}
                        onDelete={deleteSnapshot}
                        lang={lang}
                    />

                    <WorkflowPropertiesPanel
                        isOpen={isWorkflowPropsOpen}
                        properties={workflowProperties}
                        onUpdate={(updates) => setWorkflowProperties(prev => ({ ...prev, ...updates }))}
                        onClose={() => setIsWorkflowPropsOpen(false)}
                        lang={lang}
                    />

                    {/* Floating Terminal Toggle */}
                    <button
                        id="terminal-toggle"
                        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                        className={`absolute bottom-6 right-6 p-3 rounded-full shadow-2xl transition-all duration-300 z-50 group ${isTerminalOpen ? 'bg-slate-800 text-slate-400 rotate-90' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-110'
                            }`}
                        title={lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal'}
                    >
                        {isTerminalOpen ? <X size={20} /> : <TerminalIcon size={20} />}
                        <span className="absolute right-full mr-3 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest font-bold border border-slate-700">
                            {lang === 'en' ? 'Terminal' : 'Terminal'}
                        </span>
                    </button>

                    {/* Bottom Terminal Panel */}
                    <div 
                        id="execution-terminal"
                        className={`
                            absolute bottom-0 left-0 right-0 h-64 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out z-40
                            ${isTerminalOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
                        `}>
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${executing ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    {lang === 'en' ? 'Live Execution Log' : 'Registro de Ejecución en Vivo'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsTerminalOpen(false)}
                                    className="p-1 text-slate-500 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="w-full h-[calc(100%-40px)] p-1">
                            <LogTerminal logs={logs} />
                        </div>
                    </div>
                    <CommandPalette
                        isOpen={isCommandPaletteOpen}
                        onClose={() => setIsCommandPaletteOpen(false)}
                        actions={commandActions}
                        lang={lang}
                    />
                </div>
            </div>
        </>
    );
}
