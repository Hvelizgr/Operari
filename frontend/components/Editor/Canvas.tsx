'use client';

import {
  Background,
  BackgroundVariant,
  type Connection as RfConnection,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useAutoParent } from '@/hooks/useAutoParent';
import { useAutosave } from '@/hooks/useAutosave';
import { useCycleDetection } from '@/hooks/useCycleDetection';
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard';
import { useExecutionSocket } from '@/hooks/useExecutionSocket';
import { useIsValidConnection } from '@/hooks/useIsValidConnection';
import { useLoadRunbook } from '@/hooks/useLoadRunbook';
import { useViewportPersistence } from '@/hooks/useViewportPersistence';
import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { defaultConfigForType, NODE_CATALOG } from './canvas/catalog';
import { dragChannel } from './canvas/dragChannel';
import { ConnectionLine } from './canvas/edges/ConnectionLine';
import { EdgeContextMenu } from './canvas/edges/EdgeContextMenu';
import {
  DEFAULT_EDGE_TYPE,
  edgeTypes,
  type LineStyle,
  readLineStyle,
  writeLineStyle,
} from './canvas/edgeTypes';
import AlignmentGuides from './AlignmentGuides';
import Inspector from './Inspector';
import { nodeTypes } from './canvas/nodeTypes';
import Palette from './Palette';
import SearchPalette from './SearchPalette';
import SelectionStatusPill from './SelectionStatusPill';
import Toolbar from './Toolbar';
import UndoRedoPanel from './UndoRedoPanel';
import ZoomToRunning from './ZoomToRunning';

// MiniMap colors mirror the in-canvas status palette so the operator
// scanning a 100-step runbook can see at a glance which steps are
// running / failed / skipped without reading every node.
const MINIMAP_COLOR = (node: RfNode): string => {
  const status = node.data?.status ?? 'idle';
  if (node.type === 'custom.frame') return 'rgba(14, 165, 233, 0.4)';
  if (node.type === 'custom.note') return 'rgba(245, 158, 11, 0.4)';
  switch (status) {
    case 'running':
      return 'var(--op-gold)';
    case 'success':
      return 'var(--op-moss)';
    case 'failed':
      return 'var(--op-sunset)';
    case 'skipped':
      return 'var(--op-fog)';
    default:
      return 'var(--op-stone)';
  }
};

