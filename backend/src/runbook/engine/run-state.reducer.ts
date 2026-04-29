import type {
  ExecutionEventType,
  RunCompletedPayload,
  RunCreatedPayload,
  RunFailedPayload,
  RunPausedPayload,
  RunState,
  RunStatus,
  StepCompletedPayload,
  StepFailedPayload,
  StepSkippedPayload,
} from './execution-event.types';

/**
 * One row in the in-memory representation of an `ExecutionEvent`.
 * The reducer accepts this shape (rather than the Prisma row type)
 * so it stays decoupled from `@prisma/client` and can be tested
 * without a database.
 */
export interface ReplayableEvent {
  seq: bigint;
  type: ExecutionEventType | string;
  nodeId?: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * Pure function: walk a sequence of execution events for a single
 * run and produce the current `RunState`. Used by the worker at
 * startup to figure out which runs need resuming and from where.
 *
 * Determinism contract:
 *   - Events MUST be supplied in seq order. The reducer trusts the
 *     caller; it does not re-sort.
 *   - Same input → same output, no time-based mutation, no I/O.
 *   - Unknown event types are ignored (forward compatibility).
 *
 * Status precedence — once a terminal state is reached
 * (COMPLETED / FAILED / CANCELLED), later events do not change it.
 * This matches the runtime: the worker stops emitting events for a
 * terminated run.
 */
export function reduceRunState(executionId: string, events: ReplayableEvent[]): RunState {
  const state: RunState = {
    executionId,
    status: 'PENDING',
    runbookId: null,
    workflowName: null,
    trigger: null,
    stepCount: 0,
    completedSteps: [],
    failedSteps: [],
    skippedSteps: [],
    completedStepOutputs: {},
    inFlightSteps: [],
    pausedAt: null,
    errorMessage: null,
    durationMs: null,
    lastSeq: 0n,
  };

  for (const event of events) {
    if (event.seq > state.lastSeq) {
      state.lastSeq = event.seq;
    }

    if (RunStatePrecedence.isTerminal(state.status)) {
      // Skip events that arrive after a terminal transition.
      // Should not happen in practice but defends against
      // out-of-order writes.
      continue;
    }

    applyEvent(state, event);
  }

  return state;
}

function applyEvent(state: RunState, event: ReplayableEvent): void {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  switch (event.type) {
    case 'run.created': {
      const p = payload as unknown as RunCreatedPayload;
      state.runbookId = p.runbookId ?? null;
      state.workflowName = p.workflowName ?? null;
      state.trigger = p.trigger ?? null;
      // status stays PENDING until run.started
      return;
    }
    case 'run.started': {
      state.status = 'RUNNING';
      return;
    }
    case 'run.paused': {
      const p = payload as unknown as RunPausedPayload;
      state.status = 'PAUSED';
      state.pausedAt = p.pausedAtNodeId ?? null;
      return;
    }
    case 'run.resumed': {
      state.status = 'RUNNING';
      state.pausedAt = null;
      return;
    }
    case 'run.completed': {
      const p = payload as unknown as RunCompletedPayload;
      state.status = 'COMPLETED';
      state.durationMs = p.durationMs ?? null;
      return;
    }
    case 'run.failed': {
      const p = payload as unknown as RunFailedPayload;
      state.status = 'FAILED';
      state.durationMs = p.durationMs ?? null;
      state.errorMessage = p.errorMessage ?? null;
      return;
    }
    case 'run.cancelled': {
      state.status = 'CANCELLED';
      return;
    }
    case 'step.queued': {
      return;
    }
    case 'step.started': {
      // Mark the step as actively executing. We remove it from
      // inFlightSteps when a matching step.completed / .failed /
      // .skipped lands — anything still here at scan time was
      // interrupted mid-execution and cannot be safely replayed.
      if (event.nodeId) state.inFlightSteps.push(event.nodeId);
      return;
    }
    case 'step.completed': {
      const p = payload as unknown as StepCompletedPayload;
      state.stepCount++;
      if (event.nodeId) {
        state.completedSteps.push(event.nodeId);
        removeFromList(state.inFlightSteps, event.nodeId);
        // Capture the output so the resume path can hand it to the
        // downstream nodes instead of re-executing this predecessor.
        if (p.output !== undefined) {
          state.completedStepOutputs[event.nodeId] = p.output;
        }
      }
      return;
    }
    case 'step.failed': {
      const p = payload as unknown as StepFailedPayload;
      state.stepCount++;
      if (event.nodeId) {
        state.failedSteps.push(event.nodeId);
        removeFromList(state.inFlightSteps, event.nodeId);
      }
      // The run.failed event records the canonical error; we do
      // not promote a step.failed to a terminal state on its own
      // because retryable errors might still recover.
      void p;
      return;
    }
    case 'step.skipped': {
      const p = payload as unknown as StepSkippedPayload;
      state.stepCount++;
      if (event.nodeId) {
        state.skippedSteps.push(event.nodeId);
        removeFromList(state.inFlightSteps, event.nodeId);
      }
      void p;
      return;
    }
    default:
      // Unknown event type — forward-compat, ignore.
      return;
  }
}

const RunStatePrecedence = {
  isTerminal(status: RunStatus): boolean {
    return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
  },
} as const;

function removeFromList(list: string[], value: string): void {
  const idx = list.indexOf(value);
  if (idx !== -1) list.splice(idx, 1);
}
