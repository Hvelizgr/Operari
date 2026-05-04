/**
 * Closed discriminated union for the durable execution event log.
 *
 * The DB stores `type` as a free-form string and `payload` as JSON,
 * but every code path that produces or consumes events MUST go
 * through this union so we can:
 *
 *   - Grep for every place that emits a given variant
 *   - Catch shape regressions at type-check time
 *   - Refactor variant fields with confidence
 *
 * Adding a variant: append it here, add a corresponding case in
 * `runStateReducer`, add a test in `__tests__/runbook/engine/`.
 *
 * REMOVING a variant is a breaking change for any historical row
 * already in `ExecutionEvent` — handle it with a `seq` cutoff or a
 * migration that rewrites old payloads.
 */

export type ExecutionEventType =
  | 'run.created'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.paused'
  | 'run.resumed'
  | 'run.cancelled'
  | 'step.queued'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.skipped';

export interface RunCreatedPayload {
  runbookId: string;
  workflowName: string;
  trigger: string;
  startNodeId?: string | null;
  userId?: string | null;
}

export interface RunStartedPayload {
  /** Wall-clock when the runtime actually picked the run off the queue */
  startedAt: string;
}

export interface RunCompletedPayload {
  durationMs: number;
  nodesExecuted: number;
}

export interface RunFailedPayload {
  durationMs: number;
  errorCode?: string | null;
  errorMessage: string;
  failedAtNodeId?: string | null;
}

export interface RunPausedPayload {
  pausedAtNodeId: string;
  pausedAtNodeType?: string;
}

export interface RunResumedPayload {
  resumedFromNodeId?: string;
  actorId?: string | null;
}

export interface RunCancelledPayload {
  cancelledByActorId?: string | null;
  cancelledAt: string;
  /** How many in-flight runner processes the cancel signalled */
  signalledProcesses?: number;
}

export interface StepQueuedPayload {
  nodeName: string;
  nodeType: string;
}

export interface StepStartedPayload {
  nodeName: string;
  nodeType: string;
  startedAt: string;
}

export interface StepCompletedPayload {
  nodeName: string;
  nodeType: string;
  durationMs: number;
  /**
   * Output of the node, JSON-serialisable. Stored so the reducer
   * can hand it to downstream nodes during replay.
   */
  output?: unknown;
}

export interface StepFailedPayload {
  nodeName: string;
  nodeType: string;
  durationMs: number;
  errorCode?: string | null;
  errorMessage: string;
}

export interface StepSkippedPayload {
  nodeName: string;
  nodeType: string;
  reason: string;
}

export interface StepRetryPayload {
  /** 1-indexed attempt number that just slept and is about to fire. */
  attempt: number;
  /** Total retry budget (count from the policy; not including the
   *  first attempt). When attempt === maxAttempts the engine has
   *  burned the last retry. */
  maxAttempts: number;
  /** Wait that elapsed before this attempt. */
  delayMs: number;
  /** Resolved backoff strategy ('fixed' | 'exponential'). */
  backoff: 'fixed' | 'exponential';
  /** Error code that triggered the retry, if classified. */
  errorCode?: string | null;
}

/**
 * Discriminated union mapping each variant to its payload. Used by
 * the service so callers must supply the right payload for the
 * declared `type` — the compiler refuses mismatches at the call site.
 */
export type ExecutionEventPayload =
  | { type: 'run.created'; payload: RunCreatedPayload; nodeId?: undefined }
  | { type: 'run.started'; payload: RunStartedPayload; nodeId?: undefined }
  | { type: 'run.completed'; payload: RunCompletedPayload; nodeId?: undefined }
  | { type: 'run.failed'; payload: RunFailedPayload; nodeId?: undefined }
  | { type: 'run.paused'; payload: RunPausedPayload; nodeId?: undefined }
  | { type: 'run.resumed'; payload: RunResumedPayload; nodeId?: undefined }
  | { type: 'run.cancelled'; payload: RunCancelledPayload; nodeId?: undefined }
  | { type: 'step.queued'; payload: StepQueuedPayload; nodeId: string }
  | { type: 'step.started'; payload: StepStartedPayload; nodeId: string }
  | { type: 'step.completed'; payload: StepCompletedPayload; nodeId: string }
  | { type: 'step.failed'; payload: StepFailedPayload; nodeId: string }
  | { type: 'step.skipped'; payload: StepSkippedPayload; nodeId: string }
  | { type: 'step.retry'; payload: StepRetryPayload; nodeId: string };

/**
 * The reduced state of a run after walking every event in seq order.
 * The runtime worker uses this to decide whether the run is finished,
 * waiting on an approval, ready to advance to the next step, or stuck.
 */
export type RunStatus =
  | 'PENDING' // run.created seen, run.started not yet
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface RunState {
  executionId: string;
  status: RunStatus;
  runbookId: string | null;
  workflowName: string | null;
  trigger: string | null;
  /** Number of step events seen, regardless of outcome */
  stepCount: number;
  /** Subset of step events that completed successfully */
  completedSteps: string[];
  /** Subset of step events that failed */
  failedSteps: string[];
  /** Subset of step events that were skipped */
  skippedSteps: string[];
  /**
   * Outputs captured from each `step.completed` event, keyed by
   * nodeId. Used by the phase-4 resume path to reseed the downstream
   * engine with what each completed step produced, so steps that
   * merge multiple parents still get their real inputs instead of
   * re-running an already-committed predecessor.
   */
  completedStepOutputs: Record<string, unknown>;
  /**
   * Steps that emitted `step.started` but never a matching
   * `step.completed` / `step.failed` / `step.skipped`. These are the
   * ones that were actively executing when the backend crashed — the
   * engine cannot resume them safely because their side effects may
   * have partially landed (HTTP POST issued, SQL INSERT executed).
   * The resume worker policy keys on this: empty → safe to replay,
   * non-empty → abandon.
   */
  inFlightSteps: string[];
  /** node id where the run is paused, if PAUSED */
  pausedAt: string | null;
  /** Final error message if the run is FAILED */
  errorMessage: string | null;
  /** Wall-clock duration of the run if it terminated, ms */
  durationMs: number | null;
  /** Last event seq seen by the reducer */
  lastSeq: bigint;
}
