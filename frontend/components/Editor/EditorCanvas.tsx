'use client';

import dynamic from 'next/dynamic';

import { EDITOR_CONFIG } from '../../config/editor.config';
import { useEditorCanvas } from '../../hooks/useEditorCanvas';
import { SNAP_GRID_PX } from '../../hooks/useEditorSnapToGrid';
import { isTypingTarget } from '../../hooks/useEditorKeyboard';
import { useExecutionSocket } from '../../hooks/useExecutionSocket';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { getAutoLayout } from '../../utils/layoutUtils';
import { EditorOverlays } from './';
import FlowCanvas from './flow/FlowCanvas';
const LogTerminal = dynamic(() => import('./terminal/LogTerminal'), { ssr: false });
import type { Connection, WorkflowNode } from '@operari/shared';
import { ReactFlowProvider } from '@xyflow/react';
import { Terminal as TerminalIcon, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { normalizeLegacyNodes } from '@/utils/canvas/legacy';
import { specToNodes, yamlToSpec } from '@/utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

import './WorkflowNode.css';

import { useEditorTools } from '../../hooks/useEditorTools';
import { useSnapshots } from '../../hooks/useSnapshots';
import RunDialog from '../Runbook/RunDialog';
import ScheduleDialog from '../Runbook/ScheduleDialog';
import SnapshotDialog from '../Runbook/SnapshotDialog';
import ExecutionEventLog from '../Runs/ExecutionEventLog';
import CanvasRunStatus from './CanvasRunStatus';
import CommandPalette, { CommandAction } from './CommandPalette';
import EditorSidebar from './EditorSidebar';
import FirstRunConfetti from './FirstRunConfetti';
import GitHubBranchPanel from './GitHubBranchPanel';
import OnboardingRunHint from './OnboardingRunHint';
import PendingHttpStepBanner from './PendingHttpStepBanner';
import RunbookAssistPanel from './RunbookAssistPanel';
import TopBar from './TopBar';
import WorkflowPropertiesPanel, { WorkflowProperties } from './WorkflowPropertiesPanel';
import YamlViewModal from './YamlViewModal';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
  return (
    <ReactFlowProvider>
      <EditorCanvasInner lang={lang} />
    </ReactFlowProvider>
  );
}

