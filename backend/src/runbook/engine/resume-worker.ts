import type { PrismaClient, Runbook } from '@prisma/client';

import type { ExecutionService } from '../../editor/execution/execution.service';
import type { Logger } from '../../services/logger.service';
import { applyRunbookVersionSnapshot } from '../services/runbook-version.service';
import type { ExecutionEventStore } from './execution-event.store';
import type { RunState, RunStatus } from './execution-event.types';

/**
 * ResumeWorker — startup-time scanner for in-flight execution runs
 * (ADR 0003 phase 3).
 *
 * What it does:
 *   1. Enumerate every tenant with execution events
 *   2. For each tenant, list in-flight runs (no terminal event)
 *   3. Reduce each run via the pure reducer
 *   4. Decide a `ResumeDecision` per run based on the state
 *   5. Optionally act on the decision (`dryRun: false`)
 *
 * What it does NOT do (yet — phase 4):
 *   - Replay step.completed events to reconstruct nodeOutputs and
 *     hand them to ExecutionService.runWorkflow
 *   - Re-execute steps that were started but never completed
 *   - Schedule itself on a recurring loop — this is one-shot, the
 *     caller (server.ts startup, or a cron) decides when to invoke
 *
 * Why this ships now: even without the actual resume execution, the
 * scanner is the foundation for everything that comes next. It tells
 * the operator which runs were interrupted and gives the worker a
 * single, testable place to evolve into a real resumer. Without the
 * scanner, "your run was interrupted" data lives only in `Execution`
 * status columns that the runtime no longer touches after restart.
 *
 * Decision policy
 *   PENDING   → ABANDON  (run.created seen but never started; the
 *                          backend died between create and start)
 *   RUNNING   → ABANDON  (the runtime never finished; phase 4 will
 *                          turn this into RESUME once step replay
 *                          is implemented)
 *   PAUSED    → SKIP     (waiting on a human approval; the existing
 *                          resumeExecution flow is the right path)
 *   COMPLETED → SKIP     (defensive — should not appear since
 *                          listInFlightExecutions filters terminals)
 *   FAILED    → SKIP     (same)
 *   CANCELLED → SKIP     (same)
 *
 * The "ABANDON" action appends `run.failed` with a clear "abandoned
 * by restart" message so the run terminates and stops appearing in
 * subsequent worker scans. This is honest and idempotent: re-running
 * the worker is safe because abandoned runs are now terminal.
 */

export type ResumeAction = 'ABANDON' | 'SKIP' | 'RESUME';

export interface ResumeDecision {
  executionId: string;
  tenantId: string;
  status: RunStatus;
  action: ResumeAction;
  /** Free-form reason recorded in logs and (for ABANDON) in the failure payload */
  reason: string;
  /** Last seq seen by the reducer at scan time — useful for debug */
  lastSeq: bigint;
}

export interface ResumeWorkerOptions {
  /**
   * When true (default), the worker only computes decisions and
   * returns the report — it never appends events. Operators should
   * run dryRun=true on a fresh deploy to confirm the scanner sees
   * what they expect before letting it act.
   */
  dryRun?: boolean;
  /**
   * Phase-4 feature flag. When false (default), every interrupted
   * RUNNING run is still abandoned — the conservative phase-3
   * behavior. When true, runs whose event log shows no step actively
   * executing at crash time (`inFlightSteps` empty) are replayed from
   * their last checkpoint instead. Keep it off until the operator has
   * verified the event log is stable in their environment.
   */
  replay?: boolean;
}

export interface ResumeReport {
  scannedTenants: number;
  scannedRuns: number;
  decisions: ResumeDecision[];
  counts: Record<ResumeAction, number>;
  dryRun: boolean;
  /** Wall-clock duration of the scan in ms */
  durationMs: number;
}

