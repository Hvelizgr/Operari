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
      output: (result as Record<string, unknown>) ?? {},
      ...(paused ? { paused: true } : {}),
      duration: Date.now() - startTime,
    };
  }
}

export function isFlatInputStep(executor: StepExecutor): boolean {
  return (executor as { inputMode?: string }).inputMode === 'flat';
}
