// frontend/hooks/useCanvasRenderer.ts
import { useEffect, useCallback, useRef } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import type { ViewportState } from '../types/editor.types';
import type { SolderState } from './useEditorSoldering';

type PortDirection = 'left' | 'right' | 'top' | 'bottom';

// Helper functions to get port positions (aligned with EditorNode.tsx logic)
const getNodePortInfo = (node: WorkflowNode, portType: string, portIndex: number = 0): { x: number; y: number; direction: PortDirection } => {
    const type = node.type.toLowerCase();

    // Trigger / Start: Output ONLY (Right)
    if (type.includes('trigger') || type === 'start') {
        if (portType === 'input') return { x: node.position.x, y: node.position.y + 32, direction: 'left' }; // Should not happen usually
        return { x: node.position.x + 64, y: node.position.y + 32, direction: 'right' };
    }

    // Controller: Input (Left), Output (Right)
    if (type.includes('controller') || type === 'condition') {
        if (portType === 'input') return { x: node.position.x, y: node.position.y + 32, direction: 'left' };
        return { x: node.position.x + 128, y: node.position.y + 32, direction: 'right' };
    }

    // Limit: Input (Top), Output (Bottom)
    if (type.includes('limit')) {
        if (portType === 'input') return { x: node.position.x + 32, y: node.position.y, direction: 'top' };
        return { x: node.position.x + 32, y: node.position.y + 64, direction: 'bottom' };
    }

    // Standard Job: Input (Left), Output (Right)
    // Use dynamic dimensions if available for center alignment
    const height = (node as any).dimensions?.height || 120;
    if (portType === 'input') return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
    return { x: node.position.x + 275, y: node.position.y + (height / 2), direction: 'right' };
};

const getControlPoint = (pos: { x: number, y: number }, direction: PortDirection, distance: number) => {
    switch (direction) {
        case 'left': return { x: pos.x - distance, y: pos.y };
        case 'right': return { x: pos.x + distance, y: pos.y };
        case 'top': return { x: pos.x, y: pos.y - distance };
        case 'bottom': return { x: pos.x, y: pos.y + distance };
    }
};

const getControlPoints = (
    start: { x: number; y: number; direction: PortDirection },
    end: { x: number; y: number; direction: PortDirection }
) => {
    const distX = Math.abs(end.x - start.x);
    const distY = Math.abs(end.y - start.y);
    const dist = Math.sqrt(distX * distX + distY * distY);
    const curvature = Math.min(Math.max(dist * 0.4, 50), 200);

    const cp1 = getControlPoint(start, start.direction, curvature);
    const cp2 = getControlPoint(end, end.direction, curvature);
    return { cp1, cp2, curvature }; // curvature for generic use if needed
};

const getBezierPoint = (t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
    const c0 = Math.pow(1 - t, 3);
    const c1 = 3 * Math.pow(1 - t, 2) * t;
    const c2 = 3 * (1 - t) * Math.pow(t, 2);
    const c3 = Math.pow(t, 3);

    return {
        x: c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
        y: c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y
    };
};

const drawSmartBezier = (
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number; direction: PortDirection },
    end: { x: number; y: number; direction: PortDirection },
    options: { color?: string; dashOffset?: number, isCyclic?: boolean, flow?: number } = {}
) => {
    const { cp1, cp2 } = getControlPoints(start, end);

    // Draw Line
    ctx.save();
    ctx.strokeStyle = options.isCyclic ? '#ef4444' : options.color || '#888';
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = options.isCyclic ? 8 : 0;
    ctx.shadowColor = options.isCyclic ? 'rgba(239, 68, 68, 0.7)' : 'transparent';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    if (options.dashOffset !== undefined) {
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -options.dashOffset;
    }
    ctx.bezierCurveTo(cp1!.x, cp1!.y, cp2!.x, cp2!.y, end.x, end.y); // ts-ignore if cp undefined? No, getControlPoints returns valid
    ctx.stroke();
    ctx.restore();

    // Draw Micro-mouse (Flow Animation)
    if (options.flow !== undefined) {
        // We calculate 3 beads for continuous flow feel
        for (let i = 0; i < 1; i++) {
            const t = (options.flow + (i * 0.3)) % 1;
            // Ease the t for non-linear speed? No, linear is fine for data flow.

            // To hide beads near ends/ports for cleaner look:
            if (t < 0.05 || t > 0.95) continue;

            const pos = getBezierPoint(t, start, cp1!, cp2!, end);

            ctx.save();
            ctx.fillStyle = '#3b82f6'; // Blue data orb
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#60a5fa';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

interface UseCanvasRendererProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    nodes: WorkflowNode[];
    connections: Connection[];
    viewport: ViewportState;
    soldering: SolderState | null;
    cyclicConnections?: string[];
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>;
}

export function useCanvasRenderer({
    canvasRef,
    nodes,
    connections,
    viewport,
    soldering,
    cyclicConnections = [],
    nodeStatuses = {},
}: UseCanvasRendererProps) {
    const animationFrameId = useRef<number>(0);
    const dashOffset = useRef(0);
    const flowOffset = useRef(0);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * window.devicePixelRatio || canvas.height !== rect.height * window.devicePixelRatio) {
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.translate(viewport.x, viewport.y);
        ctx.scale(viewport.zoom, viewport.zoom);

        connections.forEach(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) return;

            const startInfo = getNodePortInfo(sourceNode, 'output', conn.sourcePort || 0);
            const endInfo = getNodePortInfo(targetNode, 'input', conn.targetPort || 0);

            // Logic for Flow: If source is SUCCESS or RUNNING, we animate.
            // If target is FAILED, maybe red flow?
            const sourceStatus = nodeStatuses[conn.source];
            let flow: number | undefined = undefined;
            if (sourceStatus === 'SUCCESS' || sourceStatus === 'RUNNING') {
                flow = flowOffset.current;
            }

            drawSmartBezier(ctx, startInfo, endInfo, {
                isCyclic: cyclicConnections.includes(conn.id),
                flow
            });
        });

        if (soldering) {
            const startNode = nodes.find(n => n.id === soldering.startNodeId);
            if (startNode) {
                const startInfo = getNodePortInfo(startNode, soldering.startPort, 0);
                const worldMousePos = {
                    x: (soldering.mousePos.x - viewport.x) / viewport.zoom,
                    y: (soldering.mousePos.y - viewport.y) / viewport.zoom,
                    direction: (['left', 'right'].includes(startInfo.direction) ? (startInfo.direction === 'left' ? 'left' : 'right') : 'top') as PortDirection
                };
                const mouseDirectionMap: Record<string, PortDirection> = { 'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top' };
                worldMousePos.direction = mouseDirectionMap[startInfo.direction] || 'left';

                drawSmartBezier(ctx, startInfo, worldMousePos, { color: '#3b82f6', dashOffset: dashOffset.current });
            }
        }

        ctx.restore();

        dashOffset.current = (dashOffset.current + 0.5) % 20;
        flowOffset.current = (flowOffset.current + 0.005) % 1; // Speed of mouse
        animationFrameId.current = requestAnimationFrame(draw);

    }, [nodes, connections, viewport, soldering, cyclicConnections, nodeStatuses]);

    useEffect(() => {
        animationFrameId.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [draw]);
}
