
// frontend/hooks/useCanvasRenderer.ts
import { useEffect, useCallback, useRef } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import type { ViewportState } from '../types/editor.types';
import type { SolderState } from './useEditorSoldering';
import { getNodePortInfo, PortDirection, getControlPoints, getBezierPoint } from '../utils/nodePortUtils';
import type { ConnectionPathStyle } from '../context/EditorThemeContext';

type PathStyle = ConnectionPathStyle | 'bezier';

const getPathStyleFromDOM = (): PathStyle => {
    if (typeof document === 'undefined') return 'bezier';
    return (document.documentElement.getAttribute('data-connection-path-style') as PathStyle) || 'bezier';
};

interface NodeBounds {
    x: number;
    y: number;
    width: number;
    height: number;
    id: string;
}

const NODE_PADDING = 20;
const ROUTE_MARGIN = 25;

const getNodeBounds = (nodes: WorkflowNode[], excludeIds: string[]): NodeBounds[] => {
    return nodes
        .filter(n => !excludeIds.includes(n.id))
        .map(n => ({
            id: n.id,
            x: (n.position?.x ?? (n as any).x ?? 0) - NODE_PADDING,
            y: (n.position?.y ?? (n as any).y ?? 0) - NODE_PADDING,
            width: ((n as any).width || 180) + NODE_PADDING * 2,
            height: ((n as any).height || 60) + NODE_PADDING * 2,
        }));
};

const pointInRect = (px: number, py: number, rect: NodeBounds): boolean => {
    return px >= rect.x && px <= rect.x + rect.width && 
           py >= rect.y && py <= rect.y + rect.height;
};

const lineIntersectsRect = (x1: number, y1: number, x2: number, y2: number, rect: NodeBounds): boolean => {
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) {
        return true;
    }

    if ((x1 < left && x2 < left) || (x1 > right && x2 > right) ||
        (y1 < top && y2 < top) || (y1 > bottom && y2 > bottom)) {
        return false;
    }

    if (Math.abs(x1 - x2) < 0.001) {
        return x1 >= left && x1 <= right && 
               Math.max(Math.min(y1, y2), top) <= Math.min(Math.max(y1, y2), bottom);
    }
    if (Math.abs(y1 - y2) < 0.001) {
        return y1 >= top && y1 <= bottom && 
               Math.max(Math.min(x1, x2), left) <= Math.min(Math.max(x1, x2), right);
    }

    const m = (y2 - y1) / (x2 - x1);
    const b = y1 - m * x1;

    const yAtLeft = m * left + b;
    const yAtRight = m * right + b;
    const xAtTop = (top - b) / m;
    const xAtBottom = (bottom - b) / m;

    return (yAtLeft >= top && yAtLeft <= bottom && left >= Math.min(x1, x2) && left <= Math.max(x1, x2)) ||
           (yAtRight >= top && yAtRight <= bottom && right >= Math.min(x1, x2) && right <= Math.max(x1, x2)) ||
           (xAtTop >= left && xAtTop <= right && top >= Math.min(y1, y2) && top <= Math.max(y1, y2)) ||
           (xAtBottom >= left && xAtBottom <= right && bottom >= Math.min(y1, y2) && bottom <= Math.max(y1, y2));
};

const pathIntersectsAnyRect = (points: { x: number; y: number }[], obstacles: NodeBounds[]): number => {
    let count = 0;
    for (let i = 0; i < points.length - 1; i++) {
        for (const obs of obstacles) {
            if (lineIntersectsRect(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, obs)) {
                count++;
            }
        }
    }
    return count;
};

