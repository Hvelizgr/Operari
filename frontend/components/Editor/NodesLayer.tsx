'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { WorkflowNode } from '@nanoflow/shared';
import EditorNode from './EditorNode';
import NoteNode from './NoteNode';
import FrameNode from './FrameNode';
import NodeHoverToolbar from './NodeHoverToolbar';
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
    onSolderStart?: (nodeId: string, port: 'input' | 'output', initialX?: number, initialY?: number, portIndex?: number) => void;
    onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    editorMode?: 'move' | 'connect';
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>;

    // Toolbar handlers (n8n-style hover toolbar)
    onNodeRun?: (nodeId: string) => void;
    onNodeToggleDisable?: (nodeId: string) => void;
    onNodeDelete?: (nodeId: string) => void;
    onNodeDuplicate?: (nodeId: string) => void;
    onNodeFocus?: (nodeId: string) => void;
    lang: 'en' | 'es';
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
    // Toolbar handlers
    onNodeRun,
    onNodeToggleDisable,
    onNodeDelete,
    onNodeDuplicate,
    onNodeFocus,
    lang
}: NodesLayerProps) {
    // Hover state for toolbar
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
    const [isToolbarHovered, setIsToolbarHovered] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Handle node hover
    const handleNodeMouseEnter = useCallback((nodeId: string, nodePosition: { x: number; y: number }, nodeWidth: number) => {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setHoveredNodeId(nodeId);
        // Position toolbar at center-top of node
        setToolbarPosition({
            x: nodePosition.x + nodeWidth / 2,
            y: nodePosition.y
        });
    }, []);

    const handleNodeMouseLeave = useCallback(() => {
        // Delay hiding to allow cursor to move to toolbar
        hideTimeoutRef.current = setTimeout(() => {
            if (!isToolbarHovered) {
                setHoveredNodeId(null);
                setToolbarPosition(null);
            }
        }, 150);
    }, [isToolbarHovered]);

    const handleToolbarMouseEnter = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsToolbarHovered(true);
    }, []);

    const handleToolbarMouseLeave = useCallback(() => {
        setIsToolbarHovered(false);
        setHoveredNodeId(null);
        setToolbarPosition(null);
    }, []);

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

    // Get hovered node info for toolbar
    const hoveredNode = hoveredNodeId ? nodes.find(n => n.id === hoveredNodeId) : null;

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
                        <div
                            key={node.id}
                            onMouseEnter={() => handleNodeMouseEnter(node.id, node.position, (node.config as any)?.width || 275)}
                            onMouseLeave={handleNodeMouseLeave}
                            onMouseDown={(e) => onNodeDragStart(node.id, e)}
                        >
                            <NoteNode
                                node={node}
                                isSelected={selectedNodes.has(node.id)}
                                onUpdate={onNodeUpdate}
                                zoom={viewport.zoom}
                            />
                        </div>
                    );
                }

                // Render EditorNode for all other types
                const isConnected = connections.some(c => c.source === node.id || c.target === node.id);
                return (
                    <div
                        key={node.id}
                        onMouseEnter={() => handleNodeMouseEnter(node.id, node.position, 275)}
                        onMouseLeave={handleNodeMouseLeave}
                    >
                        <EditorNode
                            node={node}
                            typeDefinition={nodeTypes.find(t => t.type.toLowerCase() === node.type.toLowerCase())}
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
                            onRunFromNode={onNodeRun}
                            lang={lang}
                        />
                    </div>
                );
            })}

            {/* n8n-style Hover Toolbar */}
            {hoveredNode && toolbarPosition && !draggingNode && (
                <div
                    onMouseEnter={handleToolbarMouseEnter}
                    onMouseLeave={handleToolbarMouseLeave}
                >
                    <NodeHoverToolbar
                        nodeId={hoveredNode.id}
                        nodeTitle={hoveredNode.title}
                        isVisible={true}
                        isDisabled={hoveredNode.type === 'custom.note'}
                        isRunning={nodeStatuses[hoveredNode.id] === 'RUNNING'}
                        position={toolbarPosition}
                        zoom={viewport.zoom}
                        onRun={onNodeRun}
                        onToggleDisable={onNodeToggleDisable}
                        onDelete={onNodeDelete}
                        onDuplicate={onNodeDuplicate}
                        onFocus={onNodeFocus}
                    />
                </div>
            )}
        </motion.div>
    );
}
