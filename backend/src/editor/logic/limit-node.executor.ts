import { ExecutionInput, LimitResult, LimitNodeConfig } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';
import type { EditorNodeExecutor, NodeErrorContext } from '../nodes/_shared';

export class LimitNodeExecutor
    implements EditorNodeExecutor<LimitNodeConfig, LimitResult> {
    readonly type = 'Limit';

    async execute(
        config: LimitNodeConfig,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<LimitResult> {
        const {
            limitType = 'concurrent',
            amount = 1,
            duration = 0,
            enabled = true,
            onExceed = 'warn',
            notifyEmail,
            notifyWebhook,
        } = config;

        // If the limit is disabled, just pass through
        if (!enabled) {
            return {
                ...input,
                isLimit: true,
                limitType,
                amount,
                exceeded: false,
                action: 'pass',
            };
        }

        // Validate limit type
        const validLimitTypes = ['time', 'memory', 'cpu', 'concurrent', 'queue', 'daily'];
        if (!validLimitTypes.includes(limitType)) {
            throw new NodeExecutionError({
                message: `Invalid limit type: ${limitType}. Valid types are: ${validLimitTypes.join(', ')}`,
                nodeId: '',
                nodeName: 'Limit',
                nodeType: 'Limit',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        // Validate amount
        if (amount < 0) {
            throw new NodeExecutionError({
                message: 'Limit amount cannot be negative',
                nodeId: '',
                nodeName: 'Limit',
                nodeType: 'Limit',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        // The actual limit checking is handled by the ExecutionService
        // This executor signals the limit configuration to be enforced
        return {
            ...input,
            isLimit: true,
            limitType,
            amount,
            duration,
            exceeded: false, // Will be updated by ExecutionService if limit is exceeded
            action: onExceed,
            notifyEmail,
            notifyWebhook,
        };
    }
}
