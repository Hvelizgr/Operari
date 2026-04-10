'use client';

import { useRef, useMemo } from 'react';
import type { WorkflowNode, Connection, ConnectionCondition } from '@nanoflow/shared';
import { useCanvasRenderer } from '../../hooks/useCanvasRenderer';
import type { CreatingConnectionState, ViewportState } from '../../types/editor.types';
import ConnectionConditionBadge from './ConnectionConditionBadge';
import { getNodeOutputPort, getNodeInputPort } from './EditorNode';

interface ConnectionsLayerProps {
    connections: Connection[];
    nodes: WorkflowNode[];
    viewport: ViewportState;
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED'>;
    selectedConnection: string | null;
    creatingConnection: CreatingConnectionState | null;
    cyclicConnections: string[];
    onConnectionClick: (id: string) => void;
    onConditionChange?: (connectionId: string, condition: ConnectionCondition) => void;
}

export default function ConnectionsLayer({
    connections,
    nodes,
    viewport,
    nodeStatuses = {},
    cyclicConnections,
    onConditionChange,
}: ConnectionsLayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // The new hook will handle all the drawing logic.
    useCanvasRenderer({
        canvasRef,
        nodes,
        connections,
        viewport,
        cyclicConnections,
        nodeStatuses,
    });

    // Calculate badge positions for each connection
    const badgePositions = useMemo(() => {
        return connections.map((conn) => {
            const sourceNode = nodes.find((n) => n.id === conn.source);
            const targetNode = nodes.find((n) => n.id === conn.target);

            if (!sourceNode || !targetNode) return null;

            // Get port positions
            const sourcePort = getNodeOutputPort(sourceNode as any, conn.sourcePort || 0);
            const targetPort = getNodeInputPort(targetNode as any, conn.targetPort || 0);

            // Calculate midpoint
            const midX = (sourcePort.x + targetPort.x) / 2;
            const midY = (sourcePort.y + targetPort.y) / 2;

            // Transform to screen coordinates
            const screenX = midX * viewport.zoom + viewport.x;
            const screenY = midY * viewport.zoom + viewport.y;

            return {
                connectionId: conn.id,
                condition: conn.condition || 'complete',
                position: { x: screenX, y: screenY },
            };
        }).filter(Boolean);
    }, [connections, nodes, viewport]);

    return (
        <>
            <canvas
                ref={canvasRef}
                className="wf_canvas"
            />
            {/* Connection Condition Badges */}
            {onConditionChange && badgePositions.map((badge) => (
                badge && (
                    <ConnectionConditionBadge
                        key={badge.connectionId}
                        connectionId={badge.connectionId}
                        condition={badge.condition as ConnectionCondition}
                        position={badge.position}
                        onConditionChange={onConditionChange}
                        zoom={viewport.zoom}
                    />
                )
            ))}
        </>
    );
}
