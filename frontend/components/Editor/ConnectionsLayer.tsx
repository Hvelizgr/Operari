'use client';

import { motion } from 'framer-motion';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import EditorConnection from './EditorConnection';
import { getNodeOutputPort, getNodeInputPort } from './EditorNode';
import type { CreatingConnectionState, ViewportState } from '../../types/editor.types';
import type { MouseEvent } from 'react';

interface ConnectionsLayerProps {
    connections: Connection[];
    nodes: WorkflowNode[];
    selectedConnection: string | null;
    creatingConnection: CreatingConnectionState | null;
    cyclicConnections: string[];
    viewport: ViewportState;
    onConnectionClick: (id: string) => void;
}

export default function ConnectionsLayer({
    connections,
    nodes,
    selectedConnection,
    creatingConnection,
    cyclicConnections,
    viewport,
    onConnectionClick,
}: ConnectionsLayerProps) {
    return (
        <motion.svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0, transformOrigin: '0 0' }}
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
        >
            {connections.map((connection) => {
                const sourceNode = nodes.find((n) => n.id === connection.source);
                const targetNode = nodes.find((n) => n.id === connection.target);

                if (!sourceNode || !targetNode) return null;

                const isExecuting = sourceNode.executionState === 'running' || targetNode.executionState === 'running';
                const isCyclic = cyclicConnections.includes(connection.id);

                return (
                    <EditorConnection
                        key={connection.id}
                        connection={connection}
                        sourcePos={getNodeOutputPort(sourceNode, connection.sourcePort || 0)}
                        targetPos={getNodeInputPort(targetNode, connection.targetPort || 0)}
                        isSelected={selectedConnection === connection.id}
                        isExecuting={isExecuting}
                        isCyclic={isCyclic}
                        onClick={onConnectionClick}
                    />
                );
            })}
            {creatingConnection && (() => {
                const sourceNode = nodes.find((n) => n.id === creatingConnection.sourceNodeId);
                if (!sourceNode) return null;
                return (
                    <EditorConnection
                        key="temp-connection"
                        connection={{ id: 'temp', source: creatingConnection.sourceNodeId, target: '' }}
                        sourcePos={creatingConnection.startPos}
                        targetPos={creatingConnection.currentPos}
                    />
                );
            })()}
        </motion.svg>
    );
}
