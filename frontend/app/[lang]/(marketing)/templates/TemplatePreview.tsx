'use client';

import { useMemo } from 'react';
import type { WorkflowNode, Connection } from '@cairn/shared';
import { getAutoLayout } from '@/utils/layoutUtils';

/**
 * Static SVG mini-render of a runbook DAG. Reads the same
 * WorkflowNode + Connection shapes the editor uses, but draws them
 * as a single fixed-size SVG — no zoom, no drag, no canvas. Meant
 * to give a landing visitor a visual "this is what the template
 * looks like" moment before they click into the YAML.
 *
 * Layout strategy:
 *   - If the parsed nodes already carry `position` (authors can pin
 *     coordinates in the YAML), we trust those.
 *   - Otherwise we run dagre via `getAutoLayout('LR')` — same
 *     algorithm the editor uses, so the preview matches the canvas
 *     the user sees when they click "Use template".
 *
 * Visual choices:
 *   - Rounded rects instead of the editor's port-bubble nodes — a
 *     ~180px wide rect reads better at 560×280 canvas size than a
 *     bubble-with-pins.
 *   - Bézier edges with a small arrowhead marker so the flow is
 *     obvious at a glance.
 *   - Color tone comes from the node `type` (shell=primary,
 *     approval=amber, etc.) so templates with many types still
 *     visually distinguish themselves.
 */

interface TemplatePreviewProps {
  nodes: WorkflowNode[];
  connections: Connection[];
  /** Optional explicit viewBox. Defaults to auto-fit. */
  width?: number;
  height?: number;
}

const NODE_W = 170;
const NODE_H = 52;
const PAD = 28;

/**
 * Color by node type. Stays small intentionally — the editor has
 * many more types and shows them with icons; the preview just needs
 * enough differentiation that "shell" and "approval" don't look the
 * same. Everything unknown falls back to the neutral tone.
 */
const TYPE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  shell: {
    fill: 'hsl(154 60% 53% / 0.12)',
    stroke: 'hsl(154 60% 53% / 0.55)',
    text: 'hsl(154 70% 70%)',
  },
  http: {
    fill: 'hsl(200 85% 55% / 0.12)',
    stroke: 'hsl(200 85% 55% / 0.55)',
    text: 'hsl(200 90% 75%)',
  },
  approval: {
    fill: 'hsl(38 92% 55% / 0.12)',
    stroke: 'hsl(38 92% 55% / 0.55)',
    text: 'hsl(38 95% 75%)',
  },
  notify: {
    fill: 'hsl(280 70% 65% / 0.12)',
    stroke: 'hsl(280 70% 65% / 0.55)',
    text: 'hsl(280 75% 80%)',
  },
  wait: { fill: 'hsl(0 0% 50% / 0.12)', stroke: 'hsl(0 0% 50% / 0.55)', text: 'hsl(0 0% 75%)' },
  runbook: {
    fill: 'hsl(154 60% 53% / 0.18)',
    stroke: 'hsl(154 60% 53% / 0.7)',
    text: 'hsl(154 70% 78%)',
  },
  default: {
    fill: 'hsl(0 0% 100% / 0.04)',
    stroke: 'hsl(0 0% 100% / 0.18)',
    text: 'hsl(0 0% 85%)',
  },
};

function toneFor(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default!;
}

export default function TemplatePreview({
  nodes,
  connections,
  width,
  height,
}: TemplatePreviewProps) {
  const layout = useMemo(() => {
    // When every node is pinned at (0,0) (a template authored
    // without positions) the editor would auto-layout on load —
    // mirror that behavior here so the preview matches what the
    // user will actually see in the canvas.
    const needsAutoLayout = nodes.every(
      n => (n.position?.x ?? 0) === 0 && (n.position?.y ?? 0) === 0
    );
    const positioned = needsAutoLayout ? getAutoLayout(nodes, connections, 'LR').nodes : nodes;

    const xs = positioned.map(n => n.position?.x ?? 0);
    const ys = positioned.map(n => n.position?.y ?? 0);
    const minX = Math.min(0, ...xs);
    const minY = Math.min(0, ...ys);
    const maxX = Math.max(...xs) + NODE_W;
    const maxY = Math.max(...ys) + NODE_H;

    const vbW = Math.max(maxX - minX + PAD * 2, 320);
    const vbH = Math.max(maxY - minY + PAD * 2, 180);

    return { positioned, minX, minY, vbW, vbH };
  }, [nodes, connections]);

  const viewW = width ?? layout.vbW;
  const viewH = height ?? layout.vbH;

  if (nodes.length === 0) return null;

  const nodeById = new Map(layout.positioned.map(n => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
      width={viewW}
      height={viewH}
      role="img"
      aria-label="Runbook graph preview"
      className="block h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="tpl-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(0 0% 65%)" />
        </marker>
        <pattern id="tpl-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="hsl(0 0% 100% / 0.04)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width={layout.vbW} height={layout.vbH} fill="url(#tpl-grid)" />

      {/* Edges first so the nodes render on top. The curve is a
                simple horizontal cubic: flat tangents keep the shape
                readable for LR DAGs regardless of vertical spread. */}
      {connections.map(c => {
        const source = nodeById.get(c.source);
        const target = nodeById.get(c.target);
        if (!source || !target) return null;
        const sx = (source.position?.x ?? 0) - layout.minX + PAD + NODE_W;
        const sy = (source.position?.y ?? 0) - layout.minY + PAD + NODE_H / 2;
        const tx = (target.position?.x ?? 0) - layout.minX + PAD;
        const ty = (target.position?.y ?? 0) - layout.minY + PAD + NODE_H / 2;
        const dx = Math.max(40, Math.abs(tx - sx) / 2);
        const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        return (
          <path
            key={c.id}
            d={path}
            fill="none"
            stroke="hsl(0 0% 55% / 0.55)"
            strokeWidth="1.4"
            markerEnd="url(#tpl-arrow)"
          />
        );
      })}

      {/* Nodes */}
      {layout.positioned.map(n => {
        const tone = toneFor(n.type);
        const x = (n.position?.x ?? 0) - layout.minX + PAD;
        const y = (n.position?.y ?? 0) - layout.minY + PAD;
        const label = n.title || n.type;
        return (
          <g key={n.id} transform={`translate(${x} ${y})`}>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={10}
              ry={10}
              fill={tone.fill}
              stroke={tone.stroke}
              strokeWidth="1.2"
            />
            <text
              x={12}
              y={21}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize="11"
              fontWeight={700}
              fill={tone.text}
              letterSpacing="0.06em"
              style={{ textTransform: 'uppercase' }}
            >
              {n.type}
            </text>
            <text
              x={12}
              y={39}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize="13"
              fontWeight={500}
              fill="hsl(0 0% 92%)"
            >
              {truncate(label, 22)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
