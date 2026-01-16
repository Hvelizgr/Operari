import { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';

export class JoinNodeExecutor {
    async execute(input: ExecutionInput): Promise<NodeExecutionResult> {
        // In the executor, we just pass through the aggregated input.
        // The complex logic of Join happens in the Workflow Engine (ExecutionService)
        // by waiting for all branches to finish.
        return {
            ...input,
            isJoined: true,
            joinedAt: new Date().toISOString()
        };
    }
}
