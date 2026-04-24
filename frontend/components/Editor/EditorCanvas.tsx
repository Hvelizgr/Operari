'use client';

import dynamic from 'next/dynamic';

import { useEditorCanvas } from '../../hooks/useEditorCanvas';
import { useExecutionSocket } from '../../hooks/useExecutionSocket';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { getAutoLayout } from '../../utils/layoutUtils';
import {
  ConnectionBubblesLayer,
  ConnectionsLayer,
  EditorOverlays,
  GridLayer,
  NodesLayer,
} from './';
const LogTerminal = dynamic(() => import('./terminal/LogTerminal'), { ssr: false });
import type { Connection, WorkflowNode } from '@cairn/shared';
import { Terminal as TerminalIcon, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { specToNodes, yamlToSpec } from '@/utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
// ... existing imports
import './WorkflowNode.css';

import { useEditorTools } from '../../hooks/useEditorTools';
import { useSnapshots } from '../../hooks/useSnapshots';
import ExecutionEventLog from '../Runs/ExecutionEventLog';
import RunDialog from '../Workflow/RunDialog';
import ScheduleDialog from '../Workflow/ScheduleDialog';
import SnapshotDialog from '../Workflow/SnapshotDialog';
import CanvasRunStatus from './CanvasRunStatus';
import CommandPalette, { CommandAction } from './CommandPalette';
import EditorSidebar from './EditorSidebar';
import GitHubBranchPanel from './GitHubBranchPanel';
import OnboardingRunHint from './OnboardingRunHint';
import RunbookAssistPanel from './RunbookAssistPanel';
import TopBar from './TopBar';
import WorkflowPropertiesPanel, { WorkflowProperties } from './WorkflowPropertiesPanel';
import YamlViewModal from './YamlViewModal';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const searchParams = useSearchParams();
  const urlRunbookId = searchParams?.get('id') ?? null;
  const loadedRunbookIdRef = useRef<string | null>(null);
  const [, setLoadError] = useState<string | null>(null);
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
    handleNodeAddFromSearch,
    handleViewportChangeAdapter,

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

  // Auto Layout Handler. Wrapped in useCallback so the command-palette
  // useMemo that captures it doesn't invalidate on every render.
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes } = getAutoLayout(nodes, connections);
    setNodes(layoutedNodes);
  }, [nodes, connections, setNodes]);

  const [showTerminal, setShowTerminal] = useState(false);
  const [runMode, setRunMode] = useState<'run' | 'debug' | 'dry-run'>('run'); // New State
  const [isWorkflowPropsOpen, setIsWorkflowPropsOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
  const [isMetricsDashboardOpen, setIsMetricsDashboardOpen] = useState(false);
  const [isYamlViewOpen, setIsYamlViewOpen] = useState(false);
  const [isAssistOpen, setIsAssistOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [isEventLogOpen, setIsEventLogOpen] = useState(false);
  // Wall-clock ms when the current run started. Lives up here as
  // state but the effect that keys on `executing` is declared below
  // where the execution hook result is in scope.
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
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
        let loadedNodes: WorkflowNode[] = [];
        let loadedConnections: Connection[] = [];
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
        setWorkflowProperties(prev => ({
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
        .then(res => {
          if (res.ok) savedInputsRef.current = serialized;
        })
        .catch(() => {
          /* best-effort — retry on next change */
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [urlRunbookId, workflowProperties.inputs]);

  const { executeWorkflow, executeFromNode, executing, currentExecutionId } =
    useWorkflowExecution('current-workflow');
  const { logs, nodeStatuses, nodeMeta } = useExecutionSocket(currentExecutionId);

  // Capture run start time on executing transition. Pairs with the
  // runStartedAt state declared above the execution hook. Setting
  // on true-edge gives the canvas status pill a fresh elapsed-time
  // anchor; nulling on false-edge keeps the next run's clock at 0.
  useEffect(() => {
    if (executing) {
      setRunStartedAt(Date.now());
    } else {
      setRunStartedAt(null);
    }
  }, [executing]);

  // --- SNAPSHOT SYSTEM ---
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } =
    useSnapshots('current-workflow');

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
  const { tool, selectTool } = useEditorTools();

  const handleExecuteWithInput = useCallback(
    async (input: object) => {
      setShowTerminal(true);
      const result = await executeWorkflow(input, runMode);
      // Translate the hook's result shape (kind: ok/invalid_inputs/error)
      // into the Run dialog's DialogRunResult so the form can render
      // per-field server errors instead of swallowing them.
      if (!result) return { status: 'ok' as const };
      if (result.kind === 'ok') return { status: 'ok' as const };
      if (result.kind === 'invalid_inputs') {
        return { status: 'invalid_inputs' as const, issues: result.issues };
      }
      return { status: 'error' as const, message: result.message };
    },
    [executeWorkflow, runMode]
  );

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
  const commandActions: CommandAction[] = useMemo(
    () => [
      // General
      {
        id: 'undo',
        label: lang === 'en' ? 'Undo' : 'Deshacer',
        shortcut: ['Ctrl', 'Z'],
        action: undo,
      },
      {
        id: 'redo',
        label: lang === 'en' ? 'Redo' : 'Rehacer',
        shortcut: ['Ctrl', 'Y'],
        action: redo,
      },

      // Navigation
      {
        id: 'zoom_in',
        label: lang === 'en' ? 'Zoom In' : 'Acercar',
        shortcut: ['Ctrl', '+'],
        action: handleZoomIn,
      },
      {
        id: 'zoom_out',
        label: lang === 'en' ? 'Zoom Out' : 'Alejar',
        shortcut: ['Ctrl', '-'],
        action: handleZoomOut,
      },
      {
        id: 'fit_view',
        label: lang === 'en' ? 'Fit View' : 'Ajustar Vista',
        shortcut: ['Shift', '1'],
        action: handleFitView,
      },
      {
        id: 'reset_zoom',
        label: lang === 'en' ? 'Reset Zoom' : 'Resetear Zoom',
        action: handleResetZoom,
      },

      // Nodes
      {
        id: 'delete',
        label: lang === 'en' ? 'Delete Selected' : 'Eliminar Selección',
        shortcut: ['Del'],
        action: handleConfirmDelete,
      },
      {
        id: 'duplicate',
        label: lang === 'en' ? 'Duplicate Selected' : 'Duplicar Selección',
        shortcut: ['Ctrl', 'D'],
        action: handleContextMenuDuplicate,
      },
      {
        id: 'select_all',
        label: lang === 'en' ? 'Select All' : 'Seleccionar Todo',
        shortcut: ['Ctrl', 'A'],
        action: () => {
          /* TODO */
        },
      },
      {
        id: 'add_node',
        label: lang === 'en' ? 'Add Node' : 'Aspirar Nuevo Nodo',
        shortcut: ['Space'],
        action: () => setSearchTrigger(Date.now()),
      },
      {
        id: 'auto_layout',
        label: lang === 'en' ? 'Auto layout' : 'Organizar runbook',
        action: handleAutoLayout,
      },

      // Execution
      {
        id: 'run',
        label: lang === 'en' ? 'Run runbook' : 'Ejecutar runbook',
        shortcut: ['Ctrl', 'Enter'],
        action: () => handleExecuteWithInput({}),
      },
      {
        id: 'terminal',
        label: lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal',
        action: () => setShowTerminal(p => !p),
      },

      // Tools
      {
        id: 'history',
        label: lang === 'en' ? 'Version History' : 'Historial de Versiones',
        action: () => setIsSnapshotDialogOpen(true),
      },
    ],
    [
      lang,
      undo,
      redo,
      handleZoomIn,
      handleZoomOut,
      handleFitView,
      handleResetZoom,
      handleConfirmDelete,
      handleContextMenuDuplicate,
      handleAutoLayout,
      handleExecuteWithInput,
    ]
  );

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
        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
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
              onSchedule={() => setIsScheduleDialogOpen(true)}
              scheduleExpr={workflowProperties.schedule}
              onAddNode={() => setSearchTrigger(Date.now())}
              onAutoLayout={handleAutoLayout}
              saveStatus={saveStatus}
              onTemplates={() => setIsTemplateGalleryOpen(true)}
              onMetrics={() => setIsMetricsDashboardOpen(true)}
              onYaml={() => setIsYamlViewOpen(true)}
              onAssist={() => setIsAssistOpen(true)}
              hasFailedNode={nodes.some(n => n.executionState === 'error')}
              snapToGrid={snapToGrid}
              onToggleSnapToGrid={toggleSnapToGrid}
              onGitHub={() => setIsGitHubOpen(true)}
              onEventLog={() => setIsEventLogOpen(true)}
              hasExecution={Boolean(currentExecutionId)}
              onExport={() => {
                const data = JSON.stringify({ nodes, connections }, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const slug = (workflowProperties.name || 'workflow')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '');
                link.download = `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              onImport={file => {
                const reader = new FileReader();
                reader.onload = event => {
                  try {
                    const json = JSON.parse(event.target?.result as string);
                    if (
                      !json.nodes ||
                      !Array.isArray(json.nodes) ||
                      !json.connections ||
                      !Array.isArray(json.connections)
                    ) {
                      alert(
                        lang === 'en'
                          ? 'Invalid workflow file: must contain "nodes" and "connections" arrays'
                          : 'Archivo inválido: debe contener arrays "nodes" y "connections"'
                      );
                      return;
                    }
                    // Validate that each node has the minimum required shape
                    const valid = json.nodes.every((n: unknown): n is WorkflowNode => {
                      if (!n || typeof n !== 'object') return false;
                      const node = n as Record<string, unknown>;
                      const pos = node.position as Record<string, unknown> | undefined;
                      return (
                        typeof node.id === 'string' &&
                        typeof node.type === 'string' &&
                        !!pos &&
                        typeof pos.x === 'number' &&
                        typeof pos.y === 'number'
                      );
                    });
                    if (!valid) {
                      alert(
                        lang === 'en'
                          ? 'Invalid workflow file: nodes must have id, type, and position'
                          : 'Archivo inválido: los nodos deben tener id, type y position'
                      );
                      return;
                    }
                    handleLoadWorkflow(json.nodes, json.connections);
                  } catch (err) {
                    console.error(err);
                    alert(
                      lang === 'en' ? 'Error parsing JSON file' : 'Error al parsear archivo JSON'
                    );
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
            className={`wf_container wf_root relative w-full flex-1 select-none overflow-hidden editor-mode-${tool} `}
            style={{
              backgroundColor: 'var(--box-background-color)',
              backgroundImage: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onClick={handleCanvasClick}
            onContextMenu={e => handleContextMenu(e, 'canvas')}
            role="application"
            aria-label={lang === 'en' ? 'Runbook canvas' : 'Canvas del runbook'}
          >
            <a
              href="#workflow-canvas"
              className="focus:bg-primary focus:ring-primary/70 sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2"
            >
              {lang === 'en' ? 'Skip to workflow canvas' : 'Saltar al lienzo de flujo de trabajo'}
            </a>

            <CanvasRunStatus
              executing={executing}
              hasFailedNode={nodes.some(n => n.executionState === 'error')}
              startedAt={runStartedAt}
              lang={lang}
            />

            <OnboardingRunHint
              nodeCount={nodes.length}
              isExecuting={executing}
              hasExecution={Boolean(currentExecutionId)}
              lang={lang}
            />

            <div id="canvas-instructions" className="sr-only">
              {lang === 'en'
                ? 'Use Tab to navigate between nodes, Arrow keys to move focus, Enter to select, Escape to deselect, Delete to remove selected nodes'
                : 'Use Tab para navegar entre nodos, teclas de flecha para mover el foco, Enter para seleccionar, Escape para deseleccionar, Delete para eliminar nodos seleccionados'}
            </div>

            <GridLayer viewport={viewport} highContrast={highContrast} />

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
              <div id="d_wf_selection_draw" style={getSelectionBoxStyle()!} />
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

            <ScheduleDialog
              isOpen={isScheduleDialogOpen}
              onClose={() => setIsScheduleDialogOpen(false)}
              lang={lang}
              value={workflowProperties.schedule}
              onChange={next => setWorkflowProperties(prev => ({ ...prev, schedule: next }))}
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
              onUpdate={updates => setWorkflowProperties(prev => ({ ...prev, ...updates }))}
              onClose={() => setIsWorkflowPropsOpen(false)}
              lang={lang}
            />

            {/* Event log slide-over. Mounts the shared ExecutionEventLog
                so authors see engine-emitted transitions (step start/
                completed/failed, retry attempts, replay resets) for
                the run they just fired without leaving the canvas.
                Only renders when a run has been dispatched in this
                session (the topbar button is also gated on that). */}
            {isEventLogOpen && currentExecutionId && (
              <div className="absolute inset-0 z-50 flex justify-end">
                <button
                  type="button"
                  aria-label={lang === 'en' ? 'Close event log' : 'Cerrar registro'}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                  onClick={() => setIsEventLogOpen(false)}
                />
                <div className="relative h-full w-[480px] max-w-[90vw] border-l border-slate-700 bg-slate-900 shadow-2xl">
                  <div className="flex h-[50px] items-center justify-between border-b border-slate-700 bg-slate-950/50 px-4">
                    <span className="text-sm font-semibold text-white">
                      {lang === 'en' ? 'Event log' : 'Registro de eventos'}
                    </span>
                    <button
                      onClick={() => setIsEventLogOpen(false)}
                      className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="h-[calc(100%-50px)] overflow-hidden p-3">
                    <ExecutionEventLog runId={currentExecutionId} lang={lang} live={executing} />
                  </div>
                </div>
              </div>
            )}

            {/* Floating Terminal Toggle */}
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`group absolute bottom-6 right-6 z-50 rounded-full p-3 shadow-2xl transition-all duration-300 ${
                showTerminal
                  ? 'rotate-90 bg-slate-800 text-slate-400'
                  : 'bg-primary hover:bg-primary text-white hover:scale-110'
              }`}
              title={lang === 'en' ? 'Toggle Terminal' : 'Alternar Terminal'}
            >
              {showTerminal ? <X size={20} /> : <TerminalIcon size={20} />}
              <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white opacity-0 transition-opacity group-hover:opacity-100">
                {lang === 'en' ? 'Terminal' : 'Terminal'}
              </span>
            </button>

            {/* Bottom Terminal Panel */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-40 h-64 border-t border-slate-700 bg-slate-900/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-500 ease-in-out ${showTerminal ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'} `}
            >
              <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4 py-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${executing ? 'animate-pulse bg-green-500' : 'bg-slate-600'}`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    {lang === 'en' ? 'Live Execution Log' : 'Registro de Ejecución en Vivo'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTerminal(false)}
                    className="p-1 text-slate-500 transition-colors hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="h-[calc(100%-40px)] w-full p-1">
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
              failedNode={nodes.find(n => n.executionState === 'error') ?? null}
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
                setWorkflowProperties(prev => ({
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
