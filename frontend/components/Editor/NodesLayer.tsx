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

interface NodesLayerProps {
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
    onSolderStart?: (nodeId: string, port: 'input' | 'output', initialX?: number, initialY?: number) => void;
    onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    editorMode?: 'move' | 'connect';
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>;
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
    onSolderStart,
    onNodeMove,
    onNodeUpdate,
    onNodeDoubleClick,
    editorMode = 'move',
    nodeStatuses = {},
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

    return (
        <motion.div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
                pointerEvents: 'none',
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
                return (
                    <EditorNode
                        key={node.id}
                        node={node}
                        typeDefinition={nodeTypes.find(t => t.type === node.type)}
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
                        onSolderStart={onSolderStart}
                        onNodeDoubleClick={onNodeDoubleClick}
                        onUpdate={onNodeUpdate}
                        editorMode={editorMode}
                        status={nodeStatuses[node.id]}
                    />
                );
            })}
        </motion.div>
    );
}
