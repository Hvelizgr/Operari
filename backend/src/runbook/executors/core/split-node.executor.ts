import { ErrorCode, NodeExecutionError } from '../../../errors/custom-error';
import { ExecutionInput, NodeExecutionResult } from '../../../types/runbook.types';
import { FlatInputStep } from './_flat-input';
import type { NodeErrorContext } from './_shared';

export interface SplitNodeConfig {
  itemsPath?: string; // Path in the input to find the array to split
}

export class SplitNodeExecutor extends FlatInputStep<SplitNodeConfig> {
  readonly type = 'Split';

  async run(
    config: SplitNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<NodeExecutionResult> {
    const { itemsPath } = config;

    if (!itemsPath) {
      throw new NodeExecutionError({
        message: 'Split items path is required',
        nodeId: '',
        nodeName: 'Split',
        nodeType: 'Split',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    const items = this.getNestedValue(input, itemsPath);

    if (!Array.isArray(items)) {
      throw new NodeExecutionError({
        message: `Split items path must point to an array. Found: ${typeof items}`,
        nodeId: '',
        nodeName: 'Split',
        nodeType: 'Split',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    return {
      ...input,
      splitItems: items,
      splitCount: items.length,
      isSplit: true,
    };
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
