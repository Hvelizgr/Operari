import { ErrorCode, NodeExecutionError } from '../../errors/custom-error';
import { ExecutionInput, MultiplexNodeConfig, MultiplexResult } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from '../nodes/_shared';

export class MultiplexNodeExecutor implements EditorNodeExecutor<
  MultiplexNodeConfig,
  MultiplexResult
> {
  readonly type = 'Multiplex';

  async execute(
    config: MultiplexNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<MultiplexResult> {
    const { targets = [], stagger = 0, continueThreshold = 100 } = config;

    if (!Array.isArray(targets) || targets.length === 0) {
      throw new NodeExecutionError({
        message: 'Multiplex requires at least one target',
        nodeId: '',
        nodeName: 'Multiplex',
        nodeType: 'Multiplex',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    if (targets.length > 100) {
      throw new NodeExecutionError({
        message: 'Multiplex cannot have more than 100 targets to prevent resource exhaustion',
        nodeId: '',
        nodeName: 'Multiplex',
        nodeType: 'Multiplex',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    if (stagger < 0) {
      throw new NodeExecutionError({
        message: 'Stagger delay cannot be negative',
        nodeId: '',
        nodeName: 'Multiplex',
        nodeType: 'Multiplex',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    if (continueThreshold < 0 || continueThreshold > 100) {
      throw new NodeExecutionError({
        message: 'Continue threshold must be between 0 and 100',
        nodeId: '',
        nodeName: 'Multiplex',
        nodeType: 'Multiplex',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    // The actual parallel execution with stagger is handled by the ExecutionService
    // This executor just signals that we want to multiplex across targets
    return {
      ...input,
      isMultiplex: true,
      targets,
      targetCount: targets.length,
      stagger,
      continueThreshold,
    };
  }
}
