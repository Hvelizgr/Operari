'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { memo, useMemo } from 'react';

import type { RfEdge } from '@/lib/canvas/adapter';

import { EdgeDeleteButton } from './EdgeDeleteButton';
import { isRunning, resolveEdgeStroke } from './edgeStyle';

/**
 * Orthogonal step edge: same status / animation language as
 * SmartBezierEdge, but with subway-map routing. Useful for dense
 * runbooks where bezier curves slice through node boxes and become
 * unreadable. The line-style toggle in the toolbar swaps both edge
 * types at the canvas level via `defaultEdgeOptions`.
 */

const CONDITION_BADGE_LABEL: Record<NonNullable<RfEdge['data']>['condition'] & string, string> = {
  complete: '',
  success: '✓',
  error: '✗',
  warning: '!',
  disabled: '–',
};

const ORB_COUNT = 2;
const ORB_DURATION_S = 1.6;

function SmartStepEdgeComponent(props: EdgeProps<RfEdge>) {
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

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
    offset: 16,
  });

  const stroke = resolveEdgeStroke(data);
  const running = isRunning(data);
  const strokeWidth = selected ? 3 : data?.cyclic ? 2.5 : 2;

  const badgeLabel = data?.condition ? CONDITION_BADGE_LABEL[data.condition] : '';
  const showBadge = badgeLabel && data?.condition && data.condition !== 'complete';

  const gradientId = `rb-flow-step-${id}`;
  const pathId = `rb-step-path-${id}`;

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
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
          <stop offset="50%" stopColor={stroke} stopOpacity={1} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0.2} />
          {running ? (
            <animate attributeName="x1" values="-100%;100%" dur="1.6s" repeatCount="indefinite" />
          ) : null}
        </linearGradient>
      </defs>
      <BaseEdge
        id={pathId}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: running ? `url(#${gradientId})` : stroke,
          strokeWidth,
          strokeDasharray: running ? '8 6' : undefined,
          animation: running ? 'rb-dash 800ms linear infinite' : undefined,
          filter: data?.cyclic ? 'drop-shadow(0 0 4px rgba(239,68,68,0.55))' : undefined,
          transition: 'stroke 200ms ease',
        }}
      />
      {running
        ? orbs.map(orb => (
            <circle key={orb.key} r={4} fill="var(--rb-orb)">
              <animateMotion
                dur={`${ORB_DURATION_S}s`}
                repeatCount="indefinite"
                begin={`${orb.delay}s`}
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

export const SmartStepEdge = memo(SmartStepEdgeComponent);
