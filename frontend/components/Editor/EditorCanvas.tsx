'use client';

import { useEditorCanvas } from '../../hooks/useEditorCanvas';
import { getAutoLayout } from '../../utils/layoutUtils';
import { calculateComplexityScore } from '../../utils/complexityScore';
import { scanWorkflowSecurity } from '../../utils/securityScanner';
import { lintWorkflow } from '../../utils/architectureLinter';
import { ConnectionsLayer, ConnectionBubblesLayer, NodesLayer, GridLayer, EditorOverlays, ExecutionMonitor } from './';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { useExecutionSocket } from '../../hooks/useExecutionSocket';
import dynamic from 'next/dynamic';
const LogTerminal = dynamic(() => import('./terminal/LogTerminal'), { ssr: false });
import { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, X, Zap, Download, Upload, FileText, Bug, Globe, Sparkles, Clock } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import PublishTemplateDialog from '../Workflow/PublishTemplateDialog';
import AIAssistant from './AIAssistant';
import SnapshotDialog from '../Workflow/SnapshotDialog';
import { useSnapshots } from '../../hooks/useSnapshots';
import { useEditorTools } from '../../hooks/useEditorTools';
import { useEditorSoldering } from '../../hooks/useEditorSoldering';
import { useAI, AISuggestion, WorkflowDocumentation, FailurePrediction, WorkflowOptimization } from '../../hooks/useAI';
import SolderingOverlay from './SolderingOverlay';
import RunDialog from '../Workflow/RunDialog';
import CommandPalette, { CommandAction } from './CommandPalette';
import TopBar from './TopBar';
import ContextualSuggestions from './ContextualSuggestions';
import { createNewNode } from './EditorCanvas.utils';
import WorkflowPropertiesPanel, { WorkflowProperties } from './WorkflowPropertiesPanel';
import WorkflowPermissionsModal from './WorkflowPermissionsModal';
import { useEditorTheme } from '../../context/EditorThemeContext';
import N8nImportModal from './N8nImportModal';
import N8nExportModal from './N8nExportModal';
import UniversalImportModal from './UniversalImportModal';
import { useApprovals } from '../../hooks/useApprovals';
import './WorkflowNode.css';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
    // Confetti canvas ref for advanced confetti
    const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [searchTrigger, setSearchTrigger] = useState<number>(0);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [terminalTab, setTerminalTab] = useState<'logs' | 'history' | 'trace' | 'debug'>('logs');

    const { config } = useEditorTheme();
    const { 
        executeWorkflow, 
        executeFromNode, 
        resumeWorkflow,
        executing, 
        currentExecutionId, 
        setCurrentExecutionId 
    } = useWorkflowExecution('current-workflow');

    const {
        executionStatus,
        nodeStatuses: rawNodeStatuses,
        nodeOutputs,
        nodeTestResults,
        logs: executionLogs,
        clearLogs,
    } = useExecutionSocket(currentExecutionId);

    // Filter nodeStatuses to only include valid status values for components
    const nodeStatuses = useMemo(() => {
        const filtered: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'> = {};
        for (const [key, value] of Object.entries(rawNodeStatuses)) {
            if (value === 'RUNNING' || value === 'SUCCESS' || value === 'FAILED') {
                filtered[key] = value;
            }
        }
        return filtered;
    }, [rawNodeStatuses]);

    const {
        nodes,
        connections,
        viewport,
        selectionBox,
        draggingNode,
        hoveredInputNode,
        selectedNodes,
        highlightedNodes,
        focusedNodeIndex,
        dbNodeTypes,
        saveStatus,
        complexityResult,
        securityResult,
        lintResult,
        executionMetrics,
        cycleError,
        cyclicConnections,
        deleteConfirm,
        deleteConnectionConfirm,
        contextMenu,
        configNodeId,
        showOnboarding,
        onboardingStep,
        highContrast,
        blastRadiusMode,
        canvasRef,
        windowSize,
        handleWheel,
        handleMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        handleCanvasClick,
        handleNodeDragStart,
        handleNodeDrag,
        handleNodeDragEnd,
        handlePortDragStart,
        handlePortDragEnd,
        handleNodeClick,
        handleNodeMove,
        handleNodeUpdate,
        handleConnectionSelect,
        handleDeleteNodeById,
        handleConfirmDelete,
        handleCancelDelete,
        handleConfirmDeleteConnection,
        handleCancelDeleteConnection,
        handleCloseConfigPanel,
        handleContextMenu,
        handleCloseContextMenu,
        handleContextMenuDuplicate,
        handleDeleteFromContextMenu,
        handleContextMenuToggleEnable,
        handleContextMenuToggleBreakpoint,
        handleContextMenuTogglePinData,
        handleDetachConnections,
        handleLoadWorkflow,
        handleSelectTemplate,
        handleNodeAddFromSearch,
        handleHighlightNodes,
        handleSearchNodeSelect,
        handleOnboardingNext,
        handleOnboardingSkip,
        handleOnboardingClose,
        handleClearAll,
        handleAutoLayout,
        handleZoomIn,
        handleZoomOut,
        handleFitView,
        handleResetZoom,
        handleViewportChangeAdapter,
        getSelectionBoxStyle,
        getNodeBlastRadiusStyle,
        toggleBlastRadiusMode,
        setBlastRadiusFocusedNode,
        forceSave,
        undo,
        redo,
        canUndo,
        canRedo,
        setConfigNodeId,
        setNodes,
        handleCanvasDrop,
        handleCanvasDragOver,
    } = useEditorCanvas({ lang, confettiCanvasRef });

    // Auto-open terminal on execution or pause
    useEffect(() => {
        if (executing || executionStatus === 'RUNNING' || executionStatus === 'PAUSED') {
            setIsTerminalOpen(true);
        }
    }, [executing, executionStatus]);

    const handleResumeExecution = async (input?: any) => {
        if (!currentExecutionId) return;
        await resumeWorkflow(currentExecutionId, input);
    };

    // Auto-switch to debug tab on pause
    useEffect(() => {
        if (executionStatus === 'PAUSED') {
            setTerminalTab('debug');
            setIsTerminalOpen(true);
        }
    }, [executionStatus]);

    const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
    const [isWorkflowPropsOpen, setIsWorkflowPropsOpen] = useState(false);
    const [isMetricsDashboardOpen, setIsMetricsDashboardOpen] = useState(false);
    const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
    const [isN8nImportOpen, setIsN8nImportOpen] = useState(false);
    const [isUniversalImportOpen, setIsUniversalImportOpen] = useState(false);
    const [isN8nExportOpen, setIsN8nExportOpen] = useState(false);
    const [runMode, setRunMode] = useState<'run' | 'debug'>('run');
    const [solderDropPos, setSolderDropPos] = useState<{ x: number; y: number } | null>(null);
    const [workflowProperties, setWorkflowProperties] = useState<WorkflowProperties>({
        name: 'Untitled Workflow',
        description: '',
        isActive: false,
        requiresApproval: false,
        schedule: null,
        tags: [],
        errorHandling: 'stop',
        timeout: 30000,
    });
    
    const [latestApproval, setLatestApproval] = useState<any>(null);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const { requestApproval } = useApprovals();
    const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);

    const handleOpenRunDialog = () => setIsRunDialogOpen(true);
    const handleCloseRunDialog = () => setIsRunDialogOpen(false);

    const hasPendingApproval = latestApproval?.status === 'PENDING';

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
            handleConnectionSelect({ source: sourceId, target: targetId, sourcePort, targetPort } as any);
        },
        isDrawMode
    });

    const handleExecuteWithInput = async (input: object) => {
        await forceSave();
        await executeWorkflow(input, runMode);
    };

    const handleDirectRun = async () => {
        await forceSave();
        await executeWorkflow({}, 'run');
    };

    const handleOpenRunWithInput = () => {
        setRunMode('run');
        handleOpenRunDialog();
    };

    const handleOpenDebug = () => {
        setRunMode('debug');
        handleOpenRunDialog();
    };

    const handleStopExecution = () => {
        // Stop execution requested - implementation pending
    };

    const handleTestFromNode = async () => {
        if (contextMenu?.nodeId) {
            await executeFromNode(contextMenu.nodeId, {});
        }
        handleCloseContextMenu();
    };

    const handleNodeRunFromToolbar = async (nodeId: string) => {
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

    const handleNodeClickWithBlastRadius = (nodeId: string) => {
        handleNodeClick(nodeId);
        if (blastRadiusMode !== 'off') {
            setBlastRadiusFocusedNode(nodeId);
        }
    };

    const handleNodeDoubleClick = (nodeId: string) => {
        const node = nodes.find((n: any) => n.id === nodeId) as any;
        if (node && (node.type === 'n8n-nodes-base.ExecuteWorkflow' || node.type === 'ExecuteWorkflow')) {
            const workflowId = node.parameters?.workflowId || node.data?.workflowId;
            if (workflowId && typeof workflowId === 'string') {
                window.open(`/workflow/${workflowId}`, '_blank');
                return;
            }
        }
        setConfigNodeId(nodeId);
    };

    useEffect(() => {
        if (executionLogs.length > 0) {
            const lastLog = executionLogs[executionLogs.length - 1];
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
    }, [executionLogs]);

    const handleSolderDropCancel = () => {
        setSolderDropPos(null);
        cancelSolder();
    };

    const commandActions: CommandAction[] = useMemo(() => [
        { id: 'undo', label: lang === 'en' ? 'Undo' : 'Deshacer', shortcut: ['Ctrl', 'Z'], action: undo },
        { id: 'redo', label: lang === 'en' ? 'Redo' : 'Rehacer', shortcut: ['Ctrl', 'Y'], action: redo },
        { id: 'save', label: lang === 'en' ? 'Save Workflow' : 'Guardar Flujo', shortcut: ['Ctrl', 'S'], action: () => forceSave() },
        { id: 'zoom_in', label: lang === 'en' ? 'Zoom In' : 'Acercar', shortcut: ['Ctrl', '+'], action: handleZoomIn },
        { id: 'zoom_out', label: lang === 'en' ? 'Zoom Out' : 'Alejar', shortcut: ['Ctrl', '-'], action: handleZoomOut },
        { id: 'fit_view', label: lang === 'en' ? 'Fit View' : 'Ajustar Vista', shortcut: ['Shift', '1'], action: handleFitView },
        { id: 'reset_zoom', label: lang === 'en' ? 'Reset Zoom' : 'Resetear Zoom', action: handleResetZoom },
        { id: 'delete', label: lang === 'en' ? 'Delete Selected' : 'Eliminar Selección', shortcut: ['Del'], action: handleConfirmDelete },
        { id: 'duplicate', label: lang === 'en' ? 'Duplicate Selected' : 'Duplicar Selección', shortcut: ['Ctrl', 'D'], action: handleContextMenuDuplicate },
        { id: 'add_node', label: lang === 'en' ? 'Add Node' : 'Aspirar Nuevo Nodo', shortcut: ['Space'], action: () => setSearchTrigger(Date.now()) },
        { id: 'auto_layout', label: lang === 'en' ? 'Auto Layout' : 'Organizar Flujo', action: handleAutoLayout },
        { id: 'run', label: lang === 'en' ? 'Run Workflow' : 'Ejecutar', shortcut: ['Ctrl', 'Enter'], action: () => handleExecuteWithInput({}) },
        { id: 'terminal', label: lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal', action: () => setIsTerminalOpen(p => !p) },
        { id: 'history', label: lang === 'en' ? 'Version History' : 'Historial de Versiones', action: () => setIsSnapshotDialogOpen(true) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [lang, undo, redo, handleZoomIn, handleZoomOut, handleFitView, handleResetZoom, handleConfirmDelete, handleContextMenuDuplicate, handleAutoLayout]);

    const handleLoadWorkflowWrapped = (importedNodes: any[], connections: any) => {
        setCurrentExecutionId(null);
        // ... (Conversion logic remains same but consolidated)
        handleLoadWorkflow(importedNodes, connections);
    };

    const handleSelectTemplateWrapped = async (templateNodes: any[], templateConnections: any[]) => {
        setCurrentExecutionId(null);
        const { nodes: transformedNodes, connections: transformedConnections } = handleSelectTemplate(templateNodes, templateConnections);
        await forceSave(transformedNodes, transformedConnections);
    };

    const handlePublishToMarketplace = async (data: any) => {
        try {
            await apiFetch('/api/templates/publish', {
                method: 'POST',
                body: JSON.stringify({ ...data, nodes, connections })
            });
        } catch (error) {
            console.error('Failed to publish template', error);
            throw error;
        }
    };

    const handleApplyAIWorkflow = async (aiNodes: any[], aiConnections: any[]) => {
        setCurrentExecutionId(null);
        const { nodes: transformedNodes, connections: transformedConnections } = handleSelectTemplate(aiNodes, aiConnections);
        await forceSave(transformedNodes, transformedConnections);
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

    const { 
        loading: aiLoading, 
        suggestNextNode,
        generateDocumentation, 
        predictFailures, 
        suggestOptimizations 
    } = useAI();

    const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

    useEffect(() => {
        if (isSoldering && soldering?.startNodeId) {
            suggestNextNode(nodes, connections, soldering.startNodeId, lang)
                .then(setAiSuggestions);
        } else if (!isSoldering) {
            setAiSuggestions([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSoldering, soldering?.startNodeId]);

    const handleGenerateDocs = async () => {
        const docs = await generateDocumentation(nodes, connections, lang);
        if (docs) alert(docs.summary);
    };

    const handleRunAIAnalysis = async () => {
        const [failures, optimizations] = await Promise.all([
            predictFailures(nodes, connections, lang),
            suggestOptimizations(nodes, connections, lang)
        ]);
        // AI analysis complete - results available for UI display
        void failures;
        void optimizations;
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setIsCommandPaletteOpen(true); }
            if (e.key === 'f' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSearchTrigger(Date.now()); }
            if (e.key === ' ' && !isInputFocused) { e.preventDefault(); setSearchTrigger(Date.now()); }
        };
        
        const handleOpenNodePalette = () => setSearchTrigger(Date.now());
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('nanoflow:open-node-palette', handleOpenNodePalette);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('nanoflow:open-node-palette', handleOpenNodePalette);
        };
    }, []);

    const handleSelectSuggestion = (type: string) => {
        if (soldering) {
            handleNodeAddFromSearch(type, soldering.mousePos.x, soldering.mousePos.y);
            cancelSolder();
        }
    };

    return (
        <div className="flex-1 flex flex-col relative h-full overflow-hidden">
            <div className="z-40">
                <TopBar
                    lang={lang}
                    workflowName={workflowProperties.name}
                    onWorkflowNameChange={(name) => setWorkflowProperties(prev => ({ ...prev, name }))}
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
                    onShare={() => setIsPermissionsModalOpen(true)}
                    onN8nImport={() => setIsN8nImportOpen(true)}
                    onUniversalImport={() => setIsUniversalImportOpen(true)}
                    onN8nExport={() => setIsN8nExportOpen(true)}
                    onGenerateDocs={handleGenerateDocs}
                    onRunAIAnalysis={handleRunAIAnalysis}
                    isAILoading={aiLoading}
                    blastRadiusMode={blastRadiusMode}
                    onToggleBlastRadius={toggleBlastRadiusMode}
                    complexityScore={complexityResult.score}
                    complexityLevel={complexityResult.level}
                    securityIssueCount={securityResult.issues.length}
                    securitySeverity={securityResult.highestSeverity}
                    lintErrorCount={lintResult.errorCount}
                    lintWarningCount={lintResult.warningCount}
                    lintPassed={lintResult.passed}
                    onExport={() => {}}
                    onImport={(file) => {}}
                />
            </div>

            <div
                id="workflow-canvas"
                ref={canvasRef}
                className={`wf_container wf_root relative w-full flex-1 overflow-hidden select-none editor-mode-${tool}`}
                style={{ backgroundColor: 'var(--box-background-color)', backgroundImage: 'none' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={(e) => {
                    handleCanvasMouseMove(e);
                    if (isSoldering) updateSolderPosition(e.clientX, e.clientY);
                }}
                onMouseUp={(e) => {
                    if (isSoldering) {
                        e.stopPropagation();
                        pauseSolder();
                        setSolderDropPos({ x: e.clientX, y: e.clientY });
                    } else handleCanvasMouseUp();
                }}
                onMouseLeave={handleCanvasMouseUp}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                onClick={handleCanvasClick}
                onContextMenu={(e) => handleContextMenu(e, 'canvas')}
            >
                <GridLayer viewport={viewport} highContrast={highContrast} />
                <ConnectionsLayer
                    connections={connections}
                    nodes={nodes}
                    nodeTypes={dbNodeTypes}
                    viewport={viewport}
                    soldering={soldering}
                    selectedConnection={null}
                    creatingConnection={null}
                    cyclicConnections={cyclicConnections}
                    onConnectionClick={handleConnectionSelect}
                    nodeStatuses={nodeStatuses}
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
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onContextMenu={(e, nodeId) => handleContextMenu(e, 'node', nodeId)}
                    editorMode={tool === 'draw' ? 'connect' : 'move'}
                    nodeStatuses={nodeStatuses}
                    onNodeRun={handleNodeRunFromToolbar}
                    onNodeToggleDisable={handleNodeToggleDisableFromToolbar}
                    onNodeDelete={handleDeleteNodeById}
                    onNodeDuplicate={handleNodeDuplicateFromToolbar}
                    onNodeFocus={handleNodeFocusFromToolbar}
                    lang={lang}
                    getNodeBlastRadiusStyle={getNodeBlastRadiusStyle}
                />

                {isSoldering && soldering && (
                    <>
                        <SolderingOverlay
                            nodes={nodes}
                            solderingNodeId={soldering.startNodeId}
                            solderingEndPort={soldering.endPort}
                            viewport={viewport}
                            onPortClick={completeSolder}
                        />
                        <ContextualSuggestions
                            soldering={soldering}
                            nodes={nodes}
                            viewport={viewport}
                            onSelectSuggestion={handleSelectSuggestion}
                            lang={lang}
                            aiSuggestions={aiSuggestions}
                        />
                    </>
                )}

                <AIAssistant onApplyWorkflow={handleApplyAIWorkflow} lang={lang} />
                <canvas ref={confettiCanvasRef} className="effects-canvas" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 200 }} />

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
                    onContextMenuTogglePinData={handleContextMenuTogglePinData}
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
                    isTerminalOpen={isTerminalOpen}
                />

                <PublishTemplateDialog isOpen={isPublishDialogOpen} onClose={() => setIsPublishDialogOpen(false)} onPublish={handlePublishToMarketplace} lang={lang} workflowName={workflowProperties.name} />
                <RunDialog isOpen={isRunDialogOpen} onClose={handleCloseRunDialog} onRun={handleExecuteWithInput} lang={lang} isExecuting={executing} logs={executionLogs} executionId={currentExecutionId} />
                <SnapshotDialog isOpen={isSnapshotDialogOpen} onClose={() => setIsSnapshotDialogOpen(false)} snapshots={snapshots} onCreate={handleCreateSnapshot} onRestore={handleRestoreSnapshot} onDelete={deleteSnapshot} lang={lang} />
                <WorkflowPropertiesPanel isOpen={isWorkflowPropsOpen} properties={workflowProperties} onUpdate={(updates) => setWorkflowProperties(prev => ({ ...prev, ...updates }))} onClose={() => setIsWorkflowPropsOpen(false)} lang={lang} />
                {isPermissionsModalOpen && <WorkflowPermissionsModal lang={lang} workflowId="current-workflow" onClose={() => setIsPermissionsModalOpen(false)} />}
                <N8nImportModal isOpen={isN8nImportOpen} onClose={() => setIsN8nImportOpen(false)} onImport={handleLoadWorkflowWrapped} lang={lang} />
                <UniversalImportModal isOpen={isUniversalImportOpen} onClose={() => setIsUniversalImportOpen(false)} onImport={handleLoadWorkflowWrapped} lang={lang} />
                <N8nExportModal isOpen={isN8nExportOpen} onClose={() => setIsN8nExportOpen(false)} nodes={nodes} connections={connections} workflowName={workflowProperties.name} lang={lang} />

                <button
                    id="terminal-toggle"
                    onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                    className={`absolute bottom-6 right-6 p-3 rounded-full shadow-2xl transition-all duration-300 z-50 group ${isTerminalOpen ? 'bg-slate-800 text-slate-400 rotate-90' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-110'}`}
                    title={lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal'}
                >
                    {isTerminalOpen ? <X size={20} /> : <TerminalIcon size={20} />}
                </button>

                <div id="execution-terminal" className={`absolute bottom-0 left-0 right-0 h-80 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out z-40 ${isTerminalOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                    <div className="flex items-center justify-between px-4 py-1 bg-slate-800/50 border-b border-slate-700">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${executing || executionStatus === 'RUNNING' ? 'bg-green-500 animate-pulse' : (executionStatus === 'PAUSED' ? 'bg-orange-500' : 'bg-slate-600')}`} />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Terminal</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setTerminalTab('logs')} className={`px-3 py-2 text-[10px] uppercase font-bold tracking-widest border-b-2 ${terminalTab === 'logs' ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent'}`}>Logs</button>
                                <button onClick={() => setTerminalTab('debug')} className={`px-3 py-2 text-[10px] uppercase font-bold tracking-widest border-b-2 ${terminalTab === 'debug' ? 'text-orange-400 border-orange-500' : 'text-slate-500 border-transparent'}`}>Debug</button>
                                <button onClick={() => setTerminalTab('history')} className={`px-3 py-2 text-[10px] uppercase font-bold tracking-widest border-b-2 ${terminalTab === 'history' ? 'text-purple-400 border-purple-500' : 'text-slate-500 border-transparent'}`}>History</button>
                            </div>
                        </div>
                        <button onClick={() => setIsTerminalOpen(false)} className="p-1 text-slate-500 hover:text-white"><X size={16} /></button>
                    </div>
                    <div className="w-full h-[calc(100%-40px)] overflow-hidden">
                        {terminalTab === 'logs' && <div className="h-full p-1"><LogTerminal logs={executionLogs} /></div>}
                        {terminalTab === 'debug' && <div className="h-full p-4 overflow-y-auto"><ExecutionMonitor executionId={currentExecutionId} status={executionStatus || undefined} nodeStatuses={nodeStatuses as any} nodeOutputs={nodeOutputs} nodeTestResults={nodeTestResults} nodes={nodes} onResume={handleResumeExecution} lang={lang} /></div>}
                    </div>
                </div>
                <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} actions={commandActions} lang={lang} />
            </div>
        </div>
    );
}
