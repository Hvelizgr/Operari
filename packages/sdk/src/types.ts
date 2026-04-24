export interface CairnConfig {
  /** Your Cairn API key (starts with nr_live_ or nr_test_) */
  apiKey: string;
  /** Base URL of the Cairn API. Defaults to https://api.nanorun.dev */
  baseURL?: string;
  /** Optional fetch implementation (useful for tests or non-standard envs) */
  fetch?: typeof fetch;
}

export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PAUSED';

export interface RunbookSummary {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerOptions {
  /** Variables to inject into the runbook execution context */
  variables?: Record<string, unknown>;
}

export interface TriggerResponse {
  id: string;
  runbook: { id: string; slug: string | null; name: string };
  status: RunStatus;
  triggeredAt: string;
  url: string;
}

export interface StepLog {
  id: string;
  stepId: string;
  name: string;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  output: Record<string, unknown> | null;
  error: string | null;
}

export interface Run {
  id: string;
  runbook: { id: string; slug: string | null; name: string };
  status: RunStatus;
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  steps: StepLog[];
}

export interface AuditVerifyOptions {
  /** Start verification from this seq instead of the beginning of the chain. */
  fromSeq?: bigint | string | number;
  /** Page size used while walking the chain. Default 1000, max 10000. */
  pageSize?: number;
}

export interface AuditVerifyResult {
  tenantId: string;
  eventCount: number;
  /** True iff the chain is contiguous and every hash recomputes correctly. */
  intact: boolean;
  /**
   * Sequence number of the first event whose hash does not match the
   * recomputed value, or null if no tampering was detected. The seq is
   * returned as a string because BigInt does not survive JSON.
   */
  firstBrokenSeq: string | null;
  /**
   * Last good seq before a gap in the seq column, or null if there are
   * no gaps. A gap means a row was deleted *and* the trigger was
   * bypassed — a strong tampering signal.
   */
  firstGapAfterSeq: string | null;
  /** Server timestamp when the verification ran. */
  verifiedAt: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ResolveApprovalOptions {
  /** Optional human comment shown next to the resolution */
  comment?: string;
}

export interface ResolvedApproval {
  id: string;
  status: ApprovalStatus;
  workflowId: string;
  executionId: string;
  stepId: string;
  approvedBy: string | null;
  approvedAt: string | null;
  comment: string | null;
  /** True iff a paused execution was resumed (grant only) */
  executionResumed: boolean;
  /** True iff the execution was marked CANCELLED (reject only) */
  executionCancelled: boolean;
}

/** A single log line emitted by the runtime for a specific run. */
export interface LogEntry {
  /** Stream id, monotonic per-run. Use as the cursor for the next call. */
  id: string;
  /** Log text (stdout line, engine event, etc). */
  message: string;
  /** ISO-8601 timestamp written by the runtime at emission time. */
  timestamp: string;
  /** Optional structured fields (nodeId, nodeName, runner…). */
  metadata?: Record<string, unknown>;
}

export interface GetLogsOptions {
  /** Start cursor (inclusive). Omit to start at the beginning. */
  fromId?: string;
  /** Max entries per call. Default 1000, capped at 10000 server-side. */
  count?: number;
}

export interface GetLogsResponse {
  executionId: string;
  entries: LogEntry[];
  /** Count of entries in THIS response (not the total run log). */
  count: number;
  /** Approximate total entries in the run's stream. */
  totalApprox: number | null;
  /** Cursor to pass to the next call for pagination, or null when done. */
  nextFromId: string | null;
}

export interface TailLogsOptions {
  /** Start cursor. Defaults to '$' on the server (only NEW entries). */
  fromId?: string;
  /** Abort signal — consumer hangs up when this fires. */
  signal?: AbortSignal;
}