const findAvoidingPath = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    obstacles: NodeBounds[],
    pathStyle: 'step' | 'smoothstep'
): { x: number; y: number }[] => {
    if (obstacles.length === 0) {
        const midX = (start.x + end.x) / 2;
        return [{ x: midX, y: start.y }, { x: midX, y: end.y }];
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const goingRight = dx > 0;
    const goingDown = dy > 0;

    const allBounds = {
        minX: Math.min(...obstacles.map(o => o.x)) - ROUTE_MARGIN,
        maxX: Math.max(...obstacles.map(o => o.x + o.width)) + ROUTE_MARGIN,
        minY: Math.min(...obstacles.map(o => o.y)) - ROUTE_MARGIN,
        maxY: Math.max(...obstacles.map(o => o.y + o.height)) + ROUTE_MARGIN,
    };

    const candidatePaths: { path: { x: number; y: number }[]; collisions: number; length: number }[] = [];

    const simpleMidX = (start.x + end.x) / 2;
    const simplePath = [start, { x: simpleMidX, y: start.y }, { x: simpleMidX, y: end.y }, end];
    const simpleCollisions = pathIntersectsAnyRect(simplePath, obstacles);
    if (simpleCollisions === 0) {
        return [{ x: simpleMidX, y: start.y }, { x: simpleMidX, y: end.y }];
    }
    candidatePaths.push({ 
        path: [{ x: simpleMidX, y: start.y }, { x: simpleMidX, y: end.y }], 
        collisions: simpleCollisions,
        length: Math.abs(simpleMidX - start.x) + Math.abs(end.y - start.y) + Math.abs(end.x - simpleMidX)
    });

    const routeAboveY = Math.min(start.y, end.y, allBounds.minY) - ROUTE_MARGIN;
    const routeBelowY = Math.max(start.y, end.y, allBounds.maxY) + ROUTE_MARGIN;
    const routeLeftX = Math.min(start.x, end.x, allBounds.minX) - ROUTE_MARGIN;
    const routeRightX = Math.max(start.x, end.x, allBounds.maxX) + ROUTE_MARGIN;

    const topPath = [
        start,
        { x: start.x + ROUTE_MARGIN, y: start.y },
        { x: start.x + ROUTE_MARGIN, y: routeAboveY },
        { x: end.x - ROUTE_MARGIN, y: routeAboveY },
        { x: end.x - ROUTE_MARGIN, y: end.y },
        end
    ];
    const topCollisions = pathIntersectsAnyRect(topPath, obstacles);
    candidatePaths.push({
        path: topPath.slice(1, -1),
        collisions: topCollisions,
        length: calculatePathLength(topPath)
    });

    const bottomPath = [
        start,
        { x: start.x + ROUTE_MARGIN, y: start.y },
        { x: start.x + ROUTE_MARGIN, y: routeBelowY },
        { x: end.x - ROUTE_MARGIN, y: routeBelowY },
        { x: end.x - ROUTE_MARGIN, y: end.y },
        end
    ];
    const bottomCollisions = pathIntersectsAnyRect(bottomPath, obstacles);
    candidatePaths.push({
        path: bottomPath.slice(1, -1),
        collisions: bottomCollisions,
        length: calculatePathLength(bottomPath)
    });

    const leftPath = [
        start,
        { x: routeLeftX, y: start.y },
        { x: routeLeftX, y: end.y },
        end
    ];
    const leftCollisions = pathIntersectsAnyRect(leftPath, obstacles);
    candidatePaths.push({
        path: leftPath.slice(1, -1),
        collisions: leftCollisions,
        length: calculatePathLength(leftPath)
    });

    const rightPath = [
        start,
        { x: routeRightX, y: start.y },
        { x: routeRightX, y: end.y },
        end
    ];
    const rightCollisions = pathIntersectsAnyRect(rightPath, obstacles);
    candidatePaths.push({
        path: rightPath.slice(1, -1),
        collisions: rightCollisions,
        length: calculatePathLength(rightPath)
    });

    const offsets = [0.25, 0.75, 0.33, 0.66];
    for (const ratio of offsets) {
        const midX = start.x + dx * ratio;
        const path = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
        const collisions = pathIntersectsAnyRect(path, obstacles);
        candidatePaths.push({
            path: [{ x: midX, y: start.y }, { x: midX, y: end.y }],
            collisions,
            length: calculatePathLength(path)
        });
    }

    candidatePaths.sort((a, b) => {
        if (a.collisions !== b.collisions) return a.collisions - b.collisions;
        return a.length - b.length;
    });

    return candidatePaths[0]?.path || [{ x: simpleMidX, y: start.y }, { x: simpleMidX, y: end.y }];
};

const calculatePathLength = (points: { x: number; y: number }[]): number => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
        len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
    }
    return len;
};

