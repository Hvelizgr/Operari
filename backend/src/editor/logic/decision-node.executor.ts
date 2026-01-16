import jexl from 'jexl';
import { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

export interface DecisionNodeConfig {
    expression?: string;
}

export class DecisionNodeExecutor {
    async execute(config: DecisionNodeConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
        const { expression } = config;

        if (!expression) {
            throw new NodeExecutionError({
                message: 'Decision expression is required',
                nodeId: '',
                nodeName: 'Decision',
                nodeType: 'Decision',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
            });
        }

        try {
            // jexl.evalSync is safe and powerful for expression evaluation
            const result = await jexl.eval(expression, input);

            return {
                ...input,
                decisionResult: !!result,
                decisionValue: result
            };
        } catch (error) {
            throw new NodeExecutionError({
                message: `Decision evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '',
                nodeName: 'Decision',
                nodeType: 'Decision',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }
}
