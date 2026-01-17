
// frontend/hooks/useCanvasRenderer.ts
import { useEffect, useCallback, useRef } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import type { ViewportState } from '../types/editor.types';
import type { SolderState } from './useEditorSoldering';
import { getNodePortInfo, PortDirection, getControlPoints, getBezierPoint } from '../utils/nodePortUtils';

const drawSmartBezier = (
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number; direction: PortDirection },
    end: { x: number; y: number; direction: PortDirection },
    options: { color?: string; dashOffset?: number, isCyclic?: boolean, flow?: number } = {}
) => {
    const { cp1, cp2 } = getControlPoints(start, end);

    // Draw Line - thinner, more elegant
    ctx.save();
    ctx.strokeStyle = options.isCyclic ? '#ef4444' : options.color || '#64748b';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = options.isCyclic ? 6 : 0;
    ctx.shadowColor = options.isCyclic ? 'rgba(239, 68, 68, 0.5)' : 'transparent';
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
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#60a5fa';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

interface UseCanvasRendererProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    nodes: WorkflowNode[];
    nodeTypes?: any[]; // Allow generic usage
    connections: Connection[];
    viewport: ViewportState;
    soldering: SolderState | null;
    cyclicConnections?: string[];
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>;
}

export function useCanvasRenderer({
    canvasRef,
    nodes,
    nodeTypes = [],
    connections,
    viewport,
    soldering,
    cyclicConnections = [],
    nodeStatuses = {},
}: UseCanvasRendererProps) {
    const animationFrameId = useRef<number>(0);
    const dashOffset = useRef(0);
    const flowOffset = useRef(0);

    // Use Refs to hold latest state for the animation loop
    const nodesRef = useRef(nodes);
    const nodeTypesRef = useRef(nodeTypes);
    const connectionsRef = useRef(connections);
    const viewportRef = useRef(viewport);
    const solderingRef = useRef(soldering);
    const cyclicConnectionsRef = useRef(cyclicConnections);
    const nodeStatusesRef = useRef(nodeStatuses);

    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { nodeTypesRef.current = nodeTypes; }, [nodeTypes]);
    useEffect(() => { connectionsRef.current = connections; }, [connections]);
    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { solderingRef.current = soldering; }, [soldering]);
    useEffect(() => { cyclicConnectionsRef.current = cyclicConnections; }, [cyclicConnections]);
    useEffect(() => { nodeStatusesRef.current = nodeStatuses; }, [nodeStatuses]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Read from refs
        const _nodes = nodesRef.current;
        const _nodeTypes = nodeTypesRef.current;
        const _connections = connectionsRef.current;
        const _viewport = viewportRef.current;
        const _soldering = solderingRef.current;
        const _cyclicConnections = cyclicConnectionsRef.current;
        const _nodeStatuses = nodeStatusesRef.current;

        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * window.devicePixelRatio || canvas.height !== rect.height * window.devicePixelRatio) {
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.translate(_viewport.x, _viewport.y);
        ctx.scale(_viewport.zoom, _viewport.zoom);

        _connections.forEach(conn => {
            const sourceNode = _nodes.find(n => n.id === conn.source);
            const targetNode = _nodes.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) return;

            // Get port counts
            const sourceNodeType = _nodeTypes.find((t: any) => t.type === sourceNode.type);
            const targetNodeType = _nodeTypes.find((t: any) => t.type === targetNode.type);

            const sourceOutputCount = Array.isArray(sourceNodeType?.outputs) ? sourceNodeType.outputs.length : 1;
            const targetInputCount = Array.isArray(targetNodeType?.inputs) ? targetNodeType.inputs.length : 1;

            const startInfo = getNodePortInfo(sourceNode, 'output', conn.sourcePort || 0, sourceOutputCount);
            const endInfo = getNodePortInfo(targetNode, 'input', conn.targetPort || 0, targetInputCount);

            const sourceStatus = _nodeStatuses[conn.source];
            let flow: number | undefined = undefined;
            if (sourceStatus === 'SUCCESS' || sourceStatus === 'RUNNING') {
                flow = flowOffset.current;
            }

            drawSmartBezier(ctx, startInfo, endInfo, {
                isCyclic: _cyclicConnections.includes(conn.id),
                flow
            });
        });

        if (_soldering) {
            const startNode = _nodes.find(n => n.id === _soldering.startNodeId);
            if (startNode) {
                const portType = _soldering.startPort === 'input' ? 'input' : 'output';

                // Calculate count for soldering start port
                const startNodeType = _nodeTypes.find((t: any) => t.type === startNode.type);
                let portCount = 1;
                if (portType === 'input') portCount = Array.isArray(startNodeType?.inputs) ? startNodeType.inputs.length : 1;
                else portCount = Array.isArray(startNodeType?.outputs) ? startNodeType.outputs.length : 1;

                const startInfo = getNodePortInfo(startNode, portType, _soldering.startPortIndex || 0, portCount);

                // Adjust for canvas space since soldering.mousePos is relative to canvas clientRect
                const worldMousePos = {
                    x: (_soldering.mousePos.x - _viewport.x) / _viewport.zoom,
                    y: (_soldering.mousePos.y - _viewport.y) / _viewport.zoom,
                    direction: (['left', 'right'].includes(startInfo.direction) ? (startInfo.direction === 'left' ? 'left' : 'right') : 'top') as PortDirection
                };

                // Smart direction flip for mouse
                const mouseDirectionMap: Record<string, PortDirection> = { 'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top' };
                worldMousePos.direction = mouseDirectionMap[startInfo.direction] || 'left';

                drawSmartBezier(ctx, startInfo, worldMousePos, { color: '#3b82f6', dashOffset: dashOffset.current });
            }
        }

        ctx.restore();

        dashOffset.current = (dashOffset.current + 0.5) % 20;
        flowOffset.current = (flowOffset.current + 0.005) % 1;
        animationFrameId.current = requestAnimationFrame(draw);

    }, [canvasRef]); // Minimal dependencies

    useEffect(() => {
        animationFrameId.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [draw]);
}
