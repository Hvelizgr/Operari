'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo, useMemo } from 'react';

import { FLOW_SPEED_MULT, useVisualization } from '@/context/VisualizationContext';
import type { RfEdge } from '@/lib/canvas/adapter';

import { EdgeDeleteButton } from './EdgeDeleteButton';
import { EdgeInsertButton } from './EdgeInsertButton';
import { isRunning, resolveEdgeStroke } from './edgeStyle';
import { useEdgeSourceDisabled, useSourceIsMultiOutput } from './useEdgeSourceDisabled';

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
    source,
    target,
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
  // Disabled-source propagation: if the source step is disabled the
  // edge mutes + dashes automatically. n8n parity, derived from node
  // state — no per-edge config knob to forget to toggle.
  const sourceDisabled = useEdgeSourceDisabled(source);
  const sourceMultiOutput = useSourceIsMultiOutput(source);
  // Last-run overlay: edges that didn't fire last run (`skipped`
  // status) fade so the operator's eye lands on the path that
  // actually executed. Always on — `skipped` is set by the engine
  // explicitly, so an idle/never-run edge stays at full opacity.
  const skippedLastRun = data?.status === 'skipped';
  // "Taken last" branch badge: the winning output of an IF / Switch
  // gets a small chip mid-edge so a post-mortem reads "this branch
  // fired" without opening the run timeline. Only renders for
  // multi-output sources whose status flipped to success.
  const branchTakenBadge = sourceMultiOutput && data?.status === 'success';

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.4,
  });

  const stroke = sourceDisabled ? 'var(--rb-edge-disabled)' : resolveEdgeStroke(data);
  // Killing the running animation when the source is disabled avoids
  // a confusing "muted edge with comet" state during a half-run.
  const isRunningRaw = isRunning(data) && !sourceDisabled;
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
        markerEnd={sourceDisabled ? undefined : markerEnd}
        style={{
          // While running, paint the edge with the sliding gradient on
          // top of the dashed stroke. Once idle/done, fall back to the
          // flat status color. Source-disabled wins over everything: a
          // permanent dash + reduced opacity tells the operator the
          // upstream step won't fire, so this edge is dead weight.
          stroke: showGradient ? `url(#${gradientId})` : stroke,
          strokeWidth,
          strokeDasharray: sourceDisabled ? '4 4' : showDashes ? '8 6' : undefined,
          animation:
            !sourceDisabled && showDashes
              ? `rb-dash ${dashDurationMs}ms linear infinite`
              : undefined,
          opacity: sourceDisabled ? 0.45 : skippedLastRun ? 0.25 : undefined,
          filter: data?.cyclic ? 'drop-shadow(0 0 4px rgba(239,68,68,0.55))' : undefined,
          transition: 'stroke 200ms ease, opacity 200ms ease',
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
      {branchTakenBadge ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white shadow"
            style={{
              left: labelX,
              top: labelY - 14,
              background: 'var(--rb-edge-success)',
            }}
            title="This branch was taken in the most recent run"
          >
            taken
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {selected ? <EdgeDeleteButton edgeId={id} x={labelX} y={labelY} /> : null}
      {/* Mid-edge insert affordance — hover-only via CSS. The button is
          always mounted so the click target is hot the moment the
          operator's mouse lands; visibility flips through the
          `.rb-edge-insert-trigger` opacity rule in globals.css. */}
      {!sourceDisabled ? (
        <EdgeInsertButton edgeId={id} sourceId={source} targetId={target} x={labelX} y={labelY} />
      ) : null}
    </>
  );
}

export const SmartBezierEdge = memo(SmartBezierEdgeComponent);
