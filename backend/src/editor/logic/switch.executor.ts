import { NodeExecutionResult, ExecutionInput, SwitchResult, WorkflowNode, SwitchNodeConfig } from '../../types/workflow.types';
import jexl from 'jexl';
import { CustomError, ErrorCode, ErrorSeverity } from '../../errors/custom-error';

export class SwitchNodeExecutor {
    async execute(node: WorkflowNode, input: ExecutionInput): Promise<NodeExecutionResult> {
        const expression = (node.config as SwitchNodeConfig)?.expression;

        if (!expression) {
            throw new CustomError({
                message: 'No expression provided for Switch node',
                code: ErrorCode.NODE_CONFIG_INVALID,
                context: { nodeId: node.id }
            });
        }

        try {
            // Evaluate expression
            const result = await jexl.eval(expression, input);

            // Determine active port
            // Port 0: True path
            // Port 1: False path
            const isActive = Boolean(result);
            const activePorts = isActive ? [0] : [1];

            return {
                isSwitch: true,
                result: isActive,
                expression,
                __activePorts: activePorts,
                ...input // Pass through input data
            };
        } catch (error) {
            throw new CustomError({
                message: `Failed to evaluate Switch expression: ${expression}`,
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
                cause: error as Error,
                context: { nodeId: node.id }
            });
        }
    }
}
