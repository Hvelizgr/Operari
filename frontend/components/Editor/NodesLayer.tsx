'use client';

import type { WorkflowNode } from '@nanorun/shared';
import { motion } from 'framer-motion';
import type { MouseEvent } from 'react';
import { memo, useMemo } from 'react';

import type { NodeMeta } from '../../hooks/useExecutionSocket';
import type { NodeTypeRegistry } from '../../lib/canvas/node-type-registry';
import type { ViewportState } from '../../types/editor.types';
import { NodeType } from '../Node';
import EditorNode from './EditorNode';
import FrameNode from './FrameNode';
import NoteNode from './NoteNode';

interface NodesLayerProps {
  /** Pluggable domain registry. Forwarded to each EditorNode. */
  registry?: NodeTypeRegistry;
  nodes: WorkflowNode[];
  connections: { source: string; target: string }[];
  nodeTypes: NodeType[];
  viewport: ViewportState;
  draggingNode: string | null;
  hoveredInputNode: string | null;
  selectedNodes: Set<string>;
  highlightedNodes: string[];
  focusedNodeIndex: number;

  // Handlers
  onNodeDragStart: (nodeId: string, e: MouseEvent) => void;
  onNodeDrag: (e: MouseEvent) => void;
  onNodeDragEnd: () => void;
  onPortDragStart: (
    nodeId: string,
    portId: string,
    type: 'source' | 'target',
    pos: { x: number; y: number }
  ) => void;
  onPortDragEnd: () => void;
  onNodeClick: (id: string) => void;
  onNodeMove: (nodeId: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  editorMode?: 'move' | 'connect';
  nodeStatuses?: Record<
    string,
    'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED'
  >;
  nodeMeta?: Record<string, NodeMeta>;
}

function NodesLayer({
  nodes,
  connections,
  nodeTypes,
  viewport,
  draggingNode,
  hoveredInputNode,
  selectedNodes,
  highlightedNodes,
  focusedNodeIndex,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragEnd,
  onPortDragStart,
  onPortDragEnd,
  onNodeClick,
  onNodeMove,
  onNodeUpdate,
  onNodeDoubleClick,
  editorMode = 'move',
  nodeStatuses = {},
  nodeMeta = {},
  registry,
}: NodesLayerProps) {
  // Sort nodes: frames first (lowest z-index), then notes, then regular nodes
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const getOrder = (type: string) => {
        if (type === 'custom.frame') return 0;
        if (type === 'custom.note') return 1;
        return 2;
      };
      return getOrder(a.type) - getOrder(b.type);
    });
  }, [nodes]);

  // Compute the "next in path" set: every node that is the direct
  // downstream target of a node currently in RUNNING state. The
  // canvas card uses this to paint a tenuous accent glow on the
  // nodes that are about to execute, giving the operator a visual
  // sense of progression beyond a single pulsing border.
  const nextInPath = useMemo(() => {
    const set = new Set<string>();
    for (const conn of connections) {
      if (nodeStatuses[conn.source] === 'RUNNING') {
        set.add(conn.target);
      }
    }
    return set;
  }, [connections, nodeStatuses]);

  // For each frame node, count how many real steps sit inside its
  // bounding rect. O(F * N) where F is frames and N is all nodes;
  // fine for any runbook you can actually author by hand.
  const frameContainedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    const frames = nodes.filter(n => n.type === 'custom.frame');
    if (frames.length === 0) return counts;

    const DEFAULT_NODE_SIZE = { w: 200, h: 90 };
    for (const frame of frames) {
      const fw = (frame.config as { width?: number } | undefined)?.width ?? 400;
      const fh = (frame.config as { height?: number } | undefined)?.height ?? 300;
      const fx1 = frame.position.x;
      const fy1 = frame.position.y;
      const fx2 = fx1 + fw;
      const fy2 = fy1 + fh;
      let c = 0;
      for (const n of nodes) {
        if (n.id === frame.id) continue;
        if (n.type === 'custom.frame' || n.type === 'custom.note') continue;
        const dims = (n as { dimensions?: { width?: number; height?: number } }).dimensions;
        const nx1 = n.position.x;
        const ny1 = n.position.y;
        const nx2 = nx1 + (dims?.width ?? DEFAULT_NODE_SIZE.w);
        const ny2 = ny1 + (dims?.height ?? DEFAULT_NODE_SIZE.h);
        const cx = (nx1 + nx2) / 2;
        const cy = (ny1 + ny2) / 2;
        if (cx >= fx1 && cx <= fx2 && cy >= fy1 && cy <= fy2) c++;
      }
      counts[frame.id] = c;
    }
    return counts;
  }, [nodes]);

  // Map of target-node-id -> status of its most interesting upstream.
  // Precedence: RUNNING > FAILED > SUCCESS > PAUSED > others. Drives
  // the input-pole tint on downstream nodes so the operator sees at a
  // glance which ports have already received data.
  const upstreamStatusByTarget = useMemo(() => {
    const order: Record<string, number> = {
      RUNNING: 5,
      FAILED: 4,
      SUCCESS: 3,
      PAUSED: 2,
      CANCELLED: 1,
      SKIPPED: 1,
    };
    const map: Record<string, NonNullable<(typeof nodeStatuses)[string]>> = {};
    for (const conn of connections) {
      const s = nodeStatuses[conn.source];
      if (!s) continue;
      const prev = map[conn.target];
      if (!prev || (order[s] ?? 0) > (order[prev] ?? 0)) {
        map[conn.target] = s;
      }
    }
    return map;
  }, [connections, nodeStatuses]);

  // Mini mode: when the canvas is zoomed below 60% the cards are
  // too small to read. Collapse the body and show only the icon
  // square + title via a wrapper class — the rest of the card
  // (preview, badges, body) hides via CSS.
  // Nano mode (below 30%): even the title is unreadable, so we
  // shrink each card down to just its category-colored icon square
  // with the type-letter badge preserved. Keeps the graph topology
  // scannable when the user zooms way out.
  const isMiniMode = viewport.zoom < 0.6;
  const isNanoMode = viewport.zoom < 0.3;

  const layerClass =
    'wf_canvas_layer' + (isMiniMode ? ' wf_mini_mode' : '') + (isNanoMode ? ' wf_nano_mode' : '');

  return (
    <motion.div
      className={layerClass}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        // MUST be higher than .wf_canvas (z-index: 1). The
        // `transform` below creates a new stacking context, which
        // isolates the child nodes' own z-index (3, 10 when
        // selected) so they can't win against the sibling
        // canvas. Without an explicit z-index here the whole
        // layer defaults to `auto`, which CSS treats as below
        // any positioned sibling with an explicit z-index —
        // result: connection lines paint OVER the node cards.
        zIndex: 2,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: '0 0',
      }}
    >
      {sortedNodes.map((node, index) => {
        // Render FrameNode for frame type
        if (node.type === 'custom.frame') {
          return (
            <FrameNode
              key={node.id}
              node={node}
              isSelected={selectedNodes.has(node.id)}
              onUpdate={onNodeUpdate}
              onDragStart={onNodeDragStart}
              zoom={viewport.zoom}
              containedCount={frameContainedCount[node.id] ?? 0}
            />
          );
        }

        // Render NoteNode for note type
        if (node.type === 'custom.note') {
          return (
            <NoteNode
              key={node.id}
              node={node}
              isSelected={selectedNodes.has(node.id)}
              onUpdate={onNodeUpdate}
            />
          );
        }

        // Render EditorNode for all other types
        const isConnected = connections.some(c => c.source === node.id || c.target === node.id);
        const meta = nodeMeta[node.id];
        return (
          <EditorNode
            key={node.id}
            node={node}
            typeDefinition={nodeTypes.find(t => t.type === node.type)}
            registry={registry}
            isConnected={isConnected}
            onDragStart={onNodeDragStart}
            onDrag={onNodeDrag}
            onDragEnd={onNodeDragEnd}
            isDragging={draggingNode === node.id}
            onPortDragStart={onPortDragStart}
            onPortDragEnd={onPortDragEnd}
            isConnectionTarget={hoveredInputNode === node.id}
            isSelected={selectedNodes.has(node.id)}
            isHighlighted={highlightedNodes.includes(node.id) || focusedNodeIndex === index}
            onClick={id => onNodeClick(id)}
            onMove={onNodeMove}
            onNodeDoubleClick={onNodeDoubleClick}
            onUpdate={onNodeUpdate}
            editorMode={editorMode}
            status={nodeStatuses[node.id]}
            durationMs={meta?.durationMs ?? null}
            isNextInPath={nextInPath.has(node.id) && !nodeStatuses[node.id]}
            upstreamStatus={upstreamStatusByTarget[node.id] ?? null}
          />
        );
      })}
    </motion.div>
  );
}

// Memoized: pan/zoom drives re-renders of the parent EditorCanvas, but
// as long as the node list + viewport + selection state are reference-
// equal, NodesLayer does not need to re-render its 500+ EditorNode
// children. Shallow prop compare is enough — all props are primitives,
// readonly arrays, or stable callbacks owned by useEditorCanvas.
export default memo(NodesLayer);
