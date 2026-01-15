'use client';

import { useEditorCanvas } from '../../hooks/useEditorCanvas';
import { ConnectionsLayer, NodesLayer, GridLayer, EditorOverlays, EditorToolbar } from './';
import { useAccessibility } from '../../context/AccessibilityContext';

export default function EditorCanvas({ lang }: { lang: 'en' | 'es' }) {
    const {
        // Refs
        canvasRef,
        windowSize,

        // State
        nodes,
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
        handleDuplicateNode,
        handleContextMenuDuplicate,
        handleDeleteFromContextMenu,
        handleNodeClick,
        handleNodeMove,
        handleNodeUpdate,
        handleCloseConfigPanel,
        handleHighlightNodes,
        handleConnectionSelect,
        handleConfirmDelete,
        handleCancelDelete,
        handleConfirmDeleteConnection,
        handleCancelDeleteConnection,
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
    } = useEditorCanvas({ lang });

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
                    onConnectionClick={handleConnectionSelect}
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
                    onNodeClick={handleNodeClick}
                    onNodeMove={handleNodeMove}
                />

                {/* Selection Box */}
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
                    onDeleteConnectionConfirm={handleConfirmDeleteConnection}
                    onDeleteConnectionCancel={handleCancelDeleteConnection}
                    onConfigUpdate={handleNodeUpdate}
                    onConfigClose={handleCloseConfigPanel}
                    onContextMenuClose={handleCloseContextMenu}
                    onContextMenuDuplicate={handleContextMenuDuplicate}
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