/**
 * Optional collaborators the worker needs for the phase-4 RESUME
 * action. Split out so callers that only want the phase-3 scanner
 * (the scan-and-abandon path) can skip constructing them.
 *
 * Both are required when `options.replay=true` is passed to runOnce.
 */
export interface ResumeWorkerDependencies {
  prisma: PrismaClient;
  executionService: ExecutionService;
}

export class ResumeWorker {
  constructor(
    private readonly store: ExecutionEventStore,
    private readonly logger: Logger,
    private readonly deps?: ResumeWorkerDependencies
  ) {}

  /**
   * Walk every tenant, scan for in-flight runs, decide what to do
   * with each. Returns a `ResumeReport` the caller can log, ship to
   * a metric, or assert on in tests.
   *
   * Idempotent: a second invocation after the first acted on every
   * decision sees no in-flight runs and returns an empty report.
   */
  async runOnce(options: ResumeWorkerOptions = {}): Promise<ResumeReport> {
    const dryRun = options.dryRun ?? true;
    const replay = options.replay ?? false;
    const startedAt = Date.now();
    const decisions: ResumeDecision[] = [];
    const counts: Record<ResumeAction, number> = { ABANDON: 0, SKIP: 0, RESUME: 0 };
    let scannedRuns = 0;

    const tenants = await this.store.listTenantsWithEvents();

    for (const tenantId of tenants) {
      const inFlight = await this.store.listInFlightExecutions(tenantId);
      for (const executionId of inFlight) {
        scannedRuns++;
        const state = await this.store.reduceState(executionId);
        if (!state) {
          // Race: the run terminated between listInFlight and
          // reduceState. Nothing to do.
          continue;
        }

        const decision = ResumeWorker.decide(state, tenantId, { replay });
        decisions.push(decision);
        counts[decision.action]++;

        if (!dryRun && decision.action === 'ABANDON') {
          await this.abandon(decision);
        }
        if (!dryRun && decision.action === 'RESUME') {
          await this.resume(decision, state);
        }
      }
    }

    const report: ResumeReport = {
      scannedTenants: tenants.length,
      scannedRuns,
      decisions,
      counts,
      dryRun,
      durationMs: Date.now() - startedAt,
    };

    this.logger.info('ResumeWorker scan complete', {
      metadata: {
        scannedTenants: report.scannedTenants,
        scannedRuns: report.scannedRuns,
        abandoned: report.counts.ABANDON,
        skipped: report.counts.SKIP,
        wouldResume: report.counts.RESUME,
        dryRun: report.dryRun,
        durationMs: report.durationMs,
      },
    });

    return report;
  }

  /**
   * Pure decision function — no I/O, no time. Exposed as `static`
   * so tests can verify the policy without standing up a store.
   *
   * Phase-3 default: every interrupted run is ABANDONED.
   * Phase-4 replay: when `opts.replay=true`, a RUNNING run whose
   * `inFlightSteps` is empty becomes RESUME (the crash landed
   * between steps, every started step had already committed a
   * terminal event, so replay is safe). A non-empty `inFlightSteps`
   * still ABANDONS because a step may have half-landed its side
   * effects (HTTP POST issued, SQL INSERT executed).
   */
  static decide(
    state: RunState,
    tenantId: string,
    opts: { replay?: boolean } = {}
  ): ResumeDecision {
    const base = {
      executionId: state.executionId,
      tenantId,
      status: state.status,
      lastSeq: state.lastSeq,
    };
    switch (state.status) {
      case 'PENDING':
        return {
          ...base,
          action: 'ABANDON',
          reason:
            'run.created seen but never started — backend likely died between create and start',
        };
      case 'RUNNING': {
        if (opts.replay && state.inFlightSteps.length === 0) {
          return {
            ...base,
            action: 'RESUME',
            reason:
              'crash landed between steps — every started step committed a terminal event, replay is safe',
          };
        }
        const why = opts.replay
          ? `step(s) ${state.inFlightSteps.join(',')} were mid-execution at crash; replay would re-issue partial side effects`
          : 'run was running when backend restarted; replay feature flag is off';
        return { ...base, action: 'ABANDON', reason: why };
      }
      case 'PAUSED':
        return {
          ...base,
          action: 'SKIP',
          reason:
            'paused waiting on human input — leave for manual resume via the existing endpoint',
        };
      case 'COMPLETED':
      case 'FAILED':
      case 'CANCELLED':
        // Defensive: listInFlightExecutions should filter these.
        return {
          ...base,
          action: 'SKIP',
          reason: `terminal status ${state.status} appeared in in-flight scan — likely a race, no action needed`,
        };
    }
  }

