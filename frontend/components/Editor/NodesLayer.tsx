'use client';

import { motion } from 'framer-motion';
import type { WorkflowNode } from '@nanoflow/shared';
import EditorNode from './EditorNode';
import { NodeType } from '../Node';
import type { ViewportState } from '../../types/editor.types';
import type { MouseEvent } from 'react';

interface NodesLayerProps {
    nodes: WorkflowNode[];
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
}

export default function NodesLayer({
    nodes,
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
}: NodesLayerProps) {
    return (
        <motion.div
            className="absolute top-0 left-0 w-full h-full"
            animate={{
                x: viewport.x,
                y: viewport.y,
                scale: viewport.zoom,
            }}
            transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
            }}
            style={{
                transformOrigin: '0 0',
            }}
        >
            {nodes.map((node, index) => (
                <EditorNode
                    key={node.id}
                    node={node}
                    typeDefinition={nodeTypes.find(t => t.type === node.type)}
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
                />
            ))}
        </motion.div>
    );
}
