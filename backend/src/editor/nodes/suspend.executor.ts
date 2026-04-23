import type { ExecutionInput, SuspendNodeConfig, SuspendResult } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';

/**
 * Suspend node — signals the execution service to pause the run.
 *
 * The actual pause is handled in the execution service: when it sees
 * `isSuspended: true` in the output of a step, it transitions the
 * execution to PAUSED and emits `run.paused` to the audit chain. This
 * node only sets the flag.
 *
 * Behavior preserved exactly from the legacy `executeSuspend` method.
 */
export class SuspendNodeExecutor implements EditorNodeExecutor<SuspendNodeConfig, SuspendResult> {
  readonly type = 'Suspend';

  async execute(
    _config: SuspendNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<SuspendResult> {
    return { ...input, isSuspended: true };
  }
}
