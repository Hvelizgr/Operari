'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { Lock, Repeat } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { RfEdge } from '@/lib/canvas/adapter';

import { EdgeDeleteButton } from './EdgeDeleteButton';
import { EdgeInsertButton } from './EdgeInsertButton';
import { formatEdgeDuration, isRunning, resolveEdgeStroke } from './edgeStyle';
import {
  useEdgeSourceDisabled,
  useSourceIsMultiOutput,
  useTargetIsHaltPoint,
} from './useEdgeSourceDisabled';

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
  const sourceDisabled = useEdgeSourceDisabled(source);
  const sourceMultiOutput = useSourceIsMultiOutput(source);
  const targetIsHaltPoint = useTargetIsHaltPoint(target);
  const skippedLastRun = data?.status === 'skipped';
  const branchTakenBadge = sourceMultiOutput && data?.status === 'success';
  const retryCount = data?.retries ?? 0;
  const crossEnv = data?.crossEnv;
  const itemCount = data?.items ?? 0;
  const p50 = data?.p50DurationMs;

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

  const stroke = sourceDisabled
    ? 'var(--rb-edge-disabled)'
    : targetIsHaltPoint && data?.status !== 'running' && data?.status !== 'failed'
      ? 'var(--op-gold, #f5b945)'
      : resolveEdgeStroke(data);
  const running = isRunning(data) && !sourceDisabled;
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
        markerEnd={sourceDisabled ? undefined : markerEnd}
        // Invisible 40px-wide interaction zone so the 2px stroke is
        // not the actual hit target (n8n parity).
        interactionWidth={40}
        style={{
          stroke: running ? `url(#${gradientId})` : stroke,
          strokeWidth,
          strokeDasharray: sourceDisabled ? '4 4' : running ? '8 6' : undefined,
          animation: !sourceDisabled && running ? 'rb-dash 800ms linear infinite' : undefined,
          opacity: sourceDisabled ? 0.45 : skippedLastRun ? 0.25 : undefined,
          filter: data?.cyclic ? 'drop-shadow(0 0 4px rgba(239,68,68,0.55))' : undefined,
          transition: 'stroke 200ms ease, opacity 200ms ease',
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
      {!sourceDisabled ? (
        <EdgeInsertButton edgeId={id} sourceId={source} targetId={target} x={labelX} y={labelY} />
      ) : null}
      {targetIsHaltPoint && !sourceDisabled ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow"
            style={{
              left: targetX - (targetX - sourceX) * 0.08,
              top: targetY - (targetY - sourceY) * 0.08,
              background: 'var(--op-gold, #f5b945)',
            }}
            title="Connection enters a halt-point — runs pause here for an external signal"
          >
            <Lock size={11} />
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {retryCount > 0 ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[9px] text-amber-200 shadow"
            style={{ left: labelX, top: labelY + 18 }}
            title={`This hop retried ${retryCount}× during the most recent run`}
          >
            <Repeat size={10} />×{retryCount}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {crossEnv ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[9px] text-amber-200 shadow"
            style={{ left: labelX, top: labelY - 28 }}
            title={`Crosses environments — ${crossEnv.source} → ${crossEnv.target}`}
          >
            <span>{crossEnv.source}</span>
            <span className="text-white/60">→</span>
            <span>{crossEnv.target}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {itemCount > 0 ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-emerald-700/85 px-2 py-0.5 font-mono text-[9px] text-white shadow"
            style={{ left: labelX, top: labelY + 32 }}
            title={
              p50 != null
                ? `${itemCount} item${itemCount === 1 ? '' : 's'} · p50 ${formatEdgeDuration(p50)}`
                : `${itemCount} item${itemCount === 1 ? '' : 's'} processed last run`
            }
          >
            <span>{itemCount}</span>
            {p50 != null ? (
              <span className="text-white/70">· {formatEdgeDuration(p50)}</span>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const SmartStepEdge = memo(SmartStepEdgeComponent);
