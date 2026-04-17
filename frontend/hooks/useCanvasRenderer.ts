// frontend/hooks/useCanvasRenderer.ts
import { useEffect, useCallback, useRef } from 'react';
import type { WorkflowNode, Connection } from '@cairn/shared';
import type { ViewportState } from '../types/editor.types';
import { getNodePortInfo, PortDirection } from '../utils/nodePortUtils';

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
    options: {
        color?: string;
        dashOffset?: number,
        isCyclic?: boolean,
        flow?: number,
        lineStyle?: 'bezier' | 'straight',
        /** Upstream node state — tints the line and drives flow intensity.
         *  RUNNING: bright emerald + dashed; SUCCESS: pale emerald (path has
         *  delivered data); FAILED: red; else: neutral gray. */
        upstreamStatus?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED',
    } = {}
) => {
    const { cp1, cp2 } = getControlPoints(start, end);
    const lineStyle = options.lineStyle ?? 'bezier';

    // Line color: status-aware. The rebrand uses emerald #3ecf8e for
    // "alive" so running/success connections light up in brand color.
    let strokeColor = options.color || 'rgba(150, 150, 160, 0.55)';
    if (options.isCyclic) {
        strokeColor = '#ef4444';
    } else if (options.upstreamStatus === 'RUNNING') {
        strokeColor = '#3ecf8e';
    } else if (options.upstreamStatus === 'SUCCESS') {
        strokeColor = 'rgba(62, 207, 142, 0.65)';
    } else if (options.upstreamStatus === 'FAILED') {
        strokeColor = 'rgba(239, 68, 68, 0.7)';
    }

    // Draw Line
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = options.upstreamStatus === 'RUNNING' ? 2 : 1.6;
    if (options.isCyclic) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
    } else if (options.upstreamStatus === 'RUNNING') {
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(62, 207, 142, 0.45)';
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    // RUNNING dashes travel along the line thanks to the live dashOffset.
    if (options.upstreamStatus === 'RUNNING' && options.dashOffset !== undefined) {
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -options.dashOffset;
    } else if (options.dashOffset !== undefined) {
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -options.dashOffset;
    }
    if (lineStyle === 'straight') {
        ctx.lineTo(end.x, end.y);
    } else {
        ctx.bezierCurveTo(cp1!.x, cp1!.y, cp2!.x, cp2!.y, end.x, end.y);
    }
    ctx.stroke();
    ctx.restore();

    // Flow orb — emerald. Only runs when flow anim is enabled AND upstream
    // is RUNNING / SUCCESS so a static idle line has zero per-frame cost.
    if (options.flow !== undefined) {
        const t = options.flow % 1;
        if (t >= 0.05 && t <= 0.95) {
            const pos =
                lineStyle === 'straight'
                    ? {
                          x: start.x + (end.x - start.x) * t,
                          y: start.y + (end.y - start.y) * t,
                      }
                    : getBezierPoint(t, start, cp1!, cp2!, end);

            const orbRadius = options.upstreamStatus === 'RUNNING' ? 3.5 : 2.5;
            ctx.save();
            ctx.fillStyle = '#3ecf8e';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(62, 207, 142, 0.9)';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, orbRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

/**
 * Debug crosshair — draws a large hollow ring around the computed
 * port anchor. The ring is 28px radius so it extends well beyond the
 * node body (which otherwise covers the canvas at this z-index).
 * If the ring circles a visible pole, math is right. If the ring is
 * offset from the pole, the delta is the port-position bug.
 * Red for source outputs, blue for target inputs.
 */
function drawPortCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
) {
    ctx.save();
    // Outer halo — bright, thick, visible even against the node card
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.stroke();
    // Inner crosshair extending outward so at least half is outside
    // the node's covering element at z-index 2.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 40, y);
    ctx.lineTo(x + 40, y);
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x, y + 40);
    ctx.stroke();
    // Dead-center dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

interface UseCanvasRendererProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    nodes: WorkflowNode[];
    connections: Connection[];
    viewport: ViewportState;
    cyclicConnections?: string[];
    nodeStatuses?: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED'>;
}

export function useCanvasRenderer({
    canvasRef,
    nodes,
    connections,
    viewport,
    cyclicConnections = [],
    nodeStatuses = {},
}: UseCanvasRendererProps) {
    const animationFrameId = useRef<number>(0);
    const dashOffset = useRef(0);
    const flowOffset = useRef(0);

    // Use Refs to hold latest state for the animation loop
    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const viewportRef = useRef(viewport);
    const cyclicConnectionsRef = useRef(cyclicConnections);
    const nodeStatusesRef = useRef(nodeStatuses);

    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { connectionsRef.current = connections; }, [connections]);
    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { cyclicConnectionsRef.current = cyclicConnections; }, [cyclicConnections]);
    useEffect(() => { nodeStatusesRef.current = nodeStatuses; }, [nodeStatuses]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Read from refs
        const _nodes = nodesRef.current;
        const _connections = connectionsRef.current;
        const _viewport = viewportRef.current;
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

        // Read user visualization prefs from <html> data-* attributes
        // each frame. Cheap (synchronous DOM read), and the user can
        // toggle a setting and see the canvas react instantly without
        // a React rerender.
        const html = document.documentElement;
        const lineStyle = (html.getAttribute('data-line-style') === 'straight'
            ? 'straight'
            : 'bezier') as 'bezier' | 'straight';
        const flowEnabled = html.getAttribute('data-flow') !== 'off';
        const animEnabled = html.getAttribute('data-anim') !== 'off';
        // Diagnostic: when the URL has `?debug=ports`, draw a small red
        // crosshair at every computed port anchor. Compare visually
        // against the live pole buttons — if they don't overlap, we
        // have a port-position math bug. Toggle off by removing the
        // query param.
        const portDebug = typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('debug') === 'ports';

        // Helper: read the ACTUAL pole DOM element's screen rect and
        // convert its center back to logical canvas coords. The canvas
        // and the NodesLayer already share the same wf_container
        // parent, so we measure both relative to the same ancestor and
        // the delta is viewport-free.
        //
        // This is the robust anchor: whatever the CSS ends up placing
        // the pole at (accounting for margins, borders, transforms the
        // spec didn't model) the cable lands exactly there. Falls back
        // to the math-based getNodePortInfo when the DOM element isn't
        // present yet (first paint before layout effect fires, or
        // nano-mode cards with collapsed poles).
        const canvasRect = canvas.getBoundingClientRect();
        const resolvePortAnchor = (
            node: typeof _nodes[number],
            portType: 'input' | 'output',
            portIndex: number,
        ) => {
            // Math-based anchor is always computed — it gives us the
            // direction (left/right/top/bottom) the bezier needs for
            // control-point placement. We then overwrite x/y if we can
            // measure the real DOM element below.
            const math = getNodePortInfo(node, portType, portIndex);

            const container = document.getElementById(`d_wfn_${node.id}`);
            if (!container) return math;

            const portClass = portType === 'input' ? 'wf_input_pole' : 'wf_output_pole';
            const altClass = portType === 'input' ? 'wf_up_pole' : 'wf_down_pole';
            const poles = container.querySelectorAll<HTMLElement>(
                `.${portClass}, .${altClass}`,
            );
            const poleEl = poles[portIndex] ?? poles[0];
            if (!poleEl) return math;

            const poleRect = poleEl.getBoundingClientRect();
            if (poleRect.width === 0 || poleRect.height === 0) return math;

            const cxScreen = poleRect.left + poleRect.width / 2 - canvasRect.left;
            const cyScreen = poleRect.top + poleRect.height / 2 - canvasRect.top;
            return {
                x: (cxScreen - _viewport.x) / _viewport.zoom,
                y: (cyScreen - _viewport.y) / _viewport.zoom,
                direction: math.direction,
            };
        };

        _connections.forEach(conn => {
            const sourceNode = _nodes.find(n => n.id === conn.source);
            const targetNode = _nodes.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) return;

            const startInfo = resolvePortAnchor(sourceNode, 'output', conn.sourcePort || 0);
            const endInfo = resolvePortAnchor(targetNode, 'input', conn.targetPort || 0);

            const sourceStatus = _nodeStatuses[conn.source];
            let flow: number | undefined = undefined;
            if (
                animEnabled &&
                flowEnabled &&
                (sourceStatus === 'SUCCESS' || sourceStatus === 'RUNNING')
            ) {
                flow = flowOffset.current;
            }

            drawSmartBezier(ctx, startInfo, endInfo, {
                isCyclic: _cyclicConnections.includes(conn.id),
                flow,
                lineStyle,
                upstreamStatus: sourceStatus,
                dashOffset: sourceStatus === 'RUNNING' ? dashOffset.current : undefined,
            });

            if (portDebug) {
                drawPortCrosshair(ctx, startInfo.x, startInfo.y, '#ef4444');
                drawPortCrosshair(ctx, endInfo.x, endInfo.y, '#3b82f6');
            }
        });

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
