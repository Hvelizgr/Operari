import type { RfEdgeData } from '@/lib/canvas/adapter';

type Status = NonNullable<RfEdgeData['status']>;
type Condition = NonNullable<RfEdgeData['condition']>;

const STATUS_VAR: Record<Status, string> = {
  idle: 'var(--rb-edge)',
  running: 'var(--rb-edge-running)',
  'yet-to-run': 'var(--rb-edge-yet-to-run)',
  success: 'var(--rb-edge-success)',
  failed: 'var(--rb-edge-failed)',
  skipped: 'var(--rb-edge-skipped)',
};

const CONDITION_VAR: Record<Condition, string> = {
  complete: 'var(--rb-edge)',
  success: 'var(--rb-edge-success)',
  error: 'var(--rb-edge-failed)',
  warning: 'var(--rb-edge-warning)',
  disabled: 'var(--rb-edge-disabled)',
};

export const resolveEdgeStroke = (data: RfEdgeData | undefined): string => {
  if (data?.cyclic) return 'var(--rb-edge-cyclic)';
  if (data?.status && data.status !== 'idle') return STATUS_VAR[data.status];
  if (data?.condition) return CONDITION_VAR[data.condition];
  return 'var(--rb-edge)';
};

/** Active animation while data is in flight (orb + dash). Yet-to-run
 *  edges get the soft brightness but not the full motion — the
 *  operator should be able to tell the difference between "currently
 *  flowing" and "about to flow". */
export const isRunning = (data: RfEdgeData | undefined): boolean => data?.status === 'running';

export const isYetToRun = (data: RfEdgeData | undefined): boolean => data?.status === 'yet-to-run';

/**
 * Compact ms formatter for edge chips. Mirrors the shape used inside
 * BaseStepNode (`shortFormat`) so the operator sees the same units in
 * both places. Kept local to edges/ to avoid pulling in the larger
 * timer module — this is one branch + one rounding step.
 */
export const formatEdgeDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${Math.round(ms / 60_000)}m`;
};