const drawConnection = (
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number; direction: PortDirection },
    end: { x: number; y: number; direction: PortDirection },
    options: { 
        color?: string; 
        dashOffset?: number; 
        isCyclic?: boolean; 
        flow?: number; 
        pathStyle?: PathStyle;
        obstacles?: NodeBounds[];
    } = {}
) => {
    const pathStyle = options.pathStyle || getPathStyleFromDOM();
    const { cp1, cp2 } = getControlPoints(start, end);
    const obstacles = options.obstacles || [];

    ctx.save();
    ctx.strokeStyle = options.isCyclic ? '#ef4444' : options.color || '#64748b';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = options.isCyclic ? 6 : 0;
    ctx.shadowColor = options.isCyclic ? 'rgba(239, 68, 68, 0.5)' : 'transparent';
    
    if (options.dashOffset !== undefined) {
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -options.dashOffset;
    }

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    let pathPoints: { x: number; y: number }[] = [];

    switch (pathStyle) {
        case 'straight':
            ctx.lineTo(end.x, end.y);
            pathPoints = [end];
            break;

        case 'step': {
            if (obstacles.length > 0) {
                const avoidPath = findAvoidingPath(start, end, obstacles, 'step');
                for (const pt of avoidPath) {
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.lineTo(end.x, end.y);
                pathPoints = [...avoidPath, end];
            } else {
                const midX = (start.x + end.x) / 2;
                ctx.lineTo(midX, start.y);
                ctx.lineTo(midX, end.y);
                ctx.lineTo(end.x, end.y);
                pathPoints = [{ x: midX, y: start.y }, { x: midX, y: end.y }, end];
            }
            break;
        }

        case 'smoothstep': {
            if (obstacles.length > 0) {
                const avoidPath = findAvoidingPath(start, end, obstacles, 'smoothstep');
                const radius = 8;
                
                let prevPoint = { x: start.x, y: start.y };
                for (let i = 0; i < avoidPath.length; i++) {
                    const curr = avoidPath[i];
                    const next = i < avoidPath.length - 1 ? avoidPath[i + 1] : end;
                    
                    const dx1 = curr.x - prevPoint.x;
                    const dy1 = curr.y - prevPoint.y;
                    const dx2 = next.x - curr.x;
                    const dy2 = next.y - curr.y;
                    
                    const isCorner = (dx1 !== 0 && dy2 !== 0) || (dy1 !== 0 && dx2 !== 0);
                    
                    if (isCorner && Math.abs(dx1) + Math.abs(dy1) > radius && Math.abs(dx2) + Math.abs(dy2) > radius) {
                        const beforeX = curr.x - Math.sign(dx1) * Math.min(radius, Math.abs(dx1) / 2);
                        const beforeY = curr.y - Math.sign(dy1) * Math.min(radius, Math.abs(dy1) / 2);
                        const afterX = curr.x + Math.sign(dx2) * Math.min(radius, Math.abs(dx2) / 2);
                        const afterY = curr.y + Math.sign(dy2) * Math.min(radius, Math.abs(dy2) / 2);
                        
                        ctx.lineTo(beforeX, beforeY);
                        ctx.quadraticCurveTo(curr.x, curr.y, afterX, afterY);
                    } else {
                        ctx.lineTo(curr.x, curr.y);
                    }
                    prevPoint = { x: curr.x, y: curr.y };
                }
                ctx.lineTo(end.x, end.y);
                pathPoints = [...avoidPath, end];
            } else {
                const midX = (start.x + end.x) / 2;
                const radius = Math.min(8, Math.abs(end.y - start.y) / 2, Math.abs(midX - start.x) / 2);
                
                if (Math.abs(end.y - start.y) < 2) {
                    ctx.lineTo(end.x, end.y);
                    pathPoints = [end];
                } else {
                    const dir = end.y > start.y ? 1 : -1;
                    ctx.lineTo(midX - radius, start.y);
                    ctx.quadraticCurveTo(midX, start.y, midX, start.y + radius * dir);
                    ctx.lineTo(midX, end.y - radius * dir);
                    ctx.quadraticCurveTo(midX, end.y, midX + radius, end.y);
                    ctx.lineTo(end.x, end.y);
                    pathPoints = [
                        { x: midX - radius, y: start.y },
                        { x: midX, y: start.y + radius * dir },
                        { x: midX, y: end.y - radius * dir },
                        { x: midX + radius, y: end.y },
                        end
                    ];
                }
            }
            break;
        }

        case 'bezier':
        default:
            ctx.bezierCurveTo(cp1!.x, cp1!.y, cp2!.x, cp2!.y, end.x, end.y);
            break;
    }

    ctx.stroke();
    ctx.restore();

    if (options.flow !== undefined) {
        for (let i = 0; i < 1; i++) {
            const t = (options.flow + (i * 0.3)) % 1;
            if (t < 0.05 || t > 0.95) continue;

            let pos: { x: number; y: number };
            
            switch (pathStyle) {
                case 'straight':
                    pos = {
                        x: start.x + (end.x - start.x) * t,
                        y: start.y + (end.y - start.y) * t
                    };
                    break;

                case 'step':
                case 'smoothstep': {
                    if (pathPoints.length > 0) {
                        const allPoints = [start, ...pathPoints];
                        let totalLen = 0;
                        const segLens: number[] = [];
                        for (let j = 1; j < allPoints.length; j++) {
                            const len = Math.hypot(allPoints[j].x - allPoints[j-1].x, allPoints[j].y - allPoints[j-1].y);
                            segLens.push(len);
                            totalLen += len;
                        }
                        
                        const targetLen = t * totalLen;
                        let accLen = 0;
                        pos = start;
                        
                        for (let j = 0; j < segLens.length; j++) {
                            if (accLen + segLens[j] >= targetLen) {
                                const localT = (targetLen - accLen) / segLens[j];
                                pos = {
                                    x: allPoints[j].x + (allPoints[j+1].x - allPoints[j].x) * localT,
                                    y: allPoints[j].y + (allPoints[j+1].y - allPoints[j].y) * localT
                                };
                                break;
                            }
                            accLen += segLens[j];
                        }
                    } else {
                        pos = getBezierPoint(t, start, cp1!, cp2!, end);
                    }
                    break;
                }

                case 'bezier':
                default:
                    pos = getBezierPoint(t, start, cp1!, cp2!, end);
                    break;
            }

            ctx.save();
            ctx.fillStyle = '#3b82f6';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#60a5fa';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
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

        const pathStyle = getPathStyleFromDOM();
        const useObstacleAvoidance = pathStyle === 'step' || pathStyle === 'smoothstep';

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

            const obstacles = useObstacleAvoidance 
                ? getNodeBounds(_nodes, [conn.source, conn.target])
                : [];

            drawConnection(ctx, startInfo, endInfo, {
                isCyclic: _cyclicConnections.includes(conn.id),
                flow,
                obstacles,
                pathStyle
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

                drawConnection(ctx, startInfo, worldMousePos, { color: '#3b82f6', dashOffset: dashOffset.current });
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
