export interface CairnConfig {
  /** Your Cairn API key (starts with nr_live_ or nr_test_) */
  apiKey: string;
  /** Base URL of the Cairn API. Defaults to https://api.nanorun.dev */
  baseURL?: string;
  /** Optional fetch implementation (useful for tests or non-standard envs) */
  fetch?: typeof fetch;
}

/** @deprecated use {@link CairnConfig} */
export type NanoRunConfig = CairnConfig;

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