function EditorCanvasInner({ lang }: { lang: 'en' | 'es' }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const searchParams = useSearchParams();
  const urlRunbookId = searchParams?.get('id') ?? null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedRunbookId, setLoadedRunbookId] = useState<string | null>(null);
  // Workflow properties live up here (above useEditorCanvas) so the
  // header can be passed straight into the autosave hook for the
  // YAML-native save path.
  const [workflowProperties, setWorkflowProperties] = useState<WorkflowProperties>({
    name: 'Untitled runbook',
    description: '',
    isActive: false,
    schedule: null,
  });
  const savedInputsRef = useRef<string>('[]');

  // A fresh object each render would re-arm the autosave timer forever.
  const runbookHeader = useMemo(
    () => ({
      name: workflowProperties.name,
      description: workflowProperties.description,
      schedule: workflowProperties.schedule,
    }),
    [workflowProperties.name, workflowProperties.description, workflowProperties.schedule]
  );

  const {
    // Refs
    canvasRef,
    windowSize,

    // State
    nodes,
    addNodes,
    replaceNodes,
    connections,
    viewport,
    saveStatus,
    forceOverwrite,
    noteServerWrite,
    showOnboarding,
    onboardingStep,
    contextMenu,
    deleteConfirm,
    deleteConnectionConfirm,
    dbNodeTypes,
    executionMetrics,
    cycleError,
    selectedNodes,
    setSelectedNodes,
    highlightedNodes,
    focusedNodeIndex,
    selectedConnection,
    cyclicConnections,
    configNodeId,
    undo,
    redo,
    canUndo,
    canRedo,
    // Handlers
    handleFlowNodesChange,
    handleFlowEdgesChange,
    handleFlowNodeDragStart,
    handleFlowNodeDragStop,
    handleFlowConnect,
    handleCanvasDrop,
    handleCanvasDragOver,
    handlePaneClick,
    handleContextMenu,
    handleCloseContextMenu,

    handleContextMenuDuplicate,
    handleDuplicateSelected,
    handleRequestDeleteSelected,
    handleDeleteFromContextMenu,
    handleContextMenuToggleEnable,
    handleNodeClick,
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
    syncViewport,

    isRunDialogOpen,
    handleOpenRunDialog,
    handleCloseRunDialog,
    snapToGrid,
    toggleSnapToGrid,
  } = useEditorCanvas({
    lang,
    runbookId: urlRunbookId ?? undefined,
    runbookHeader,
    autosavePaused: urlRunbookId !== null && loadedRunbookId !== urlRunbookId,
    isActive: urlRunbookId ? workflowProperties.isActive : undefined,
  });

  // Auto Layout Handler. Wrapped in useCallback so the command-palette
  // useMemo that captures it doesn't invalidate on every render.
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes } = getAutoLayout(nodes, connections);
    replaceNodes(layoutedNodes);
  }, [nodes, connections, replaceNodes]);

  // Insert an `operari.httpRequest` step from a request stashed in
  // localStorage by the HTTP tester (`/[lang]/http-tester`). The
  // banner that drives this is mounted further down in the canvas
  // overlay; this handler owns the actual node creation so we can
  // reuse the same setNodes path the rest of the editor uses.
  const handleImportPendingHttpStep = useCallback(
    (config: { method: string; url: string; headers?: Record<string, string>; body?: string }) => {
      const centerX = (windowSize.width / 2 - viewport.x) / viewport.zoom;
      const centerY = (windowSize.height / 2 - viewport.y) / viewport.zoom;
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}-http`,
        position: { x: centerX - 128, y: centerY - 32 },
        title: lang === 'es' ? 'Solicitud HTTP' : 'HTTP request',
        type: 'operari.httpRequest',
        config: {
          method: config.method,
          url: config.url,
          ...(config.headers ? { headers: config.headers } : {}),
          ...(config.body ? { body: config.body } : {}),
        },
        inputs: [{ id: 'in', label: 'Input' }],
        outputs: [{ id: 'out', label: 'Output' }],
      };
      addNodes([newNode]);
    },
    [addNodes, viewport, windowSize, lang]
  );

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
  // Load a runbook from /editor?id=<runbookId>. Until this effect
  // ran, the editor showed INITIAL_NODES — a single empty shell step
  // — regardless of what the user clicked from /runbooks. This is
  // the wiring that makes the ✏ Edit button on the Runbooks page
  // actually open the right runbook. No "already loaded" ref guard:
  // under StrictMode it skipped the second pass after the first one had
  // been cancelled, so nothing ever loaded.
  useEffect(() => {
    if (!urlRunbookId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/runbooks/${urlRunbookId}`, {
          credentials: 'include',
        });
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
          ({ nodes: loadedNodes, connections: loadedConnections } = normalizeLegacyNodes(
            wf.nodes,
            Array.isArray(wf.connections) ? wf.connections : []
          ));
        } else {
          try {
            const yamlRes = await fetch(`${API_BASE}/api/runbooks/${urlRunbookId}/yaml`, {
              credentials: 'include',
            });
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
        const loadedInputs = Array.isArray(wf.inputs) ? wf.inputs : [];
        savedInputsRef.current = JSON.stringify(loadedInputs);
        setWorkflowProperties(prev => ({
          ...prev,
          id: urlRunbookId,
          name: wf.name ?? prev.name,
          description: wf.description ?? prev.description,
          isActive: wf.isActive ?? prev.isActive,
          schedule: wf.schedule ?? prev.schedule,
          inputs: loadedInputs,
        }));
        setFitRequest(n => n + 1);
        setLoadError(null);
        setLoadedRunbookId(urlRunbookId);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlRunbookId, handleLoadWorkflow]);

  // The first-load fit in useEditorCanvas fires on the placeholder
  // node before the fetch resolves, so frame the loaded runbook here.
  // Kept out of the loader effect: a new dep there would cancel the
  // in-flight fetch.
  const [fitRequest, setFitRequest] = useState(0);
  useEffect(() => {
    if (fitRequest > 0) handleFitView();
  }, [fitRequest, handleFitView]);

  // Persist typed input declarations via the dedicated route so
  // this write does not collide with the YAML-first autosave path.
  // Debounced so rapid edits in the panel coalesce into one PUT.
  useEffect(() => {
    if (!urlRunbookId) return;
    const serialized = JSON.stringify(workflowProperties.inputs ?? []);
    if (serialized === savedInputsRef.current) return;
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/runbooks/${urlRunbookId}/inputs`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: workflowProperties.inputs ?? [] }),
      })
        .then(async res => {
          if (!res.ok) return;
          savedInputsRef.current = serialized;
          const body = (await res.json().catch(() => null)) as { timestamp?: number } | null;
          if (typeof body?.timestamp === 'number') noteServerWrite(body.timestamp);
        })
        .catch(() => {
          /* best-effort — retry on next change */
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [urlRunbookId, workflowProperties.inputs, noteServerWrite]);

  // Use the real runbook ID from the URL when available. The old
  // hardcoded 'current-workflow' doesn't exist in the DB, so every
  // execution attempt returned 404. When urlRunbookId is null (new
  // unsaved runbook or template just loaded), the hook receives null
  // and executeWorkflow returns early with an error prompt.
  const {
    executeWorkflow,
    executeFromNode,
    executing: isStartingRun,
    currentExecutionId,
  } = useWorkflowExecution(urlRunbookId);
  const { logs, nodeStatuses, nodeMeta, executionStatus } = useExecutionSocket(currentExecutionId);

  // The hook's flag only covers the POST that starts the run. The run
  // itself lasts until the socket reports a terminal status; a null
  // status still counts as running because the RUNNING event is emitted
  // before the client has joined the execution room.
  const executing =
    isStartingRun ||
    (currentExecutionId !== null &&
      executionStatus !== 'SUCCESS' &&
      executionStatus !== 'FAILED' &&
      executionStatus !== 'CANCELLED');
  const failedNode = useMemo(
    () => nodes.find(n => nodeStatuses[n.id] === 'FAILED') ?? null,
    [nodes, nodeStatuses]
  );

  useEffect(() => {
    if (executing) {
      setRunStartedAt(Date.now());
    } else {
      setRunStartedAt(null);
    }
  }, [executing]);

  // Fire the one-shot first-run confetti on a successful completion.
  // Edge detection: true→false on `executing` with zero error nodes
  // = the run finished clean. The confetti component owns the
  // per-browser gate via localStorage, so re-renders after the flag
  // is set are no-ops.
  const [runJustCompleted, setRunJustCompleted] = useState(false);
  const prevExecutingRef = useRef(executing);
  useEffect(() => {
    const prev = prevExecutingRef.current;
    prevExecutingRef.current = executing;
    if (prev && !executing && executionStatus === 'SUCCESS') {
      setRunJustCompleted(true);
      // Flip back on the next tick so the confetti's false→true
      // edge detector catches the transition every time (in the
      // rare case the flag somehow clears).
      const timer = setTimeout(() => setRunJustCompleted(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [executing, executionStatus]);

  // --- SNAPSHOT SYSTEM ---
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } = useSnapshots(
    urlRunbookId ?? 'current-workflow'
  );

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

  // Toolbar move/draw toggle: in "draw" mode FlowCanvas turns
  // left-drag into box selection and locks node dragging.
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
  const handleOpenRun = useCallback(() => {
    setRunMode('run');
    handleOpenRunDialog();
  }, [handleOpenRunDialog]);

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
        action: handleZoomIn,
      },
      {
        id: 'zoom_out',
        label: lang === 'en' ? 'Zoom Out' : 'Alejar',
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
        action: handleRequestDeleteSelected,
      },
      {
        id: 'duplicate',
        label: lang === 'en' ? 'Duplicate Selected' : 'Duplicar Selección',
        shortcut: ['Ctrl', 'D'],
        action: handleDuplicateSelected,
      },
      {
        id: 'select_all',
        label: lang === 'en' ? 'Select All' : 'Seleccionar Todo',
        shortcut: ['Ctrl', 'A'],
        action: () => setSelectedNodes(new Set(nodes.map(n => n.id))),
      },
      {
        id: 'add_node',
        label: lang === 'en' ? 'Add Node' : 'Agregar Nuevo Nodo',
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
        action: handleOpenRun,
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
      handleRequestDeleteSelected,
      handleDuplicateSelected,
      handleAutoLayout,
      handleOpenRun,
      nodes,
      setSelectedNodes,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'k' && mod) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (!executing) handleOpenRun();
      } else if (mod && e.key === 'a') {
        e.preventDefault();
        setSelectedNodes(new Set(nodes.map(n => n.id)));
      } else if (mod && e.key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.shiftKey && !mod && e.code === 'Digit1') {
        e.preventDefault();
        handleFitView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executing, handleOpenRun, nodes, setSelectedNodes, handleDuplicateSelected, handleFitView]);

  return (
    <>
      <div
        data-cmdk-scope
        className="marketing-shell flex h-screen w-full overflow-hidden bg-[var(--app-bg)]"
      >
        {/* Grain overlay is applied via .marketing-shell::before in globals.css */}

        {/* 1. Sidebar */}
        <EditorSidebar lang={lang} />

        {/* 2. Main Content Area */}
        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
          {/* 2.1 TopBar */}
          <div className="z-40">
            <TopBar
              lang={lang}
              workflowName={workflowProperties.name}
              isActive={urlRunbookId ? workflowProperties.isActive : undefined}
              onResolveConflict={() => {
                const overwrite = window.confirm(
                  lang === 'en'
                    ? 'Someone else saved this runbook after you opened it.\n\nOK: overwrite it with your version.\nCancel: reload the saved version (your unsaved edits are lost).'
                    : 'Alguien más guardó este runbook después de que lo abriste.\n\nAceptar: sobrescribirlo con tu versión.\nCancelar: recargar la versión guardada (se pierden tus cambios sin guardar).'
                );
                if (overwrite) void forceOverwrite();
                else window.location.reload();
              }}
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
              hasFailedNode={failedNode !== null}
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
                const slug = (workflowProperties.name || 'runbook')
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
                          ? 'Invalid runbook file: must contain "nodes" and "connections" arrays'
                          : 'Archivo de runbook inválido: debe contener arrays "nodes" y "connections"'
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
                          ? 'Invalid runbook file: nodes must have id, type, and position'
                          : 'Archivo de runbook inválido: los nodos deben tener id, type y position'
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
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            role="application"
            aria-label={lang === 'en' ? 'Runbook canvas' : 'Canvas del runbook'}
          >
            <a
              href="#workflow-canvas"
              className="focus:bg-primary focus:ring-primary/70 sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2"
            >
              {lang === 'en' ? 'Skip to runbook canvas' : 'Saltar al lienzo del runbook'}
            </a>

            {loadError && (
              <div
                role="alert"
                className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-red-500/40 bg-red-950/90 px-4 py-2 text-sm text-red-200 shadow-lg"
              >
                {lang === 'en'
                  ? `Could not load this runbook (${loadError}). Changes will not be saved.`
                  : `No se pudo cargar este runbook (${loadError}). Los cambios no se guardarán.`}
              </div>
            )}

            <CanvasRunStatus
              executing={executing}
              hasFailedNode={failedNode !== null}
              startedAt={runStartedAt}
              lang={lang}
            />

            <OnboardingRunHint
              nodeCount={nodes.length}
              isExecuting={executing}
              hasExecution={Boolean(currentExecutionId)}
              lang={lang}
            />

            <PendingHttpStepBanner lang={lang} onImport={handleImportPendingHttpStep} />

            <FirstRunConfetti runCompleted={runJustCompleted} />

            <div id="canvas-instructions" className="sr-only">
              {lang === 'en'
                ? 'Use Tab to navigate between nodes, Arrow keys to move focus, Enter to select, Escape to deselect, Delete to remove selected nodes'
                : 'Use Tab para navegar entre nodos, teclas de flecha para mover el foco, Enter para seleccionar, Escape para deseleccionar, Delete para eliminar nodos seleccionados'}
            </div>

            <FlowCanvas
              nodes={nodes}
              connections={connections}
              nodeTypes={dbNodeTypes}
              zoom={viewport.zoom}
              minZoom={EDITOR_CONFIG.ZOOM.MIN}
              maxZoom={EDITOR_CONFIG.ZOOM.MAX}
              selectedNodes={selectedNodes}
              selectedConnection={selectedConnection}
              highlightedNodes={highlightedNodes}
              focusedNodeIndex={focusedNodeIndex}
              cyclicConnections={cyclicConnections}
              nodeStatuses={nodeStatuses}
              nodeMeta={nodeMeta}
              editorMode={tool === 'draw' ? 'connect' : 'move'}
              snapToGrid={snapToGrid}
              snapGridPx={SNAP_GRID_PX}
              connectionRadius={EDITOR_CONFIG.GRID.SNAP_RADIUS}
              ariaLabel={lang === 'en' ? 'Runbook canvas' : 'Canvas del runbook'}
              onMove={syncViewport}
              onNodesChange={handleFlowNodesChange}
              onEdgesChange={handleFlowEdgesChange}
              onNodeDragStart={handleFlowNodeDragStart}
              onNodeDragStop={handleFlowNodeDragStop}
              onConnect={handleFlowConnect}
              onConnectionSelect={handleConnectionSelect}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={setConfigNodeId}
              onNodeUpdate={handleNodeUpdate}
              onPaneClick={handlePaneClick}
              onContextMenu={handleContextMenu}
            />

            <EditorOverlays
              nodes={nodes}
              connections={connections}
              viewport={viewport}
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
              onOpenNodeSearch={() => setSearchTrigger(Date.now())}
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
                    aria-label={lang === 'en' ? 'Close terminal' : 'Cerrar terminal'}
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
              failedNode={failedNode}
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
