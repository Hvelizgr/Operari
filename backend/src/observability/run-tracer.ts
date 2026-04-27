import { Context, context as otelContext, Span, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * RunTracer — maps Operari runs and steps onto OpenTelemetry traces.
 *
 * The model Operari exposes to operators is the one
 * `IMPLEMENTACION_NANORUN.md` P1 #10 specifies:
 *
 *   run  = trace
 *   step = span (child of the run trace)
 *
 * Span attributes (stable contract — dashboards depend on these):
 *
 *   runbook.id           string  (workflow id)
 *   runbook.name         string  (workflow name, free-form)
 *   tenant.id            string
 *   runner.type          string  (local | docker | fly)
 *   trigger              string  (manual | webhook | schedule | api)
 *   step.id              string
 *   step.type            string  (HTTP | Email | shell | …)
 *   step.name            string
 *   step.success         bool
 *   step.duration_ms     number
 *
 * Why a wrapper instead of calling the OTel API directly:
 *   - The OTel API requires holding onto the active context to create
 *     child spans. Operari runs are async event loops, not function
 *     stacks; this class keeps the per-run context in a Map so step
 *     spans land under the correct trace without polluting AsyncLocalStorage.
 *   - Tests can swap a fake tracer at the singleton boundary without
 *     standing up an exporter.
 *   - When tracing is disabled (no SDK registered), the OTel API
 *     returns no-op spans automatically — every method here is a free
 *     call. We do not gate on `process.env.ENABLE_TRACING` because the
 *     SDK does that for us in `config/tracing.config.ts`.
 */

export interface StartRunInput {
  runId: string;
  runbookId: string;
  runbookName: string;
  tenantId: string;
  trigger: string;
  runnerType?: string;
}

export interface StartStepInput {
  runId: string;
  stepId: string;
  stepName: string;
  stepType: string;
}

interface ActiveRun {
  span: Span;
  context: Context;
  runnerType?: string;
}

interface ActiveStep {
  span: Span;
  startedAt: number;
}

const TRACER_NAME = 'operari.runs';

export class RunTracer {
  private readonly activeRuns = new Map<string, ActiveRun>();
  /** Step keys are `${runId}:${stepId}` to avoid collisions across runs. */
  private readonly activeSteps = new Map<string, ActiveStep>();

  constructor(private readonly tracer = trace.getTracer(TRACER_NAME)) {}

  /**
   * Start a trace for a run. The returned span is the root span for
   * every step in the run. Call `endRun(runId, ...)` exactly once
   * when the run terminates (success, failure, or cancel).
   */
  startRun(input: StartRunInput): void {
    if (this.activeRuns.has(input.runId)) {
      // Defensive: a run can only be started once. Replays use a
      // different run id so this should never collide in practice.
      return;
    }
    const span = this.tracer.startSpan(`run:${input.runbookName}`, {
      attributes: {
        'operari.run.id': input.runId,
        'runbook.id': input.runbookId,
        'runbook.name': input.runbookName,
        'tenant.id': input.tenantId,
        trigger: input.trigger,
        ...(input.runnerType ? { 'runner.type': input.runnerType } : {}),
      },
    });
    const ctx = trace.setSpan(otelContext.active(), span);
    this.activeRuns.set(input.runId, {
      span,
      context: ctx,
      runnerType: input.runnerType,
    });
  }

  /**
   * End the run trace. Status is set from `success`; on failure the
   * span records the error message and `errorCode`. Idempotent — a
   * second call for the same runId is a no-op so cancel-after-finish
   * does not double-end.
   */
  endRun(runId: string, success: boolean, error?: { message?: string; code?: string }): void {
    const active = this.activeRuns.get(runId);
    if (!active) return;
    if (success) {
      active.span.setStatus({ code: SpanStatusCode.OK });
    } else {
      active.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error?.message,
      });
      if (error?.code) {
        active.span.setAttribute('error.code', error.code);
      }
      if (error?.message) {
        active.span.setAttribute('error.message', error.message);
      }
    }
    active.span.end();
    this.activeRuns.delete(runId);
    // Defensive cleanup: any leftover step spans for this run get
    // ended so they do not leak into the next trace.
    for (const key of this.activeSteps.keys()) {
      if (key.startsWith(`${runId}:`)) {
        const step = this.activeSteps.get(key)!;
        step.span.setStatus({ code: SpanStatusCode.UNSET });
        step.span.end();
        this.activeSteps.delete(key);
      }
    }
  }

  /**
   * Start a child span for a step under the run's trace context. If
   * the run was never started, the step span is created at the root
   * of a fresh trace — better than dropping the data, and exporters
   * will surface it as an orphan that points at the dispatcher bug.
   */
  startStep(input: StartStepInput): void {
    const key = RunTracer.stepKey(input.runId, input.stepId);
    if (this.activeSteps.has(key)) return; // defensive

    const parent = this.activeRuns.get(input.runId);
    const ctx = parent?.context ?? otelContext.active();
    const span = this.tracer.startSpan(
      `step:${input.stepType}:${input.stepName}`,
      {
        attributes: {
          'operari.run.id': input.runId,
          'step.id': input.stepId,
          'step.name': input.stepName,
          'step.type': input.stepType,
        },
      },
      ctx
    );
    this.activeSteps.set(key, { span, startedAt: Date.now() });
  }

  /**
   * End a step span. Records duration in ms and the success bool as
   * attributes so exporters can graph step success rates without
   * needing to walk the span status enum.
   */
  endStep(
    runId: string,
    stepId: string,
    success: boolean,
    error?: { message?: string; code?: string }
  ): void {
    const key = RunTracer.stepKey(runId, stepId);
    const active = this.activeSteps.get(key);
    if (!active) return;
    const durationMs = Date.now() - active.startedAt;
    active.span.setAttribute('step.success', success);
    active.span.setAttribute('step.duration_ms', durationMs);
    if (success) {
      active.span.setStatus({ code: SpanStatusCode.OK });
    } else {
      active.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error?.message,
      });
      if (error?.code) active.span.setAttribute('error.code', error.code);
      if (error?.message) active.span.setAttribute('error.message', error.message);
    }
    active.span.end();
    this.activeSteps.delete(key);
  }

  /**
   * Test/diagnostics helper: how many runs and steps are currently
   * tracked. A non-zero leftover after a run completes is a bug.
   */
  get inFlightCount(): { runs: number; steps: number } {
    return { runs: this.activeRuns.size, steps: this.activeSteps.size };
  }

  static stepKey(runId: string, stepId: string): string {
    return `${runId}:${stepId}`;
  }
}
