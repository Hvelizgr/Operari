'use client';

import { AlertCircle } from 'lucide-react';

import type {
  ContextMenuState,
  DeleteConfirmState,
  DeleteConnectionConfirmState,
  ExecutionMetric,
  ViewportState,
} from '../../types/editor.types';
import {
  ConfirmDialog,
  ContextMenu,
  EmptyStateMessage,
  Onboarding,
  ONBOARDING_STEPS_EN,
  ONBOARDING_STEPS_ES,
} from '../Common';
import { MetricsDashboard } from '../Dashboard';
import { MiniMap, SearchBar, ZoomControls } from '../Navigation';
import type { NodeType } from '../Node';
import { TemplateGallery } from '../Workflow';
import type { Connection, WorkflowNode } from './';
import PropertiesPanel from './PropertiesPanel';

interface EditorOverlaysProps {
  nodes: WorkflowNode[];
  connections: Connection[];
  viewport: ViewportState;
  windowSize: { width: number; height: number };
  dbNodeTypes: NodeType[];
  executionMetrics: ExecutionMetric[];
  cycleError: string | null;
  deleteConfirm: DeleteConfirmState;
  deleteConnectionConfirm: DeleteConnectionConfirmState;
  contextMenu: ContextMenuState | null;
  configNodeId: string | null;
  showOnboarding: boolean;
  onboardingStep: number;
  lang: 'en' | 'es';
  selectedNodesCount: number;

  // Actions
  onLoadWorkflow: (nodes: WorkflowNode[], connections: Connection[]) => void;
  onSelectTemplate: (nodes: WorkflowNode[], connections: Connection[]) => void;
  onViewportChange: (viewport: ViewportState) => void;
  onNodeAdd: (type: NodeType) => void;
  onHighlightNodes: (ids: string[]) => void;
  onSearchNodeSelect: (nodeId: string) => void;

  // Onboarding
  onOnboardingNext: () => void;
  onOnboardingSkip: () => void;
  onOnboardingClose: () => void;

  // Dialogs
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDeleteConnectionConfirm: () => void;
  onDeleteConnectionCancel: () => void;

  // Node Config
  onConfigUpdate: (nodeId: string, config: any) => void;
  onConfigClose: () => void;

  // Context Menu
  onContextMenuClose: () => void;
  onContextMenuDuplicate: () => void;
  onContextMenuDelete: () => void;
  onContextMenuToggleEnable: () => void;
  onContextMenuTestFromNode: () => void;
  onContextMenuDetachConnections?: () => void;

  // Additional Context Menu Actions
  onUndo?: () => void;
  onRedo?: () => void;
  onHistory?: () => void;
  onShortcuts?: () => void;
  onSetModeMove?: () => void;
  onSetModeDraw?: () => void;
  onClearAll?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Zoom
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetZoom: () => void;

  // External Triggers
  searchTrigger?: number;

  // Template Gallery Control
  isTemplateGalleryOpen?: boolean;
  onTemplateGalleryOpenChange?: (open: boolean) => void;

  // Metrics Dashboard Control
  isMetricsDashboardOpen?: boolean;
  onMetricsDashboardOpenChange?: (open: boolean) => void;
}

