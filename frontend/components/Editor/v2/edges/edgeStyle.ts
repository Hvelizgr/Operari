import type { RfEdgeData } from '@/lib/canvas/v2/adapter';

type Status = NonNullable<RfEdgeData['status']>;
type Condition = NonNullable<RfEdgeData['condition']>;

const STATUS_VAR: Record<Status, string> = {
  idle: 'var(--rb-edge)',
  running: 'var(--rb-edge-running)',
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

export const isRunning = (data: RfEdgeData | undefined): boolean => data?.status === 'running';
