import type { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';

/**
 * Note node — pure passthrough. The editor uses `custom.note` for
 * inline documentation cards on the canvas; they have no side effects
 * and forward whatever input they receive so wiring them between two
 * functional nodes does not break the flow.
 *
 * Behavior preserved exactly from the legacy `case 'custom.note': return input`.
 */
export class NoteNodeExecutor
    implements EditorNodeExecutor<Record<string, unknown>, NodeExecutionResult> {
    readonly type = 'custom.note';

    async execute(
        _config: Record<string, unknown>,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<NodeExecutionResult> {
        return input as NodeExecutionResult;
    }
}
