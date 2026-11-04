import type { ExecutionInput, NodeExecutionResult } from '../../../types/runbook.types';
import { FlatInputStep } from './_flat-input';
import type { NodeErrorContext } from './_shared';

/**
 * Note node — pure passthrough. The editor uses `custom.note` for
 * inline documentation cards on the canvas; they have no side effects
 * and forward whatever input they receive so wiring them between two
 * functional nodes does not break the flow.
 *
 * Behavior preserved exactly from the legacy `case 'custom.note': return input`.
 */
export class NoteNodeExecutor extends FlatInputStep<Record<string, unknown>> {
  readonly type = 'custom.note';

  async run(
    _config: Record<string, unknown>,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<NodeExecutionResult> {
    return input as NodeExecutionResult;
  }
}
