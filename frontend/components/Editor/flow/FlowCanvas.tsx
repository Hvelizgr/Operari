'use client';

import '@xyflow/react/dist/style.css';
import './flow.css';

import type { Connection, WorkflowNode } from '@operari/shared';
import {
  type Connection as FlowConnection,
  ConnectionLineType,
  type EdgeChange,
  MarkerType,
  type NodeChange,
  type OnNodeDrag,
  ReactFlow,
  type Viewport,
} from '@xyflow/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useTheme } from '../../../context/ThemeContext';
import type { NodeMeta } from '../../../hooks/useExecutionSocket';
import type { NodeTypeRegistry } from '../../../lib/canvas/node-type-registry';
import type { ViewportState } from '../../../types/editor.types';
import type { NodeType } from '../../Node';
import {
  type ConditionFlowEdge,
  EdgeAppearanceContext,
  edgeStroke,
  flowEdgeTypes,
} from './ConditionEdge';
import FlowBackground from './FlowBackground';
import { flowNodeTypes, type OperariFlowNode, type StepStatus } from './flowNodes';
import { useCanvasAppearance } from './useCanvasAppearance';

const DEFAULT_NODE_SIZE = { w: 260, h: 90 };

const UPSTREAM_PRECEDENCE: Record<string, number> = {
  RUNNING: 5,
  FAILED: 4,
  SUCCESS: 3,
  PAUSED: 2,
  CANCELLED: 1,
  SKIPPED: 1,
};

interface FlowCanvasProps {
  nodes: WorkflowNode[];
  connections: Connection[];
  nodeTypes: NodeType[];
  registry?: NodeTypeRegistry;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  selectedNodes: Set<string>;
  selectedConnection: string | null;
  highlightedNodes: string[];
  focusedNodeIndex: number;
  cyclicConnections: string[];
  nodeStatuses?: Record<string, StepStatus>;
  nodeMeta?: Record<string, NodeMeta>;
  editorMode: 'move' | 'connect';
  snapToGrid: boolean;
  snapGridPx: number;
  connectionRadius: number;
  ariaLabel: string;
  onMove: (viewport: ViewportState) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeDragStart: () => void;
  onNodeDragStop: (draggedIds: string[]) => void;
  onConnect: (source: string, target: string, sourcePort: number) => void;
  onConnectionSelect: (connectionId: string) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onPaneClick: () => void;
  onContextMenu: (e: React.MouseEvent, type: 'node' | 'canvas', nodeId?: string) => void;
}

function parseSourcePort(handleId: string | null | undefined): number {
  const m = /^out-(\d+)$/.exec(handleId ?? '');
  return m ? parseInt(m[1], 10) : 0;
}

