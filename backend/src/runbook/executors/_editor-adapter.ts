import type { EditorNodeExecutor } from '../../editor/nodes/_shared';
import type { ExecutionInput } from '../../types/runbook.types';
import type { ExecutorContext, ExecutorResult, StepExecutor } from '../types/executor.types';

/**
 * Wraps an EditorNodeExecutor so it can be served from the unified
 * StepExecutor registry.
 *
 * The runbook engine speaks `ExecutorContext` end-to-end; legacy editor
 * executors speak `(input, errorContext, tenantId, executionId)`. This
 * shim translates one direction at runtime so the dispatcher in
 * `NodeExecutor` can do a single `registry.get(...)` instead of trying
 * the runbook side first and falling through to a separate editor
 * registry.
 *
 * What it does NOT do: pre-resolve `{{secrets.<id>}}` references. The
 * editor template engine never knew how to read secrets, and emitting
 * audit events for refs that resolve to the empty string would be a
 * lie about what was actually accessed. The dispatcher detects an
 * editor-wrapped executor via `instanceof EditorExecutorAdapter` and
 * skips secret resolution accordingly.
 *
 * Why a single adapter instead of one-rewrite-per-executor (per
 * ADR 0004's first sketch): the input shape difference (`previousOutputs`
 * vs flat dict) is bridgeable mechanically — every editor executor
 * already merges variables and previousOutputs implicitly because the
 * old dispatcher passed the same input to both. The "real rewrites"
 * the ADR called for (`transform`, `condition`, `storeGet/Set`) only
 * matter for semantic clarity, not for behaviour. Deferring those
 * rewrites until ADR 0003 phase 4 lands avoids touching the same files
 * twice.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EditorExecutorAdapter<TConfig = any> implements StepExecutor<TConfig> {
  readonly type: string;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly inner: EditorNodeExecutor<TConfig, any>
  ) {
    this.type = inner.type;
  }

  async execute(config: TConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();

    // Dry-run short-circuit. Native executors (shell, http, notify,
    // approval, wait, database) check `context.dryRun` themselves and
    // return a synthetic `{ dryRun: true, ... }` result. The legacy
    // EditorNodeExecutor interface predates dry-run and never reads it —
    // so without this guard, an Email/HttpNode/StoreSet on the canvas
    // would fire its real side effect during a "Simulación" run.
    //
    // Skipping at the adapter is correct (and simpler than retrofitting
    // 15 legacy executors): the editor side has no per-executor dry-run
    // semantics to preserve, and ADR 0004 will fold this branch into
    // the native registry where the per-executor checks already live.
    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would execute ${this.type} (legacy editor node)`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          type: this.type,
          skipped: 'legacy-editor-executor',
        },
        duration: Date.now() - startTime,
      };
    }

    // Editor executors take a flat ExecutionInput dict. The legacy
    // dispatcher in NodeExecutor.tryRunbookExecutor passed the same
    // `input` object to both context.variables and context.previousOutputs,
    // so picking either is equivalent for behavioural compatibility.
    // Using previousOutputs preserves the "what the previous step
    // returned" semantics that editor executors were written against.
    const input = context.previousOutputs as ExecutionInput;

    // NodeErrorContext exists to populate NodeExecutionError when an
    // executor throws. The runbook engine doesn't carry the human node
    // title through ExecutorContext, so we lose the friendly name and
    // fall back to the type. Acceptable: the dispatcher catches the
    // resulting ExecutorResult.error and re-wraps with the real
    // node.title from its own scope before throwing upstream.
    const errorContext = {
      nodeId: context.stepId,
      nodeName: this.type,
      nodeType: this.type,
    };

    // Editor executors throw rich error types (NodeExecutionError with
    // a specific ErrorCode, HttpError, ExternalServiceError, ...) that
    // upstream tests and callers match on. We deliberately do NOT
    // catch-and-coerce to ExecutorResult.success=false here — that
    // would flatten every thrown error into a generic
    // NODE_EXECUTION_FAILED string when the dispatcher re-wraps,
    // hiding the original code. Letting the throw propagate preserves
    // the legacy semantics one-to-one.
    const result = await this.inner.execute(
      config,
      input,
      errorContext,
      context.tenantId,
      context.runId
    );

    // SuspendNodeExecutor signals pause via `{ isSuspended: true }`
    // in its result. Translate to the canonical ExecutorResult.paused
    // flag so the engine handles it identically to ApprovalExecutor's
    // pause path.
    const paused = (result as Record<string, unknown> | null)?.isSuspended === true;

    return {
      success: true,
      output: (result as Record<string, unknown>) ?? {},
      ...(paused ? { paused: true } : {}),
      duration: Date.now() - startTime,
    };
  }
}
