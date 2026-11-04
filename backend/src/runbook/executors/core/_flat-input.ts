import type { ExecutionInput, NodeExecutionResult } from '../../../types/runbook.types';
import type { ExecutorContext, ExecutorResult, StepExecutor } from '../../types/executor.types';

/**
 * Identification block every NodeExecutionError carries; spread into the
 * error constructor so call sites stay short.
 */
export interface NodeErrorContext {
  nodeId: string;
  nodeName: string;
  nodeType: string;
}

/**
 * Base for the core steps that predate ExecutorContext (condition, switch,
 * loop, transform, store get/set, …). They read one flat input dict, the
 * merged output of their parents, and throw NodeExecutionError with a
 * specific code instead of returning `{ success: false }`; callers and
 * tests match on those codes, so the throw is kept as is.
 *
 * Subclasses implement `run`. `execute` is the StepExecutor entry point the
 * engine calls. `inputMode = 'flat'` tells the dispatcher to hand these
 * steps the flat dict and skip secret pre-resolution, which they never
 * supported (resolving would audit reads of secrets the step then ignores).
 */
export abstract class FlatInputStep<
  TConfig = Record<string, unknown>,
> implements StepExecutor<TConfig> {
  abstract readonly type: string;
  /** Other node types routed to this step, e.g. `If` and `operari.if` for Condition. */
  readonly aliases?: readonly string[];
  readonly inputMode = 'flat' as const;

  abstract run(
    config: TConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext,
    tenantId?: string,
    executionId?: string
  ): Promise<NodeExecutionResult>;

  async execute(config: TConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const result = await this.run(
      config,
      context.previousOutputs as ExecutionInput,
      { nodeId: context.stepId, nodeName: this.type, nodeType: this.type },
      context.tenantId,
      context.runId
    );
    // Suspend signals a pause through its result; map it to the flag the
    // engine already handles for approvals.
    const paused = (result as Record<string, unknown> | null)?.isSuspended === true;
    return {
      success: true,
      output: withoutScopeCopies((result as Record<string, unknown>) ?? {}, context),
      ...(paused ? { paused: true } : {}),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Flow steps return `{ ...input, ...theirResult }` so children keep seeing
 * the parents' data. The input they get also carries the run scope (`vars`,
 * `steps`, one key per finished step), and copying that into every output
 * nested all earlier outputs into each step, growing quadratically with the
 * run. Keys that are scope copies (absent from the parents' own output and
 * still the same value) are dropped; everything the step produced or its
 * parents passed stays.
 */
function withoutScopeCopies(
  output: Record<string, unknown>,
  context: ExecutorContext
): Record<string, unknown> {
  if (!context.input) return output;
  const parents = context.input;
  const scoped = context.previousOutputs;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(output)) {
    if (!(key in parents) && key in scoped && scoped[key] === value) continue;
    out[key] = value;
  }
  return out;
}

export function isFlatInputStep(executor: StepExecutor): boolean {
  return (executor as { inputMode?: string }).inputMode === 'flat';
}
