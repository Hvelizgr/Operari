import type { Logger } from '../../services/logger.service';
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

export class ResumeWorker {
  constructor(
    private readonly store: ExecutionEventStore,
    private readonly logger: Logger
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

        const decision = ResumeWorker.decide(state, tenantId);
        decisions.push(decision);
        counts[decision.action]++;

        if (!dryRun && decision.action === 'ABANDON') {
          await this.abandon(decision);
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
   * The mapping from RunStatus to ResumeAction is intentionally
   * conservative: phase 3 marks every interrupted run as ABANDONED.
   * Phase 4 will flip RUNNING → RESUME once step replay is in.
   */
  static decide(state: RunState, tenantId: string): ResumeDecision {
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
      case 'RUNNING':
        return {
          ...base,
          action: 'ABANDON',
          reason:
            'run was running when backend restarted; step replay not yet implemented (phase 4)',
        };
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
