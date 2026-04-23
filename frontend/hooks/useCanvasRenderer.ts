import { useEffect, useCallback, useRef } from 'react';
import type { WorkflowNode, Connection } from '@cairn/shared';
import type { ViewportState } from '../types/editor.types';
import { resolvePortAnchor } from '../utils/portAnchor';
import { drawSmartBezier } from '../utils/canvas/drawing';
import { readPrefs, readFlowSpeedMult, type UpstreamStatus } from '../utils/canvas/prefs';
import { drawPortCrosshair } from '../utils/canvas/debug';

/**
 * Canvas rendering loop for workflow connections.
 *
 * Drives a per-frame requestAnimationFrame loop that re-reads the
 * user's Appearance preferences from `<html>` data-* attrs on every
 * frame (cheap synchronous DOM read) so toggles in the Appearance
 * page take effect instantly without a React re-render.
 *
 * The heavy lifting lives in `utils/canvas/` (pure functions with no
 * React state — they're utilities, not hooks):
 * - geometry.ts — control points, bezier sampling, step elbows
 * - drawing.ts  — drawSmartBezier + arrow head + orb painter
 * - color.ts    — colorWithAlpha RGB parser
 * - prefs.ts    — RenderPrefs + readPrefs() + palette fallbacks
 * - debug.ts    — port-anchor crosshair (?debug=ports)
 */

interface UseCanvasRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  nodes: WorkflowNode[];
  connections: Connection[];
  viewport: ViewportState;
  cyclicConnections?: string[];
  nodeStatuses?: Record<string, UpstreamStatus>;
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

  // Use refs so the rAF callback reads the latest props without
  // re-creating itself every render.
  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const viewportRef = useRef(viewport);
  const cyclicConnectionsRef = useRef(cyclicConnections);
  const nodeStatusesRef = useRef(nodeStatuses);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    cyclicConnectionsRef.current = cyclicConnections;
  }, [cyclicConnections]);
  useEffect(() => {
    nodeStatusesRef.current = nodeStatuses;
  }, [nodeStatuses]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const _nodes = nodesRef.current;
    const _connections = connectionsRef.current;
    const _viewport = viewportRef.current;
    const _cyclicConnections = cyclicConnectionsRef.current;
    const _nodeStatuses = nodeStatusesRef.current;

    const rect = canvas.getBoundingClientRect();
    if (
      canvas.width !== rect.width * window.devicePixelRatio ||
      canvas.height !== rect.height * window.devicePixelRatio
    ) {
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(_viewport.x, _viewport.y);
    ctx.scale(_viewport.zoom, _viewport.zoom);

    const prefs = readPrefs();
    // Diagnostic: when the URL has `?debug=ports`, draw a small red
    // crosshair at every computed port anchor. Compare visually
    // against the live pole buttons — if they don't overlap, we
    // have a port-position math bug. Toggle off by removing the
    // query param.
    const portDebug =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === 'ports';

    // Anchor bezier endpoints to the real pole DOM, not the math.
    // Shared helper so the connection bubble layer agrees on the
    // exact same coordinate.
    const anchorCtx = { canvasEl: canvas, viewport: _viewport };

    _connections.forEach(conn => {
      const sourceNode = _nodes.find(n => n.id === conn.source);
      const targetNode = _nodes.find(n => n.id === conn.target);
      if (!sourceNode || !targetNode) return;

      const startInfo = resolvePortAnchor(sourceNode, 'output', conn.sourcePort || 0, anchorCtx);
      const endInfo = resolvePortAnchor(targetNode, 'input', conn.targetPort || 0, anchorCtx);

      const sourceStatus = _nodeStatuses[conn.source];
      let flow: number | undefined = undefined;
      if (
        prefs.animEnabled &&
        prefs.flowEnabled &&
        (sourceStatus === 'SUCCESS' || sourceStatus === 'RUNNING')
      ) {
        flow = flowOffset.current;
      }

      drawSmartBezier(ctx, startInfo, endInfo, prefs, {
        isCyclic: _cyclicConnections.includes(conn.id),
        flow,
        upstreamStatus: sourceStatus,
        dashOffset: sourceStatus === 'RUNNING' ? dashOffset.current : undefined,
      });

      if (portDebug) {
        drawPortCrosshair(ctx, startInfo.x, startInfo.y, '#ef4444');
        drawPortCrosshair(ctx, endInfo.x, endInfo.y, '#3b82f6');
      }
    });

    ctx.restore();

    // flowOffset drives every moving-along-line animation. The
    // user's flowSpeed preference scales its per-frame step so
    // `fast` makes orbs/particles visibly quicker without bumping
    // the rAF rate.
    const flowMult = readFlowSpeedMult();
    dashOffset.current = (dashOffset.current + 0.5 * flowMult) % 20;
    flowOffset.current = (flowOffset.current + 0.005 * flowMult) % 1;
    animationFrameId.current = requestAnimationFrame(draw);
  }, [canvasRef]);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [draw]);
}
