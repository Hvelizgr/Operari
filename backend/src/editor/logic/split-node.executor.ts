import { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

export interface SplitNodeConfig {
    itemsPath?: string; // Path in the input to find the array to split
}

export class SplitNodeExecutor {
    async execute(config: SplitNodeConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
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
            isSplit: true
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            if (current && typeof current === 'object' && key in current) {
                return current[key];
            }
            return undefined;
        }, obj);
    }
}
