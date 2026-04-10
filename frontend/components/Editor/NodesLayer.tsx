'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { WorkflowNode } from '@nanoflow/shared';
import EditorNode from './EditorNode';
import NoteNode from './NoteNode';
import FrameNode from './FrameNode';
import { NodeType } from '../Node';
import type { ViewportState } from '../../types/editor.types';
import type { MouseEvent } from 'react';
import type { NodeMeta } from '../../hooks/useExecutionSocket';
import type { NodeTypeRegistry } from '../../lib/canvas/node-type-registry';

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
    onPortDragStart: (nodeId: string, portId: string, type: 'source' | 'target', pos: { x: number; y: number }) => void;
    onPortDragEnd: () => void;
    onNodeClick: (id: string) => void;
    onNodeMove: (nodeId: string, direction: 'up' | 'down' | 'left' | 'right') => void;
    onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    editorMode?: 'move' | 'connect';
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED'>;
    nodeMeta?: Record<string, NodeMeta>;
}

export default function NodesLayer({
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

    // Mini mode: when the canvas is zoomed below 60% the cards are
    // too small to read. Collapse the body and show only the icon
    // square + title via a wrapper class — the rest of the card
    // (preview, badges, body) hides via CSS.
    const isMiniMode = viewport.zoom < 0.6;

    return (
        <motion.div
            className={isMiniMode ? 'wf_canvas_layer wf_mini_mode' : 'wf_canvas_layer'}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
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
                        onClick={(id) => onNodeClick(id)}
                        onMove={onNodeMove}
                        onNodeDoubleClick={onNodeDoubleClick}
                        onUpdate={onNodeUpdate}
                        editorMode={editorMode}
                        status={nodeStatuses[node.id]}
                        durationMs={meta?.durationMs ?? null}
                        isNextInPath={nextInPath.has(node.id) && !nodeStatuses[node.id]}
                    />
                );
            })}
        </motion.div>
    );
}