  /**
   * Phase-4 resume. Loads the Execution row, resolves the frozen
   * RunbookVersion snapshot it was dispatched against (falling back
   * to the current Runbook row for pre-A1 rows), and hands the
   * reconstructed checkpoint to `ExecutionService.resumeFromEventLog`.
   *
   * Like `abandon`, this is best-effort. On any failure the decision
   * is downgraded to ABANDON so the run terminates — leaving a run
   * flagged RESUME but never actually resumed creates a ghost that
   * shows up in every subsequent scan.
   */
  private async resume(decision: ResumeDecision, state: RunState): Promise<void> {
    if (!this.deps) {
      this.logger.error('ResumeWorker RESUME action requires prisma + executionService deps', {
        metadata: { executionId: decision.executionId },
      });
      await this.abandon({
        ...decision,
        reason: 'resume requested but worker lacks deps — falling back to abandon',
      });
      return;
    }
    const { prisma, executionService } = this.deps;

    try {
      const execution = await prisma.execution.findUnique({
        where: { id: decision.executionId },
        include: { workflow: true, runbookVersion: true },
      });
      if (!execution || !execution.workflow) {
        throw new Error(`Execution ${decision.executionId} has no workflow — cannot resume`);
      }

      // Walk the frozen snapshot when this run was pinned to one
      // (post-A1); the current Runbook row is the fallback path for
      // historical rows. `applyRunbookVersionSnapshot` returns a new
      // object so the Runbook row itself is never mutated.
      const effectiveWorkflow: Runbook = execution.runbookVersion
        ? applyRunbookVersionSnapshot(execution.workflow, execution.runbookVersion.snapshot)
        : execution.workflow;

      // Union everything that must not re-execute: successful,
      // skipped, and failed steps. Failed steps had a terminal event
      // already; re-running them would double-fire the failure side
      // effects the engine dispatched before (onErrorRunbook, alerts).
      const completedNodeIds = Array.from(
        new Set([...state.completedSteps, ...state.skippedSteps, ...state.failedSteps])
      );

      await executionService.resumeFromEventLog({
        executionId: decision.executionId,
        workflow: effectiveWorkflow,
        completedNodeIds,
        nodeOutputs: state.completedStepOutputs,
        userId: execution.userId,
        tenantId: execution.tenantId,
      });
    } catch (err) {
      this.logger.error('ResumeWorker resume failed — downgrading to abandon', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: { executionId: decision.executionId, tenantId: decision.tenantId },
      });
      await this.abandon({
        ...decision,
        reason: `resume failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    }
  }

  /**
   * Append a `run.failed` event with the abandon reason so the run
   * is terminal and stops showing up in future scans. Best-effort:
   * if the append throws, the worker logs but does not retry — the
   * next worker invocation will see the run again and try again.
   */
  private async abandon(decision: ResumeDecision): Promise<void> {
    try {
      await this.store.append(decision.executionId, decision.tenantId, {
        type: 'run.failed',
        payload: {
          durationMs: 0,
          errorCode: 'RUN_ABANDONED_BY_RESTART',
          errorMessage: decision.reason,
        },
      });
    } catch (err) {
      this.logger.error('ResumeWorker abandon append failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: {
          executionId: decision.executionId,
          tenantId: decision.tenantId,
        },
      });
    }
  }
}
