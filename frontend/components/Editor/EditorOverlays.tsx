'use client';

import { AlertCircle } from 'lucide-react';
import { Onboarding, ONBOARDING_STEPS_EN, ONBOARDING_STEPS_ES, EmptyStateMessage, ConfirmDialog, ContextMenu } from '../Common';
import { WorkflowRunner, SaveLoadMenu, TemplateGallery } from '../Workflow';
import { NodeConfigPanel } from '../Node';
import { MiniMap, SearchBar, ZoomControls } from '../Navigation';
import { MetricsDashboard } from '../Dashboard';
import type { NodeType } from '../Node';
import type { WorkflowNode, Connection } from './';
import type { ViewportState, DeleteConfirmState, DeleteConnectionConfirmState, ContextMenuState, ExecutionMetric } from '../../types/editor.types';

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
    onExecutionStateChange: (updatedNodes: WorkflowNode[]) => void;

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

    // Zoom
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onResetZoom: () => void;
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
    onExecutionStateChange,
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
    onZoomIn,
    onZoomOut,
    onFitView,
    onResetZoom,
}: EditorOverlaysProps & { selectedNodesCount: number }) {
    const configNode = configNodeId ? nodes.find(n => n.id === configNodeId) : null;

    return (
        <>
            <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-slate-300 font-mono pointer-events-none">
                Zoom: {Math.round(viewport.zoom * 100)}% | Pan: ({Math.round(viewport.x)}, {Math.round(viewport.y)}) | Nodes: {nodes.length} | Selected: {selectedNodesCount}
            </div>

            {cycleError && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span className="text-sm font-medium">{cycleError}</span>
                </div>
            )}

            {nodes.length === 0 && <EmptyStateMessage lang={lang} />}

            <SaveLoadMenu
                nodes={nodes}
                connections={connections}
                onLoad={onLoadWorkflow}
                lang={lang}
            />

            <TemplateGallery
                onSelectTemplate={onSelectTemplate}
                lang={lang}
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
            />

            <MetricsDashboard
                metrics={executionMetrics}
                lang={lang}
            />

            <WorkflowRunner
                nodes={nodes}
                connections={connections}
                onExecutionStateChange={onExecutionStateChange}
                lang={lang}
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
                title={lang === 'en' ? 'Delete Node' + (deleteConfirm.nodeIds.length > 1 ? 's' : '') : 'Eliminar Nodo' + (deleteConfirm.nodeIds.length > 1 ? 's' : '')}
                message={lang === 'en'
                    ? `Are you sure you want to delete ${deleteConfirm.nodeIds.length} node${deleteConfirm.nodeIds.length > 1 ? 's' : ''}? All connected edges will also be removed.`
                    : `¿Estás seguro de que quieres eliminar ${deleteConfirm.nodeIds.length} nodo${deleteConfirm.nodeIds.length > 1 ? 's' : ''}? Todas las conexiones también se eliminarán.`}
                confirmLabel={lang === 'en' ? 'Delete' : 'Eliminar'}
                cancelLabel={lang === 'en' ? 'Cancel' : 'Cancelar'}
                onConfirm={onDeleteConfirm}
                onCancel={onDeleteCancel}
            />

            <ConfirmDialog
                isOpen={deleteConnectionConfirm.open}
                title={lang === 'en' ? 'Delete Connection' : 'Eliminar Conexión'}
                message={lang === 'en'
                    ? 'Are you sure you want to delete this connection?'
                    : '¿Estás seguro de que quieres eliminar esta conexión?'}
                confirmLabel={lang === 'en' ? 'Delete' : 'Eliminar'}
                cancelLabel={lang === 'en' ? 'Cancel' : 'Cancelar'}
                onConfirm={onDeleteConnectionConfirm}
                onCancel={onDeleteConnectionCancel}
            />

            {configNode && (
                <NodeConfigPanel
                    node={configNode}
                    nodeTypeDefinition={dbNodeTypes.find(t => t.type === configNode.type)}
                    onUpdate={onConfigUpdate}
                    onClose={onConfigClose}
                    lang={lang}
                />
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={onContextMenuClose}
                    onDuplicate={onContextMenuDuplicate}
                    onDelete={onContextMenuDelete}
                    lang={lang}
                    type={contextMenu.type}
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
