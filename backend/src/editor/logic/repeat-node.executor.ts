import { ErrorCode, NodeExecutionError } from '../../errors/custom-error';
import { ExecutionInput, RepeatNodeConfig, RepeatResult } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from '../nodes/_shared';

export class RepeatNodeExecutor implements EditorNodeExecutor<RepeatNodeConfig, RepeatResult> {
  readonly type = 'Repeat';

  async execute(
    config: RepeatNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<RepeatResult> {
    const { count = 1, parallel = true } = config;

    if (count < 1) {
      throw new NodeExecutionError({
        message: 'Repeat count must be at least 1',
        nodeId: '',
        nodeName: 'Repeat',
        nodeType: 'Repeat',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    if (count > 1000) {
      throw new NodeExecutionError({
        message: 'Repeat count cannot exceed 1000 to prevent resource exhaustion',
        nodeId: '',
        nodeName: 'Repeat',
        nodeType: 'Repeat',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    // The actual parallel execution is handled by the ExecutionService
    // This executor just signals that we want to repeat N times
    return {
      ...input,
      isRepeat: true,
      repeatCount: count,
      currentIteration: 0, // Will be updated by ExecutionService for each iteration
      parallel,
    };
  }
}
