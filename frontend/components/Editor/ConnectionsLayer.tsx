'use client';

import { useRef, useMemo } from 'react';
import type { WorkflowNode, Connection, ConnectionCondition } from '@nanoflow/shared';
import type { NodeType } from '../Node';
import { useCanvasRenderer } from '../../hooks/useCanvasRenderer';
import type { CreatingConnectionState, ViewportState } from '../../types/editor.types';
import type { SolderState } from '../../hooks/useEditorSoldering';
import ConnectionConditionBadge from './ConnectionConditionBadge';
import { getNodePortInfo, getControlPoints, getBezierPoint } from '../../utils/nodePortUtils';

interface ConnectionsLayerProps {
    connections: Connection[];
    nodes: WorkflowNode[];
    nodeTypes: NodeType[];
    viewport: ViewportState;
    soldering: SolderState | null;
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>;
    selectedConnection: string | null;
    creatingConnection: CreatingConnectionState | null;
    cyclicConnections: string[];
    onConnectionClick: (id: string) => void;
    onConditionChange?: (connectionId: string, condition: ConnectionCondition) => void;
}

export default function ConnectionsLayer({
    connections,
    nodes,
    nodeTypes,
    viewport,
    soldering,
    nodeStatuses = {},
    cyclicConnections,
    onConditionChange,
}: ConnectionsLayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // The new hook will handle all the drawing logic.
    useCanvasRenderer({
        canvasRef,
        nodes,
        nodeTypes,
        connections,
        viewport,
        soldering,
        cyclicConnections,
        nodeStatuses,
    });

    // Calculate badge positions for each connection
    const badgePositions = useMemo(() => {
        return connections.map((conn) => {
            const sourceNode = nodes.find((n) => n.id === conn.source);
            const targetNode = nodes.find((n) => n.id === conn.target);

            if (!sourceNode || !targetNode) return null;

            // Get counts based on types
            const sourceNodeType = nodeTypes.find(t => t.type === sourceNode.type);
            const targetNodeType = nodeTypes.find(t => t.type === targetNode.type);

            const sourceOutputCount = Array.isArray(sourceNodeType?.outputs) ? sourceNodeType.outputs.length : 1;
            const targetInputCount = Array.isArray(targetNodeType?.inputs) ? targetNodeType.inputs.length : 1;

            // Get port positions
            const sourceInfo = getNodePortInfo(sourceNode as any, 'output', conn.sourcePort || 0, sourceOutputCount);
            const targetInfo = getNodePortInfo(targetNode as any, 'input', conn.targetPort || 0, targetInputCount);

            // Calculate precise Bezier midpoint
            const { cp1, cp2 } = getControlPoints(sourceInfo, targetInfo);
            const midPoint = getBezierPoint(0.5, sourceInfo, cp1, cp2, targetInfo);

            // Transform to screen coordinates
            const screenX = midPoint.x * viewport.zoom + viewport.x;
            const screenY = midPoint.y * viewport.zoom + viewport.y;

            return {
                connectionId: conn.id,
                condition: conn.condition || 'complete',
                position: { x: screenX, y: screenY },
            };
        }).filter(Boolean);
    }, [connections, nodes, nodeTypes, viewport]);

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
