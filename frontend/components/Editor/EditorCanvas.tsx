'use client';

import { useEditorCanvas } from '../../hooks/useEditorCanvas';
import { getAutoLayout } from '../../utils/layoutUtils';
import { ConnectionsLayer, ConnectionBubblesLayer, NodesLayer, GridLayer, EditorOverlays } from './';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { useExecutionSocket } from '../../hooks/useExecutionSocket';
import dynamic from 'next/dynamic';
const LogTerminal = dynamic(() => import('./terminal/LogTerminal'), { ssr: false });
import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Terminal as TerminalIcon, X, Zap, Download, Upload, FileText } from 'lucide-react';
import { yamlToSpec, specToNodes } from '@/utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
// ... existing imports
import SnapshotDialog from '../Workflow/SnapshotDialog';
import { useSnapshots } from '../../hooks/useSnapshots';
import { useEditorTools } from '../../hooks/useEditorTools';
import RunDialog from '../Workflow/RunDialog';
import CommandPalette, { CommandAction } from './CommandPalette';
import TopBar from './TopBar';
import YamlViewModal from './YamlViewModal';
import RunbookAssistPanel from './RunbookAssistPanel';
import GitHubBranchPanel from './GitHubBranchPanel';
import EditorSidebar from './EditorSidebar';
import { createNewNode } from './EditorCanvas.utils';
import WorkflowPropertiesPanel, { WorkflowProperties } from './WorkflowPropertiesPanel';
import './WorkflowNode.css';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [searchTrigger, setSearchTrigger] = useState<number>(0);
    const searchParams = useSearchParams();
    const urlRunbookId = searchParams?.get('id') ?? null;
    const loadedRunbookIdRef = useRef<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    // Workflow properties live up here (above useEditorCanvas) so the
    // header can be passed straight into the autosave hook for the
    // YAML-native save path.
    const [workflowProperties, setWorkflowProperties] = useState<WorkflowProperties>({
        name: 'Untitled runbook',
        description: '',
        isActive: false,
        schedule: null,
        tags: [],
        errorHandling: 'stop',
        timeout: 30000,
    });

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

        isRunDialogOpen,
        handleOpenRunDialog,
        handleCloseRunDialog,
        snapToGrid,
        toggleSnapToGrid,
    } = useEditorCanvas({
        lang,
        workflowId: urlRunbookId ?? undefined,
        runbookHeader: {
            name: workflowProperties.name,
            description: workflowProperties.description,
            schedule: workflowProperties.schedule,
        },
    });

    // Auto Layout Handler
    const handleAutoLayout = () => {
        const { nodes: layoutedNodes } = getAutoLayout(nodes, connections);
        setNodes(layoutedNodes);
    };

    const [showTerminal, setShowTerminal] = useState(false);
    const [runMode, setRunMode] = useState<'run' | 'debug' | 'dry-run'>('run'); // New State
    const [isWorkflowPropsOpen, setIsWorkflowPropsOpen] = useState(false);
    const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
    const [isMetricsDashboardOpen, setIsMetricsDashboardOpen] = useState(false);
    const [isYamlViewOpen, setIsYamlViewOpen] = useState(false);
    const [isAssistOpen, setIsAssistOpen] = useState(false);
    const [isGitHubOpen, setIsGitHubOpen] = useState(false);
    // Load a runbook from /editor?id=<workflowId>. Until this effect
    // ran, the editor showed INITIAL_NODES — a single empty shell step
    // — regardless of what the user clicked from /runbooks. This is
    // the wiring that makes the ✏ Edit button on the Runbooks page
    // actually open the right runbook. Idempotent via loadedRunbookIdRef
    // so React StrictMode double-invocation doesn't double-fetch.
    useEffect(() => {
        if (!urlRunbookId) return;
        if (loadedRunbookIdRef.current === urlRunbookId) return;
        loadedRunbookIdRef.current = urlRunbookId;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/runbooks/${urlRunbookId}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const wf = await res.json();
                if (cancelled) return;

                // Two paths: the workflow row stores nodes + connections
                // as JSON columns (legacy fast path the autosave writes
                // to). Prefer that. If empty / missing, fall back to the
                // YAML round-trip endpoint so a runbook authored via
                // CLI is still loadable in the canvas.
                let loadedNodes: any[] = [];
                let loadedConnections: any[] = [];
                if (Array.isArray(wf.nodes) && wf.nodes.length > 0) {
                    loadedNodes = wf.nodes;
                    loadedConnections = Array.isArray(wf.connections) ? wf.connections : [];
                } else {
                    try {
                        const yamlRes = await fetch(`${API_BASE}/api/runbooks/${urlRunbookId}/yaml`);
                        if (yamlRes.ok) {
                            const yamlBody = await yamlRes.text();
                            const spec = yamlToSpec(yamlBody);
                            const parsed = specToNodes(spec);
                            loadedNodes = parsed.nodes;
                            loadedConnections = parsed.connections;
                        }
                    } catch {
                        // YAML path is best-effort; legacy nodes stay primary.
                    }
                }
                if (cancelled) return;
                handleLoadWorkflow(loadedNodes, loadedConnections);
                setWorkflowProperties((prev) => ({
                    ...prev,
                    name: wf.name ?? prev.name,
                    description: wf.description ?? prev.description,
                    isActive: wf.isActive ?? prev.isActive,
                    schedule: wf.schedule ?? prev.schedule,
                    inputs: Array.isArray(wf.inputs) ? wf.inputs : [],
                }));
                setLoadError(null);
            } catch (err) {
                if (cancelled) return;
                setLoadError(err instanceof Error ? err.message : 'unknown');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [urlRunbookId, handleLoadWorkflow]);

    // Persist typed input declarations via the dedicated route so
    // this write does not collide with the YAML-first autosave path.
    // Debounced so rapid edits in the panel coalesce into one PUT.
    const savedInputsRef = useRef<string>(JSON.stringify(workflowProperties.inputs ?? []));
    useEffect(() => {
        if (!urlRunbookId) return;
        const serialized = JSON.stringify(workflowProperties.inputs ?? []);
        if (serialized === savedInputsRef.current) return;
        const timer = setTimeout(() => {
            fetch(`${API_BASE}/api/runbooks/${urlRunbookId}/inputs`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: workflowProperties.inputs ?? [] }),
            })
                .then((res) => {
                    if (res.ok) savedInputsRef.current = serialized;
                })
                .catch(() => {
                    /* best-effort — retry on next change */
                });
        }, 800);
        return () => clearTimeout(timer);
    }, [urlRunbookId, workflowProperties.inputs]);

    const { executeWorkflow, executeFromNode, executing, currentExecutionId } = useWorkflowExecution('current-workflow');
    const { logs, nodeStatuses, nodeMeta } = useExecutionSocket(currentExecutionId);

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

    // xyOps Tool System (kept for the move/draw mode toggle on the
    // toolbar, even though the soldering "draw" path was removed —
    // the move-mode bool is still consumed by NodesLayer for cursor
    // affordances).
    const { tool, selectTool, isDrawMode, isMoveMode } = useEditorTools();

    const handleExecuteWithInput = async (input: object) => {
        setShowTerminal(true);
        await executeWorkflow(input, runMode);
    };

    // Wrappers for Run/Debug
    const handleOpenRun = () => {
        setRunMode('run');
        handleOpenRunDialog();
    };

    const handleOpenDebug = () => {
        setRunMode('debug');
        handleOpenRunDialog();
    };

    const handleOpenDryRun = () => {
        setRunMode('dry-run');
        handleOpenRunDialog();
    };

    // Test From Node handler - executes workflow starting from a specific node
    const handleTestFromNode = async () => {
        if (contextMenu?.nodeId) {
            setShowTerminal(true);
            await executeFromNode(contextMenu.nodeId, {});
        }
        handleCloseContextMenu();
    };

    // --- Command Palette Logic ---
    const commandActions: CommandAction[] = useMemo(() => [
        // General
        { id: 'undo', label: lang === 'en' ? 'Undo' : 'Deshacer', shortcut: ['Ctrl', 'Z'], action: undo },
        { id: 'redo', label: lang === 'en' ? 'Redo' : 'Rehacer', shortcut: ['Ctrl', 'Y'], action: redo },

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
        { id: 'auto_layout', label: lang === 'en' ? 'Auto layout' : 'Organizar runbook', action: handleAutoLayout },

        // Execution
        { id: 'run', label: lang === 'en' ? 'Run runbook' : 'Ejecutar runbook', shortcut: ['Ctrl', 'Enter'], action: () => handleExecuteWithInput({}) },
        { id: 'terminal', label: lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal', action: () => setShowTerminal(p => !p) },

        // Tools
        { id: 'history', label: lang === 'en' ? 'Version History' : 'Historial de Versiones', action: () => setIsSnapshotDialogOpen(true) },

    ], [lang, undo, redo, handleZoomIn, handleZoomOut, handleFitView, handleResetZoom, handleConfirmDelete, handleContextMenuDuplicate, handleAutoLayout, handleExecuteWithInput]);

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
            <div className="flex h-screen w-full overflow-hidden bg-[var(--box-background-color)]">
                {/* 1. Sidebar */}
                <EditorSidebar lang={lang} />

                {/* 2. Main Content Area */}
                <div className="flex-1 flex flex-col relative h-full overflow-hidden">

                    {/* 2.1 TopBar */}
                    <div className="z-40">
                        <TopBar
                            lang={lang}
                            workflowName={workflowProperties.name}
                            onRun={handleOpenRun}
                            onDebug={handleOpenDebug}
                            onDryRun={handleOpenDryRun}
                            isExecuting={executing}
                            onProperties={() => setIsWorkflowPropsOpen(true)}
                            onAddNode={() => setSearchTrigger(Date.now())}
                            onAutoLayout={handleAutoLayout}
                            saveStatus={saveStatus}
                            onTemplates={() => setIsTemplateGalleryOpen(true)}
                            onMetrics={() => setIsMetricsDashboardOpen(true)}
                            onYaml={() => setIsYamlViewOpen(true)}
                            onAssist={() => setIsAssistOpen(true)}
                            hasFailedNode={nodes.some((n) => n.executionState === 'error')}
                            snapToGrid={snapToGrid}
                            onToggleSnapToGrid={toggleSnapToGrid}
                            onGitHub={() => setIsGitHubOpen(true)}
                            onExport={() => {
                                const data = JSON.stringify({ nodes, connections }, null, 2);
                                const blob = new Blob([data], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                const slug = (workflowProperties.name || 'workflow')
                                    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                                link.download = `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            onImport={(file) => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    try {
                                        const json = JSON.parse(event.target?.result as string);
                                        if (!json.nodes || !Array.isArray(json.nodes) || !json.connections || !Array.isArray(json.connections)) {
                                            alert(lang === 'en' ? 'Invalid workflow file: must contain "nodes" and "connections" arrays' : 'Archivo inválido: debe contener arrays "nodes" y "connections"');
                                            return;
                                        }
                                        // Validate that each node has the minimum required shape
                                        const valid = json.nodes.every((n: any) =>
                                            n && typeof n.id === 'string' && typeof n.type === 'string' && n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
                                        );
                                        if (!valid) {
                                            alert(lang === 'en' ? 'Invalid workflow file: nodes must have id, type, and position' : 'Archivo inválido: los nodos deben tener id, type y position');
                                            return;
                                        }
                                        handleLoadWorkflow(json.nodes, json.connections);
                                    } catch (err) {
                                        console.error(err);
                                        alert(lang === 'en' ? 'Error parsing JSON file' : 'Error al parsear archivo JSON');
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
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onDrop={handleCanvasDrop}
                        onDragOver={handleCanvasDragOver}
                        onClick={handleCanvasClick}
                        onContextMenu={(e) => handleContextMenu(e, 'canvas')}
                        role="application"
                        aria-label={lang === 'en' ? 'Runbook canvas' : 'Canvas del runbook'}
                    >
                        <a
                            href="#workflow-canvas"
                            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/70"
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
                            viewport={viewport}
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
                            onNodeClick={handleNodeClick}
                            onNodeMove={handleNodeMove}
                            onNodeUpdate={handleNodeUpdate}
                            onNodeDoubleClick={setConfigNodeId}
                            editorMode={tool === 'draw' ? 'connect' : 'move'}
                            nodeStatuses={nodeStatuses}
                            nodeMeta={nodeMeta}
                        />

                        {/* Selection Box */}
                        {selectionBox && getSelectionBoxStyle() && (
                            <div
                                id="d_wf_selection_draw"
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

                            searchTrigger={searchTrigger}
                            isTemplateGalleryOpen={isTemplateGalleryOpen}
                            onTemplateGalleryOpenChange={setIsTemplateGalleryOpen}
                            isMetricsDashboardOpen={isMetricsDashboardOpen}
                            onMetricsDashboardOpenChange={setIsMetricsDashboardOpen}
                        />

                        <RunDialog
                            isOpen={isRunDialogOpen}
                            onClose={handleCloseRunDialog}
                            onRun={handleExecuteWithInput}
                            lang={lang}
                            isExecuting={executing}
                            logs={logs}
                            executionId={currentExecutionId}
                            inputs={workflowProperties.inputs ?? []}
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
                            onClick={() => setShowTerminal(!showTerminal)}
                            className={`absolute bottom-6 right-6 p-3 rounded-full shadow-2xl transition-all duration-300 z-50 group ${showTerminal ? 'bg-slate-800 text-slate-400 rotate-90' : 'bg-primary text-white hover:bg-primary hover:scale-110'
                                }`}
                            title={lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal'}
                        >
                            {showTerminal ? <X size={20} /> : <TerminalIcon size={20} />}
                            <span className="absolute right-full mr-3 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest font-bold border border-slate-700">
                                {lang === 'en' ? 'Terminal' : 'Terminal'}
                            </span>
                        </button>

                        {/* Bottom Terminal Panel */}
                        <div className={`
                            absolute bottom-0 left-0 right-0 h-64 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out z-40
                            ${showTerminal ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
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
                                        onClick={() => setShowTerminal(false)}
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
                        <RunbookAssistPanel
                            open={isAssistOpen}
                            onClose={() => setIsAssistOpen(false)}
                            lang={lang}
                            failedNode={nodes.find((n) => n.executionState === 'error') ?? null}
                        />
                        <GitHubBranchPanel
                            open={isGitHubOpen}
                            onClose={() => setIsGitHubOpen(false)}
                            lang={lang}
                        />
                        <YamlViewModal
                            open={isYamlViewOpen}
                            onClose={() => setIsYamlViewOpen(false)}
                            lang={lang}
                            header={{
                                name: workflowProperties.name,
                                description: workflowProperties.description ?? null,
                                schedule: workflowProperties.schedule ?? null,
                            }}
                            nodes={nodes}
                            connections={connections}
                            onApply={({ header, nodes: newNodes, connections: newConnections }) => {
                                setWorkflowProperties((prev) => ({
                                    ...prev,
                                    name: header.name,
                                    description: header.description ?? prev.description,
                                    schedule: header.schedule ?? prev.schedule,
                                }));
                                handleLoadWorkflow(newNodes, newConnections);
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
