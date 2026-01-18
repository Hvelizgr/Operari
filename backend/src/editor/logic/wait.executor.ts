import { NodeExecutionResult, ExecutionInput, WorkflowNode } from '../../types/workflow.types';
import { CustomError, ErrorCode } from '../../errors/custom-error';

export class WaitNodeExecutor {
    async execute(node: WorkflowNode, input: ExecutionInput): Promise<NodeExecutionResult> {
        // Simple in-memory wait for demo purposes.
        // For production, this should use the 'suspend' mechanism or a job queue with delayed execution.
        
        const config = node.config as any;
        let ms = 1000; // Default 1 second

        if (config?.amount) {
             const amount = Number(config.amount);
             const unit = config.unit || 'seconds';
             
             if (unit === 'seconds') ms = amount * 1000;
             else if (unit === 'minutes') ms = amount * 60 * 1000;
             else if (unit === 'hours') ms = amount * 60 * 60 * 1000;
             else ms = amount; // assume ms
        } else if (config?.wait) {
            ms = Number(config.wait) * 1000;
        }

        // Limit to 1 minute for in-memory safety
        if (ms > 60000) {
            console.warn(`Wait time ${ms}ms reduced to 60s for in-memory execution safety.`);
            ms = 60000;
        }

        await new Promise(resolve => setTimeout(resolve, ms));
        
        return {
            isWait: true,
            waitedMs: ms,
            ...input
        };
    }
}
