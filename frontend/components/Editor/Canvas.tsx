'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useAutoParent } from '@/hooks/v2/useAutoParent';
import { useAutosaveV2 } from '@/hooks/v2/useAutosaveV2';
import { useCycleDetection } from '@/hooks/v2/useCycleDetection';
import { useEditorKeyboardV2 } from '@/hooks/v2/useEditorKeyboardV2';
import { useExecutionSocketV2 } from '@/hooks/v2/useExecutionSocketV2';
import { useIsValidConnection } from '@/hooks/v2/useIsValidConnection';
import { useLoadRunbookV2 } from '@/hooks/v2/useLoadRunbookV2';
import type { RfEdge, RfNode } from '@/lib/canvas/v2/adapter';
import { useEditorStoreV2 } from '@/state/editorStoreV2';

import { defaultConfigForType, NODE_CATALOG } from './catalog';
import { dragChannel } from './dragChannel';
import { ConnectionLine } from './edges/ConnectionLine';
import { EdgeContextMenu } from './edges/EdgeContextMenu';
import { DEFAULT_EDGE_TYPE, edgeTypes } from './edgeTypes';
import InspectorV2 from './InspectorV2';
import { nodeTypes } from './nodeTypes';
import PaletteV2 from './PaletteV2';
import ZoomToRunning from './ZoomToRunning';

function StatusPill({ lang }: { lang: 'en' | 'es' }) {
  const status = useEditorStoreV2(s => s.status);
  const errorMessage = useEditorStoreV2(s => s.errorMessage);
  const labels = {
    en: {
      idle: 'Editor V2',
      loading: 'Loading…',
      dirty: 'Unsaved changes',
      saving: 'Saving…',
      saved: 'Saved',
      error: errorMessage ?? 'Error',
      conflict: errorMessage ?? 'Conflict — refresh',
    },
    es: {
      idle: 'Editor V2',
      loading: 'Cargando…',
      dirty: 'Cambios sin guardar',
      saving: 'Guardando…',
      saved: 'Guardado',
      error: errorMessage ?? 'Error',
      conflict: errorMessage ?? 'Conflicto — recargá',
    },
  } as const;
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
      {labels[lang][status]}
    </div>
  );
}

const DEFAULT_EDGE_OPTIONS = { type: DEFAULT_EDGE_TYPE } as const;

function CanvasV2Inner({ lang }: { lang: 'en' | 'es' }) {
  const params = useSearchParams();
  const runbookId = params.get('id');
  const executionId = params.get('run');

  const nodes = useEditorStoreV2(s => s.nodes);
  const edges = useEditorStoreV2(s => s.edges);
  const onNodesChange = useEditorStoreV2(s => s.onNodesChange);
  const onEdgesChange = useEditorStoreV2(s => s.onEdgesChange);
  const onConnect = useEditorStoreV2(s => s.onConnect);
  const addNode = useEditorStoreV2(s => s.addNode);
  const removeNodes = useEditorStoreV2(s => s.removeNodes);

  const { screenToFlowPosition } = useReactFlow<RfNode, RfEdge>();
  const isValidConnection = useIsValidConnection();
  const { theme } = useTheme();
  const colorMode = theme === 'light' ? 'light' : 'dark';
  const reparentOnDragStop = useAutoParent();

  // One drag = one undo entry. Pause history capture during the drag,
  // run the auto-parent rebase on stop, then resume so the diff between
  // pre-drag and post-drag becomes a single zundo entry.
  const handleNodeDragStart = useCallback(() => {
    useEditorStoreV2.temporal.getState().pause();
  }, []);
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent | React.TouchEvent, node: RfNode) => {
      reparentOnDragStop(event, node);
      useEditorStoreV2.temporal.getState().resume();
    },
    [reparentOnDragStop]
  );

  useLoadRunbookV2(runbookId);
  useAutosaveV2();
  useCycleDetection();
  useEditorKeyboardV2();
  useExecutionSocketV2(executionId);

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
      <PaletteV2 lang={lang} />
      <StatusPill lang={lang} />
      <ZoomToRunning lang={lang} />
      <ReactFlow<RfNode, RfEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        connectionLineComponent={ConnectionLine}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        onEdgeContextMenu={handleEdgeContextMenu}
        isValidConnection={isValidConnection}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        selectionOnDrag
        panOnDrag={[1, 2]}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {edgeMenu ? (
        <EdgeContextMenu
          edgeId={edgeMenu.edgeId}
          position={edgeMenu.position}
          lang={lang}
          onClose={() => setEdgeMenu(null)}
        />
      ) : null}
      <InspectorV2 lang={lang} />
    </div>
  );
}

export default function CanvasV2({ lang }: { lang: 'en' | 'es' }) {
  return (
    <ReactFlowProvider>
      <CanvasV2Inner lang={lang} />
    </ReactFlowProvider>
  );
}
