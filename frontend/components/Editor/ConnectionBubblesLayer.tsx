'use client';

import { motion } from 'framer-motion';
import type { WorkflowNode, Connection } from '@cairn/shared';
import type { ViewportState } from '../../types/editor.types';
import * as Icons from 'lucide-react';

interface ConnectionBubblesLayerProps {
    connections: Connection[];
    nodes: WorkflowNode[];
    viewport: ViewportState;
    selectedConnection?: string | null;
    onConnectionClick?: (connectionId: string) => void;
    onBubbleClick?: (connectionId: string) => void;
}

// Replicating logic from useCanvasRenderer for consistency
const getNodePortPosition = (node: WorkflowNode, portType: string) => {
    const type = node.type.toLowerCase();
    if (type.includes('trigger') || type === 'start') {
        if (portType === 'input') return { x: node.position.x, y: node.position.y + 32 };
        return { x: node.position.x + 64, y: node.position.y + 32 };
    }
    if (type.includes('controller') || type === 'condition') {
        if (portType === 'input') return { x: node.position.x, y: node.position.y + 32 };
        return { x: node.position.x + 128, y: node.position.y + 32 };
    }
    if (type.includes('limit')) {
        if (portType === 'input') return { x: node.position.x + 32, y: node.position.y };
        return { x: node.position.x + 32, y: node.position.y + 64 };
    }
    if (portType === 'input') return { x: node.position.x, y: node.position.y + 60 };
    return { x: node.position.x + 275, y: node.position.y + 60 };
};

const getBezierMidpoint = (start: { x: number, y: number }, end: { x: number, y: number }) => {
    const halfWayX = (start.x + end.x) / 2;
    // Cubic Bezier t=0.5
    // P0=start, P1=(med, startY), P2=(med, endY), P3=end
    const t = 0.5;
    const invT = 1 - t;

    // Coefficients
    const c0 = invT * invT * invT;         // 0.125
    const c1 = 3 * invT * invT * t;        // 0.375
    const c2 = 3 * invT * t * t;           // 0.375
    const c3 = t * t * t;                  // 0.125

    // Control Points
    const p1 = { x: halfWayX, y: start.y };
    const p2 = { x: halfWayX, y: end.y };

    const x = c0 * start.x + c1 * p1.x + c2 * p2.x + c3 * end.x;
    const y = c0 * start.y + c1 * p1.y + c2 * p2.y + c3 * end.y;

    return { x, y };
};

export default function ConnectionBubblesLayer({
    connections,
    nodes,
    viewport,
    selectedConnection,
    onConnectionClick,
    onBubbleClick
}: ConnectionBubblesLayerProps) {
    return (
        <motion.div
            className="absolute top-0 left-0 w-full h-full pointer-events-none" // pointer-events-none so we don't block canvas interactions, but bubbles need pointer-events-auto
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
            style={{ transformOrigin: '0 0' }}
        >
            {connections.map(conn => {
                const sourceNode = nodes.find(n => n.id === conn.source);
                const targetNode = nodes.find(n => n.id === conn.target);
                if (!sourceNode || !targetNode) return null;

                const start = getNodePortPosition(sourceNode, 'output');
                const end = getNodePortPosition(targetNode, 'input');
                const mid = getBezierMidpoint(start, end);

                // Determine bubble style based on connection data or default
                // xyOps uses CSS classes: wf_condition start, complete, success, error, etc.
                // Assuming we store this in conn.data?.condition or similar. Defaul to 'complete' (blue).
                const conditionType = (conn as any).data?.condition || 'complete';
                const iconMap: Record<string, any> = {
                    complete: Icons.Check,
                    success: Icons.Check,
                    error: Icons.AlertTriangle,
                    warning: Icons.AlertCircle,
                    start: Icons.Play,
                };
                const Icon = iconMap[conditionType] || Icons.Check;

                return (
                    <div
                        key={conn.id}
                        className={`wf_condition ${conditionType} ${selectedConnection === conn.id ? 'popped' : ''}`}
                        style={{
                            left: mid.x - 12, // centered (24px width)
                            top: mid.y - 12,
                            pointerEvents: 'auto'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onBubbleClick) {
                                onBubbleClick(conn.id);
                            } else {
                                onConnectionClick && onConnectionClick(conn.id);
                            }
                        }}
                    >
                        {/* xyOps usually uses icons or just color/symbols. */}
                        <Icon size={14} strokeWidth={3} />
                    </div>
                );
            })}
        </motion.div>
    );
}
