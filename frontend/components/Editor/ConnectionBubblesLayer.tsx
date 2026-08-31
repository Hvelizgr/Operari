'use client';

import type { Connection, WorkflowNode } from '@operari/shared';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';

import type { ViewportState } from '../../types/editor.types';
import { resolvePortAnchor } from '../../utils/portAnchor';

interface ConnectionBubblesLayerProps {
  connections: Connection[];
  nodes: WorkflowNode[];
  viewport: ViewportState;
  selectedConnection?: string | null;
  onConnectionClick?: (connectionId: string) => void;
  onBubbleClick?: (connectionId: string) => void;
}

// Simple cubic-bezier midpoint at t=0.5. Control points mirror the
// curvature used by the canvas renderer so the bubble sits exactly
// where the line peaks, not off to one side.
const getBezierMidpoint = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const halfWayX = (start.x + end.x) / 2;
  const t = 0.5;
  const invT = 1 - t;
  const c0 = invT * invT * invT;
  const c1 = 3 * invT * invT * t;
  const c2 = 3 * invT * t * t;
  const c3 = t * t * t;
  const p1 = { x: halfWayX, y: start.y };
  const p2 = { x: halfWayX, y: end.y };
  return {
    x: c0 * start.x + c1 * p1.x + c2 * p2.x + c3 * end.x,
    y: c0 * start.y + c1 * p1.y + c2 * p2.y + c3 * end.y,
  };
};

export default function ConnectionBubblesLayer({
  connections,
  nodes,
  viewport,
  selectedConnection,
  onConnectionClick,
  onBubbleClick,
}: ConnectionBubblesLayerProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 h-full w-full"
      // No spring animation — move instantly with the canvas so the
      // bubbles don't lag behind the connection lines during pan/zoom.
      // The old framer-motion spring made bubbles "bounce" while lines
      // (drawn on canvas 2D) snapped instantly, creating a visual mismatch.
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: '0 0',
        zIndex: 2,
      }}
    >
      {(() => {
        // Resolve the canvas element so the port anchor helper
        // maps screen→logical against the SAME origin the bezier
        // renderer uses. Without this, bubbles sat at math-
        // computed midpoints while lines (post-DOM-anchor fix)
        // ended at the live pole — users saw bubbles drifting
        // off the visible cable.
        const canvasEl =
          typeof document !== 'undefined'
            ? (document.querySelector('.wf_canvas') as HTMLElement | null)
            : null;
        const ctx = { canvasEl, viewport };
        return connections.map(conn => {
          const sourceNode = nodes.find(n => n.id === conn.source);
          const targetNode = nodes.find(n => n.id === conn.target);
          if (!sourceNode || !targetNode) return null;
          const start = resolvePortAnchor(sourceNode, 'output', conn.sourcePort ?? 0, ctx);
          const end = resolvePortAnchor(targetNode, 'input', conn.targetPort ?? 0, ctx);
          const mid = getBezierMidpoint(start, end);

          // xyOps uses CSS classes: wf_condition start, complete, success,
          // error, etc. The Connection type stores the selector at
          // `conn.condition` directly; the old `(conn as any).data?.condition`
          // was a stale path from before the shape was typed. Default to
          // 'complete' (blue) if absent.
          const conditionType = conn.condition || 'complete';
          const iconMap: Record<string, typeof Icons.Check> = {
            complete: Icons.Check,
            success: Icons.Check,
            error: Icons.AlertTriangle,
            warning: Icons.AlertCircle,
            start: Icons.Play,
          };
          const Icon = iconMap[conditionType] || Icons.Check;

          // Color map for the condition type
          const colorMap: Record<string, string> = {
            complete: '#3ecf8e',
            success: '#22c55e',
            error: '#ef4444',
            warning: '#eab308',
            start: '#f97316',
            disabled: '#6b7280',
          };
          const badgeColor = colorMap[conditionType] || '#3ecf8e';

          return (
            <div
              key={conn.id}
              className={selectedConnection === conn.id ? 'popped' : ''}
              style={{
                position: 'absolute',
                left: mid.x - 11,
                top: mid.y - 11,
                width: 22,
                height: 22,
                borderRadius: '5px',
                transform: 'rotate(45deg)',
                backgroundColor: badgeColor,
                border: '2.5px solid rgba(255,255,255,0.5)',
                boxShadow: `0 0 0 2px rgba(0,0,0,0.3), 0 2px 8px ${badgeColor}50`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onClick={e => {
                e.stopPropagation();
                if (onBubbleClick) {
                  onBubbleClick(conn.id);
                } else if (onConnectionClick) {
                  onConnectionClick(conn.id);
                }
              }}
            >
              <span style={{ transform: 'rotate(-45deg)', display: 'flex' }}>
                <Icon size={12} strokeWidth={3} color="white" />
              </span>
            </div>
          );
        });
      })()}
    </div>
  );
}
