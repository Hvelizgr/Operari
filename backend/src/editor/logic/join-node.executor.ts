import { ExecutionInput, NodeExecutionResult } from '../../types/runbook.types';
import type { EditorNodeExecutor, NodeErrorContext } from '../nodes/_shared';

export class JoinNodeExecutor implements EditorNodeExecutor<
  Record<string, unknown>,
  NodeExecutionResult
> {
  readonly type = 'Join';

  async execute(
    _config: Record<string, unknown>,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<NodeExecutionResult> {
    // In the executor, we just pass through the aggregated input.
    // The complex logic of Join happens in the Workflow Engine (ExecutionService)
    // by waiting for all branches to finish.
    return {
      ...input,
      isJoined: true,
      joinedAt: new Date().toISOString(),
    };
  }
}