export default function EditorOverlays({
  nodes,
  connections,
  viewport,
  windowSize,
  dbNodeTypes,
  executionMetrics,
  cycleError,
  deleteConfirm,
  deleteConnectionConfirm,
  contextMenu,
  configNodeId,
  showOnboarding,
  onboardingStep,
  lang,
  selectedNodesCount,
  onLoadWorkflow,
  onSelectTemplate,
  onViewportChange,
  onNodeAdd,
  onHighlightNodes,
  onSearchNodeSelect,
  onOnboardingNext,
  onOnboardingSkip,
  onOnboardingClose,
  onDeleteConfirm,
  onDeleteCancel,
  onDeleteConnectionConfirm,
  onDeleteConnectionCancel,
  onConfigUpdate,
  onConfigClose,
  onContextMenuClose,
  onContextMenuDuplicate,
  onContextMenuDelete,
  onContextMenuToggleEnable,
  onContextMenuTestFromNode,
  onContextMenuDetachConnections,
  onUndo,
  onRedo,
  onHistory,
  onShortcuts,
  onSetModeMove,
  onSetModeDraw,
  onClearAll,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetZoom,
  searchTrigger,
  isTemplateGalleryOpen,
  onTemplateGalleryOpenChange,
  isMetricsDashboardOpen,
  onMetricsDashboardOpenChange,
}: EditorOverlaysProps & { selectedNodesCount: number }) {
  const configNode = configNodeId ? nodes.find(n => n.id === configNodeId) : null;

  return (
    <>
      {/* ... other elements ... */}
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-slate-800/80 px-3 py-2 font-mono text-xs text-slate-300 backdrop-blur-sm">
        Zoom: {Math.round(viewport.zoom * 100)}% | Pan: ({Math.round(viewport.x)},{' '}
        {Math.round(viewport.y)}) | Nodes: {nodes.length} | Selected: {selectedNodesCount}
      </div>

      {/* ... other elements ... */}
      {/* SearchBar gets searchTrigger */}

      {/* ALERT: Recreating JSX context to match replace */}
      {cycleError && (
        <div className="absolute left-1/2 top-20 z-50 flex -translate-x-1/2 transform items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-white shadow-lg backdrop-blur-sm">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{cycleError}</span>
        </div>
      )}

      {nodes.length === 0 && <EmptyStateMessage lang={lang} />}

      <TemplateGallery
        onSelectTemplate={onSelectTemplate}
        lang={lang}
        isOpen={isTemplateGalleryOpen}
        onOpenChange={onTemplateGalleryOpenChange}
      />

      <MiniMap
        nodes={nodes}
        viewport={viewport}
        canvasSize={windowSize}
        onViewportChange={(x, y) => onViewportChange({ ...viewport, x, y })}
        lang={lang}
      />

      <SearchBar
        nodes={nodes}
        onNodeSelect={onSearchNodeSelect}
        onNodeAdd={onNodeAdd}
        onHighlightNodes={onHighlightNodes}
        lang={lang}
        availableNodeTypes={dbNodeTypes}
        externalTrigger={searchTrigger}
      />

      <MetricsDashboard
        metrics={executionMetrics}
        lang={lang}
        isOpen={isMetricsDashboardOpen}
        onOpenChange={onMetricsDashboardOpenChange}
      />

      {showOnboarding && (
        <Onboarding
          currentStep={onboardingStep}
          steps={lang === 'es' ? ONBOARDING_STEPS_ES : ONBOARDING_STEPS_EN}
          onNext={onOnboardingNext}
          onSkip={onOnboardingSkip}
          onClose={onOnboardingClose}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title={
          lang === 'en'
            ? 'Delete Node' + (deleteConfirm.nodeIds.length > 1 ? 's' : '')
            : 'Eliminar Nodo' + (deleteConfirm.nodeIds.length > 1 ? 's' : '')
        }
        message={
          lang === 'en'
            ? `Are you sure you want to delete ${deleteConfirm.nodeIds.length} node${deleteConfirm.nodeIds.length > 1 ? 's' : ''}? All connected edges will also be removed.`
            : `¿Estás seguro de que quieres eliminar ${deleteConfirm.nodeIds.length} nodo${deleteConfirm.nodeIds.length > 1 ? 's' : ''}? Todas las conexiones también se eliminarán.`
        }
        confirmLabel={lang === 'en' ? 'Delete' : 'Eliminar'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Cancelar'}
        onConfirm={onDeleteConfirm}
        onCancel={onDeleteCancel}
      />

      <ConfirmDialog
        isOpen={deleteConnectionConfirm.open}
        title={lang === 'en' ? 'Delete Connection' : 'Eliminar Conexión'}
        message={
          lang === 'en'
            ? 'Are you sure you want to delete this connection?'
            : '¿Estás seguro de que quieres eliminar esta conexión?'
        }
        confirmLabel={lang === 'en' ? 'Delete' : 'Eliminar'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Cancelar'}
        onConfirm={onDeleteConnectionConfirm}
        onCancel={onDeleteConnectionCancel}
      />

      {configNode && (
        <PropertiesPanel
          node={configNode}
          nodeTypeDefinition={dbNodeTypes.find(t => t.type === configNode.type)}
          onUpdate={onConfigUpdate}
          onClose={onConfigClose}
          lang={lang}
          nodes={nodes}
          connections={connections}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={onContextMenuClose}
          onDuplicate={onContextMenuDuplicate}
          onDelete={onContextMenuDelete}
          onToggleEnable={onContextMenuToggleEnable}
          onTestFromNode={onContextMenuTestFromNode}
          lang={lang}
          type={contextMenu.type}
          onAddNode={() => {
            onContextMenuClose(); /* trigger search */
          }}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFitView={onFitView}
          onUndo={onUndo}
          onRedo={onRedo}
          onHistory={onHistory}
          onShortcuts={onShortcuts}
          onDetachConnections={onContextMenuDetachConnections}
          onSetModeMove={onSetModeMove}
          onSetModeDraw={onSetModeDraw}
          onClearAll={onClearAll}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      )}

      <ZoomControls
        zoom={viewport.zoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitView={onFitView}
        onResetZoom={onResetZoom}
        lang={lang}
      />
    </>
  );
}
