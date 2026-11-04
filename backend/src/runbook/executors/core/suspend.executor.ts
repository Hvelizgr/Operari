import type {
  ExecutionInput,
  SuspendNodeConfig,
  SuspendResult,
} from '../../../types/runbook.types';
import { FlatInputStep } from './_flat-input';
import type { NodeErrorContext } from './_shared';

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
export class SuspendNodeExecutor extends FlatInputStep<SuspendNodeConfig> {
  readonly type = 'Suspend';

  async run(
    _config: SuspendNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<SuspendResult> {
    return { ...input, isSuspended: true };
  }
}