function FlowCanvas({
  nodes,
  connections,
  nodeTypes,
  registry,
  zoom,
  minZoom,
  maxZoom,
  selectedNodes,
  selectedConnection,
  highlightedNodes,
  focusedNodeIndex,
  cyclicConnections,
  nodeStatuses = {},
  nodeMeta = {},
  editorMode,
  snapToGrid,
  snapGridPx,
  connectionRadius,
  ariaLabel,
  onMove,
  onNodesChange,
  onEdgesChange,
  onNodeDragStart,
  onNodeDragStop,
  onConnect,
  onConnectionSelect,
  onNodeClick,
  onNodeDoubleClick,
  onNodeUpdate,
  onPaneClick,
  onContextMenu,
}: FlowCanvasProps) {
  const appearance = useCanvasAppearance();
  const { theme } = useTheme();

  // React Flow 12 reads `measured` off the controlled nodes; without
  // it every re-derived node counts as uninitialized while dragging.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const sizes = changes.flatMap(c =>
        c.type === 'dimensions' && c.dimensions ? [[c.id, c.dimensions] as const] : []
      );
      if (sizes.length > 0) setMeasured(prev => ({ ...prev, ...Object.fromEntries(sizes) }));
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const flowNodes = useMemo<OperariFlowNode[]>(() => {
    const connected = new Set<string>();
    const nextInPath = new Set<string>();
    const upstreamByTarget: Record<string, StepStatus> = {};
    for (const conn of connections) {
      connected.add(conn.source);
      connected.add(conn.target);
      const s = nodeStatuses[conn.source];
      if (!s) continue;
      if (s === 'RUNNING') nextInPath.add(conn.target);
      const prev = upstreamByTarget[conn.target];
      if (!prev || (UPSTREAM_PRECEDENCE[s] ?? 0) > (UPSTREAM_PRECEDENCE[prev] ?? 0)) {
        upstreamByTarget[conn.target] = s;
      }
    }

    const frames = nodes.filter(n => n.type === 'custom.frame');
    const containedCount = (frame: WorkflowNode) => {
      const cfg = (frame.config ?? {}) as { width?: number; height?: number };
      const fx2 = frame.position.x + (cfg.width ?? 400);
      const fy2 = frame.position.y + (cfg.height ?? 300);
      let c = 0;
      for (const n of nodes) {
        if (n.type === 'custom.frame' || n.type === 'custom.note') continue;
        const cx = n.position.x + DEFAULT_NODE_SIZE.w / 2;
        const cy = n.position.y + DEFAULT_NODE_SIZE.h / 2;
        if (cx >= frame.position.x && cx <= fx2 && cy >= frame.position.y && cy <= fy2) c++;
      }
      return c;
    };

    const focusedId = focusedNodeIndex >= 0 ? nodes[focusedNodeIndex]?.id : undefined;

    return nodes.map((node): OperariFlowNode => {
      const base = {
        id: node.id,
        position: node.position,
        selected: selectedNodes.has(node.id),
        measured: measured[node.id],
      };
      if (node.type === 'custom.frame') {
        const cfg = (node.config ?? {}) as { width?: number; height?: number };
        return {
          ...base,
          type: 'frame',
          width: cfg.width || 400,
          height: cfg.height || 300,
          zIndex: -1,
          dragHandle: '.frame-title-bar',
          data: {
            node,
            containedCount: frames.length ? containedCount(node) : 0,
            onUpdate: onNodeUpdate,
          },
        };
      }
      if (node.type === 'custom.note') {
        return { ...base, type: 'note', data: { node, onUpdate: onNodeUpdate } };
      }
      const status = nodeStatuses[node.id];
      return {
        ...base,
        type: 'step',
        data: {
          node,
          typeDefinition: nodeTypes.find(t => t.type === node.type),
          registry,
          isConnected: connected.has(node.id),
          isHighlighted: highlightedNodes.includes(node.id) || focusedId === node.id,
          status,
          durationMs: nodeMeta[node.id]?.durationMs ?? null,
          isNextInPath: nextInPath.has(node.id) && !status,
          upstreamStatus: upstreamByTarget[node.id] ?? null,
        },
      };
    });
  }, [
    nodes,
    connections,
    nodeTypes,
    registry,
    selectedNodes,
    highlightedNodes,
    focusedNodeIndex,
    nodeStatuses,
    nodeMeta,
    onNodeUpdate,
    measured,
  ]);

  const cyclic = useMemo(() => new Set(cyclicConnections), [cyclicConnections]);

  const flowEdges = useMemo<ConditionFlowEdge[]>(() => {
    const prefs = appearance?.edges;
    const arrow = (conn: Connection) =>
      prefs?.edgeArrowEnabled
        ? {
            type: MarkerType.ArrowClosed,
            width: prefs.edgeArrowSize,
            height: prefs.edgeArrowSize,
            color: edgeStroke(prefs, cyclic.has(conn.id), nodeStatuses[conn.source]),
          }
        : undefined;
    return connections.map(conn => ({
      id: conn.id,
      type: 'condition',
      source: conn.source,
      target: conn.target,
      sourceHandle: `out-${conn.sourcePort ?? 0}`,
      targetHandle: `in-${conn.targetPort ?? 0}`,
      selected: selectedConnection === conn.id,
      markerEnd: arrow(conn),
      data: {
        condition: conn.condition ?? 'complete',
        isCyclic: cyclic.has(conn.id),
        sourceStatus: nodeStatuses[conn.source],
        onSelect: onConnectionSelect,
      },
    }));
  }, [appearance, connections, selectedConnection, cyclic, nodeStatuses, onConnectionSelect]);

  const handleConnect = useCallback(
    (c: FlowConnection) => onConnect(c.source, c.target, parseSourcePort(c.sourceHandle)),
    [onConnect]
  );

  const isValidConnection = useCallback(
    (c: FlowConnection | ConditionFlowEdge) => c.source !== c.target,
    []
  );

  const handleDragStop = useCallback<OnNodeDrag<OperariFlowNode>>(
    (_e, _node, dragged) => onNodeDragStop(dragged.map(n => n.id)),
    [onNodeDragStop]
  );

  const handleMove = useCallback(
    (_e: MouseEvent | TouchEvent | null, vp: Viewport) =>
      onMove({ x: vp.x, y: vp.y, zoom: vp.zoom }),
    [onMove]
  );

  const isMove = editorMode === 'move';
  const zoomClass = zoom < 0.3 ? 'wf_mini_mode wf_nano_mode' : zoom < 0.6 ? 'wf_mini_mode' : '';

  return (
    <EdgeAppearanceContext.Provider value={appearance}>
      <ReactFlow<OperariFlowNode, ConditionFlowEdge>
        className={`wf_flow ${zoomClass}`}
        aria-label={ariaLabel}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={flowNodeTypes}
        edgeTypes={flowEdgeTypes}
        onMove={handleMove}
        colorMode={theme === 'light' ? 'light' : 'dark'}
        minZoom={minZoom}
        maxZoom={maxZoom}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={handleDragStop}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onEdgeClick={(_e, edge) => onConnectionSelect(edge.id)}
        onNodeClick={(_e, node) => onNodeClick(node.id)}
        onNodeDoubleClick={(_e, node) => onNodeDoubleClick(node.id)}
        onNodeContextMenu={(e, node) => onContextMenu(e, 'node', node.id)}
        onPaneContextMenu={e => onContextMenu(e as ReactMouseEvent, 'canvas')}
        onPaneClick={onPaneClick}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: 'var(--theme-color, #3ecf8e)', strokeWidth: 2 }}
        nodesDraggable={isMove}
        panOnDrag={isMove ? true : [1, 2]}
        selectionOnDrag={!isMove}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        deleteKeyCode={null}
        disableKeyboardA11y
        snapToGrid={snapToGrid}
        snapGrid={[snapGridPx, snapGridPx]}
        connectionRadius={connectionRadius}
        proOptions={{ hideAttribution: true }}
      >
        {appearance && <FlowBackground background={appearance.background} />}
      </ReactFlow>
    </EdgeAppearanceContext.Provider>
  );
}

export default memo(FlowCanvas);
