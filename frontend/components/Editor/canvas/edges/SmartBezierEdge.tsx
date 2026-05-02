'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo, useMemo } from 'react';

import { FLOW_SPEED_MULT, useVisualization } from '@/context/VisualizationContext';
import type { RfEdge } from '@/lib/canvas/adapter';

import { EdgeDeleteButton } from './EdgeDeleteButton';
import { isRunning, resolveEdgeStroke } from './edgeStyle';

const CONDITION_BADGE_LABEL: Record<NonNullable<RfEdge['data']>['condition'] & string, string> = {
  complete: '',
  success: '✓',
  error: '✗',
  warning: '!',
  disabled: '–',
};

// Two staggered orbs make a "comet trail" — the second one trails the
// first by half a duration so the eye reads the edge as flowing rather
// than a single particle blinking around. Adding a third does not help
// readability and starts costing GPU on graphs with many running edges.
const ORB_COUNT = 2;
const ORB_DURATION_S = 1.6;

function SmartBezierEdgeComponent(props: EdgeProps<RfEdge>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    markerEnd,
  } = props;

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.4,
  });

  const stroke = resolveEdgeStroke(data);
  const isRunningRaw = isRunning(data);
  // User-controlled animation gates from Appearance → Connections.
  // `flowAnimationsEnabled` is the master switch; `flowFlavor` picks
  // which of the 3 effects render (gradient/dashes/comet/all/off);
  // `flowSpeed` scales every `dur` so all three speed up together
  // without restarting the React tree.
  const { flowAnimationsEnabled, flowSpeed, flowFlavor } = useVisualization();
  const speedMult = FLOW_SPEED_MULT[flowSpeed] ?? 1;
  const running = isRunningRaw && flowAnimationsEnabled && flowFlavor !== 'off';
  const showGradient = running && (flowFlavor === 'all' || flowFlavor === 'gradient');
  const showDashes = running && (flowFlavor === 'all' || flowFlavor === 'dashes');
  const showComet = running && (flowFlavor === 'all' || flowFlavor === 'comet');
  const orbDurationS = ORB_DURATION_S / speedMult;
  const gradientDurationS = 1.6 / speedMult;
  const dashDurationMs = Math.round(800 / speedMult);
  const strokeWidth = selected ? 3 : data?.cyclic ? 2.5 : 2;

  const badgeLabel = data?.condition ? CONDITION_BADGE_LABEL[data.condition] : '';
  const showBadge = badgeLabel && data?.condition && data.condition !== 'complete';

  const gradientId = `rb-flow-${id}`;
  const pathId = `rb-edge-path-${id}`;

  const orbs = useMemo(
    () =>
      Array.from({ length: ORB_COUNT }, (_, i) => ({
        key: i,
        delay: -((ORB_DURATION_S / ORB_COUNT) * i),
      })),
    []
  );

  return (
    <>
      {/* Defs are local to the edge — RF mounts each edge in its own
          <g>, and IDs include the edge id, so duplication across edges
          is impossible. */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
          <stop offset="50%" stopColor={stroke} stopOpacity={1} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0.2} />
          {showGradient ? (
            <animate
              attributeName="x1"
              values="-100%;100%"
              dur={`${gradientDurationS}s`}
              repeatCount="indefinite"
            />
          ) : null}
        </linearGradient>
      </defs>
      <BaseEdge
        id={pathId}
        path={path}
        markerEnd={markerEnd}
        style={{
          // While running, paint the edge with the sliding gradient on
          // top of the dashed stroke. Once idle/done, fall back to the
          // flat status color.
          stroke: showGradient ? `url(#${gradientId})` : stroke,
          strokeWidth,
          strokeDasharray: showDashes ? '8 6' : undefined,
          animation: showDashes ? `rb-dash ${dashDurationMs}ms linear infinite` : undefined,
          filter: data?.cyclic ? 'drop-shadow(0 0 4px rgba(239,68,68,0.55))' : undefined,
          transition: 'stroke 200ms ease',
        }}
      />
      {showComet
        ? orbs.map(orb => (
            <circle key={orb.key} r={4} fill="var(--rb-orb)">
              <animateMotion
                dur={`${orbDurationS}s`}
                repeatCount="indefinite"
                begin={`${orb.delay * (orbDurationS / ORB_DURATION_S)}s`}
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          ))
        : null}
      {showBadge ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
            style={{
              left: labelX,
              top: labelY,
              background: stroke,
            }}
            title={data!.condition}
          >
            {badgeLabel}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {selected ? <EdgeDeleteButton edgeId={id} x={labelX} y={labelY} /> : null}
    </>
  );
}

export const SmartBezierEdge = memo(SmartBezierEdgeComponent);