function CanvasInner({ lang }: { lang: 'en' | 'es' }) {
  const params = useSearchParams();
  const runbookId = params.get('id');
  const executionId = params.get('run');
  // Read-only embed mode: dashboards / Slack snapshots load with
  // ?embed=1 and never get edit chrome. Single boolean drives chrome
  // visibility + RF interaction props so the contract is one read.
  const embedMode = params.get('embed') === '1';

  // Line style preference (curved vs orthogonal). Persisted in
  // localStorage because it's a "how I like to read graphs" preference,
  // not a property of the runbook.
  const [lineStyle, setLineStyle] = useState<LineStyle>(DEFAULT_EDGE_TYPE);
  useEffect(() => {
    setLineStyle(readLineStyle());
  }, []);
  const toggleLineStyle = useCallback(() => {
    setLineStyle(prev => {
      const next: LineStyle = prev === 'smart' ? 'step' : 'smart';
      writeLineStyle(next);
      return next;
    });
  }, []);
  const defaultEdgeOptions = useMemo(() => ({ type: lineStyle }), [lineStyle]);

  const nodes = useEditorStore(s => s.nodes);
  const storedEdges = useEditorStore(s => s.edges);
  // Resolve the per-edge effective type: a per-edge `data.lineStyle`
  // override wins, otherwise the global preference applies. The
  // persisted shape always says `smart`; rendering is a presentation
  // concern, so the toggle (and any per-edge override) applies
  // retroactively to existing edges.
  const edges = useMemo(
    () =>
      storedEdges.map(e => {
        const effective = e.data?.lineStyle ?? lineStyle;
        return e.type === effective ? e : { ...e, type: effective };
      }),
    [storedEdges, lineStyle]
  );
  const onNodesChange = useEditorStore(s => s.onNodesChange);
  const onEdgesChange = useEditorStore(s => s.onEdgesChange);
  const onConnect = useEditorStore(s => s.onConnect);
  const reconnectEdgeAction = useEditorStore(s => s.reconnectEdge);
  const addNode = useEditorStore(s => s.addNode);
  const removeNodes = useEditorStore(s => s.removeNodes);

  const { screenToFlowPosition } = useReactFlow<RfNode, RfEdge>();
  const isValidConnection = useIsValidConnection();
  const { theme } = useTheme();
  const colorMode = theme === 'light' ? 'light' : 'dark';
  const autoParent = useAutoParent();

  // One drag = one undo entry. Pause history capture during the drag,
  // run the auto-parent rebase on stop, then resume so the diff between
  // pre-drag and post-drag becomes a single zundo entry.
  const handleNodeDragStart = useCallback(() => {
    useEditorStore.temporal.getState().pause();
  }, []);
  const handleNodeDrag = useCallback(
    (event: React.MouseEvent | React.TouchEvent, node: RfNode) => {
      autoParent.onDrag(event, node);
    },
    [autoParent]
  );
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent | React.TouchEvent, node: RfNode) => {
      autoParent.onDragStop(event, node);
      useEditorStore.temporal.getState().resume();
    },
    [autoParent]
  );

  useLoadRunbook(runbookId);
  useAutosave();
  useCycleDetection();
  useEditorKeyboard();
  useExecutionSocket(executionId);
  useViewportPersistence();

  // Reconnect handlers. The success ref guards against `onReconnectEnd`
  // firing after a successful reconnect (would otherwise delete the
  // edge that the user just rerouted). On a drop into empty space the
  // ref stays false and we delete via onEdgesChange.
  const reconnectSuccessful = useRef(true);
  const handleReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false;
  }, []);
  const handleReconnect = useCallback(
    (oldEdge: RfEdge, newConnection: RfConnection) => {
      reconnectSuccessful.current = true;
      reconnectEdgeAction(oldEdge, newConnection);
    },
    [reconnectEdgeAction]
  );
  const handleReconnectEnd = useCallback((_event: unknown, edge: RfEdge) => {
    if (!reconnectSuccessful.current) {
      useEditorStore.getState().onEdgesChange([{ id: edge.id, type: 'remove' }]);
    }
    reconnectSuccessful.current = true;
  }, []);

  const handleNodesDelete = useCallback(
    (deleted: RfNode[]) => {
      // Cascades to descendants for frames; the store handles the walk.
      removeNodes(deleted.map(n => n.id));
    },
    [removeNodes]
  );

  const [edgeMenu, setEdgeMenu] = useState<{
    edgeId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Cmd+K opens the search palette. Bound here (not in
  // useEditorKeyboard) because the open/close state is local to the
  // canvas component. Skip when an input field is focused so the
  // shortcut doesn't fight inline name edits.
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (embedMode) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [embedMode]);

  useEffect(() => {
    if (!edgeMenu) return;
    const close = () => setEdgeMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [edgeMenu]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeMenu({
      edgeId: edge.id,
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = dragChannel.consume();
      if (!type) return;
      const def = NODE_CATALOG.get(type);
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newNode: RfNode = {
        id,
        type,
        position,
        data: {
          workflow: {
            title: def?.label[lang] ?? type,
            enabled: true,
            config: defaultConfigForType(type),
          },
        },
      };
      addNode(newNode);
    },
    [addNode, lang, screenToFlowPosition]
  );

  return (
    <div className="relative h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      {!embedMode ? <Palette lang={lang} /> : null}
      <ReactFlow<RfNode, RfEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineComponent={ConnectionLine}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={handleReconnect}
        onReconnectStart={handleReconnectStart}
        onReconnectEnd={handleReconnectEnd}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        onEdgeContextMenu={embedMode ? undefined : handleEdgeContextMenu}
        isValidConnection={isValidConnection}
        snapToGrid={!embedMode}
        snapGrid={[20, 20]}
        selectionOnDrag={!embedMode}
        panOnDrag={embedMode ? true : [1, 2]}
        panOnScroll={!embedMode}
        panActivationKeyCode="Space"
        multiSelectionKeyCode="Shift"
        deleteKeyCode={embedMode ? null : ['Delete', 'Backspace']}
        connectionRadius={32}
        nodesDraggable={!embedMode}
        nodesConnectable={!embedMode}
        elementsSelectable={!embedMode}
        edgesFocusable={!embedMode}
        nodesFocusable={!embedMode}
        zoomOnDoubleClick={!embedMode}
        // `onlyRenderVisibleElements` measures every node before
        // deciding what's in viewport, so it costs more than it saves
        // for graphs under ~200 nodes. Operari runbooks rarely exceed
        // 50, but flipping this on for huge generated runbooks (e.g.,
        // imported via plugin) is a one-line opt-in.
        onlyRenderVisibleElements={false}
      >
        {/* Layered background: a coarse line grid for orientation and a
            fine dot grid on top so step alignment reads cleanly at any
            zoom level. Both fade against the canvas background via
            color-mix so they never compete with the nodes. */}
        <Background
          id="grid"
          variant={BackgroundVariant.Lines}
          gap={120}
          size={1}
          color="color-mix(in oklab, var(--op-stone) 8%, transparent)"
        />
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="color-mix(in oklab, var(--op-moss) 18%, transparent)"
        />
        {!embedMode ? <UndoRedoPanel lang={lang} /> : null}
        {!embedMode ? <SelectionStatusPill lang={lang} /> : null}
        {!embedMode ? (
          <Toolbar lang={lang} lineStyle={lineStyle} onLineStyleToggle={toggleLineStyle} />
        ) : null}
        {!embedMode ? (
          <SearchPalette lang={lang} open={searchOpen} onClose={() => setSearchOpen(false)} />
        ) : null}
        <ZoomToRunning lang={lang} />
        {!embedMode ? <AlignmentGuides /> : null}
        <Controls showInteractive={!embedMode} />
        <MiniMap pannable zoomable nodeColor={MINIMAP_COLOR} />
      </ReactFlow>
      {edgeMenu && !embedMode ? (
        <EdgeContextMenu
          edgeId={edgeMenu.edgeId}
          position={edgeMenu.position}
          lang={lang}
          onClose={() => setEdgeMenu(null)}
        />
      ) : null}
      {!embedMode ? <Inspector lang={lang} /> : null}
    </div>
  );
}

export default function Canvas({ lang }: { lang: 'en' | 'es' }) {
  return (
    <ReactFlowProvider>
      <CanvasInner lang={lang} />
    </ReactFlowProvider>
  );
}
