'use client';

import type { ConnectionCondition } from '@operari/shared';
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from '@xyflow/react';
import * as Icons from 'lucide-react';
import { createContext, memo, useContext } from 'react';

import type { RenderPrefs } from '../../../utils/canvas/prefs';
import type { StepStatus } from './flowNodes';
import type { CanvasAppearance } from './useCanvasAppearance';

export type ConditionFlowEdge = Edge<
  {
    condition: ConnectionCondition;
    isCyclic: boolean;
    sourceStatus?: StepStatus;
    onSelect: (connectionId: string) => void;
  },
  'condition'
>;

export const EdgeAppearanceContext = createContext<CanvasAppearance | null>(null);

const CONDITION_ICON: Record<string, typeof Icons.Check> = {
  complete: Icons.Check,
  success: Icons.Check,
  error: Icons.AlertTriangle,
  warning: Icons.AlertCircle,
  disabled: Icons.Ban,
};

const CONDITION_COLOR: Record<string, string> = {
  complete: '#3ecf8e',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#eab308',
  disabled: '#6b7280',
};

const IDLE_DASH: Record<RenderPrefs['edgeDashPattern'], string | undefined> = {
  solid: undefined,
  dotted: '1 5',
  'short-dash': '4 4',
  'long-dash': '10 6',
};

const FLOW_BASE_SECONDS = 2;

export function edgeStroke(prefs: RenderPrefs, isCyclic: boolean, status?: StepStatus): string {
  if (isCyclic) return '#ef4444';
  if (status === 'RUNNING' || status === 'SUCCESS' || status === 'FAILED') {
    return prefs.statusColor[status];
  }
  return prefs.idleColor;
}

function edgePath(lineStyle: RenderPrefs['lineStyle'], p: Parameters<typeof getBezierPath>[0]) {
  if (lineStyle === 'straight') return getStraightPath(p);
  if (lineStyle === 'step') return getSmoothStepPath({ ...p, borderRadius: 0 });
  return getBezierPath(p);
}

function FlowMarkers({
  path,
  prefs,
  color,
  seconds,
}: {
  path: string;
  prefs: RenderPrefs;
  color: string;
  seconds: number;
}) {
  const r = prefs.particleSize;
  const particleCount = Math.max(1, Math.round(prefs.particleCount));
  const dots =
    prefs.flowStyle === 'particles'
      ? Array.from({ length: particleCount }, (_, i) => ({
          r: r * 0.8,
          offset: i / particleCount,
          opacity: 0.85,
        }))
      : prefs.flowStyle === 'comet'
        ? [0, 0.04, 0.08, 0.12].map((lag, i) => ({
            r: r * (1 - i * 0.22),
            offset: -lag,
            opacity: 1 - i * 0.25,
          }))
        : [{ r, offset: 0, opacity: 1 }];

  return (
    <g className="wf_edge_flow" aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} r={d.r} fill={color} opacity={d.opacity}>
          <animateMotion
            dur={`${seconds}s`}
            repeatCount="indefinite"
            path={path}
            begin={`${d.offset * seconds}s`}
          />
        </circle>
      ))}
    </g>
  );
}

function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  data,
}: EdgeProps<ConditionFlowEdge>) {
  const appearance = useContext(EdgeAppearanceContext);
  const prefs = appearance?.edges;

  const [path, labelX, labelY] = edgePath(prefs?.lineStyle ?? 'bezier', {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const condition = data?.condition ?? 'complete';
  const status = data?.sourceStatus;
  const isCyclic = !!data?.isCyclic;
  const isRunning = status === 'RUNNING';
  const Icon = CONDITION_ICON[condition] ?? Icons.Check;
  const badgeColor = CONDITION_COLOR[condition] ?? CONDITION_COLOR.complete;

  const stroke = prefs ? edgeStroke(prefs, isCyclic, status) : undefined;
  const isIdle = !status && !isCyclic;
  const anim = !!prefs?.animEnabled;
  const flowStyle = prefs?.flowEnabled ? prefs.flowStyle : 'off';
  const hasFlow = anim && flowStyle !== 'off' && (status === 'SUCCESS' || isRunning);
  const seconds = FLOW_BASE_SECONDS / (appearance?.flowSpeedMult ?? 1);

  const lineClass = [
    anim && isRunning && 'wf_edge_march',
    hasFlow && flowStyle === 'dashes' && 'wf_edge_march',
    hasFlow && flowStyle === 'gradient' && 'wf_edge_sweep',
    hasFlow && flowStyle === 'pulse' && 'wf_edge_pulse',
    isCyclic && 'wf_edge_cyclic',
  ]
    .filter(Boolean)
    .join(' ');

  const strokeWidth = (prefs?.edgeThickness ?? 2) + (isRunning ? 0.4 : 0) + (selected ? 0.8 : 0);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={lineClass || undefined}
        style={
          {
            stroke: selected ? 'var(--theme-color, #3ecf8e)' : stroke,
            strokeWidth,
            strokeLinecap: 'round',
            opacity: isIdle && !selected ? prefs?.edgeIdleOpacity : undefined,
            strokeDasharray:
              condition === 'disabled'
                ? '4 4'
                : isIdle
                  ? IDLE_DASH[prefs?.edgeDashPattern ?? 'solid']
                  : undefined,
            '--edge-flow-seconds': `${seconds}s`,
          } as React.CSSProperties
        }
      />
      {hasFlow && prefs && ['orbs', 'comet', 'particles'].includes(flowStyle) && (
        <FlowMarkers path={path} prefs={prefs} color={stroke ?? badgeColor} seconds={seconds} />
      )}
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`wf_edge_bubble nodrag nopan ${selected ? 'popped' : ''}`}
          style={
            {
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) rotate(45deg)`,
              '--bubble-color': badgeColor,
            } as React.CSSProperties
          }
          title={condition}
          aria-label={`Connection condition: ${condition}`}
          onClick={e => {
            e.stopPropagation();
            data?.onSelect(id);
          }}
        >
          <Icon size={11} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const flowEdgeTypes = {
  condition: memo(ConditionEdge),
};
