import jexl from 'jexl';
import { ExecutionInput } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

export interface AlertConditionNodeConfig {
    expression?: string;           // JEXL expression that returns true/false
    samples?: number;              // Number of consecutive true evaluations before triggering (deduplication)
    cooldownSeconds?: number;      // Cooldown period after alert triggers
    alertName?: string;            // Name of the alert
    severity?: 'info' | 'warning' | 'error' | 'critical';
}

export interface AlertConditionResult extends ExecutionInput {
    alertTriggered: boolean;
    alertName?: string;
    severity?: string;
    consecutiveCount: number;
    expressionResult: boolean;
    message?: string;
}

// In-memory state for alert deduplication (in production, use Redis)
const alertState = new Map<string, { count: number; lastTriggered: number }>();

export class AlertConditionNodeExecutor {
    async execute(
        config: AlertConditionNodeConfig,
        input: ExecutionInput,
        nodeId: string
    ): Promise<AlertConditionResult> {
        const {
            expression,
            samples = 1,
            cooldownSeconds = 0,
            alertName = 'Unnamed Alert',
            severity = 'warning'
        } = config;

        if (!expression) {
            throw new NodeExecutionError({
                message: 'Alert expression is required',
                nodeId,
                nodeName: alertName,
                nodeType: 'AlertCondition',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
            });
        }

        try {
            // Evaluate the JEXL expression
            const expressionResult = await jexl.eval(expression, input);
            const isTrue = !!expressionResult;

            // Get or initialize state for this node
            const stateKey = `${nodeId}`;
            const state = alertState.get(stateKey) || { count: 0, lastTriggered: 0 };

            // Check cooldown
            const now = Date.now();
            const cooldownMs = cooldownSeconds * 1000;
            const inCooldown = cooldownMs > 0 && (now - state.lastTriggered) < cooldownMs;

            // Update consecutive count
            if (isTrue) {
                state.count += 1;
            } else {
                state.count = 0; // Reset on false
            }

            // Determine if alert should trigger
            const shouldTrigger = isTrue && state.count >= samples && !inCooldown;

            if (shouldTrigger) {
                state.lastTriggered = now;
            }

            // Save state
            alertState.set(stateKey, state);

            return {
                ...input,
                alertTriggered: shouldTrigger,
                alertName,
                severity,
                consecutiveCount: state.count,
                expressionResult: isTrue,
                message: shouldTrigger
                    ? `Alert "${alertName}" triggered (${severity})`
                    : isTrue
                        ? `Condition true (${state.count}/${samples} samples)`
                        : 'Condition false',
            };
        } catch (error) {
            throw new NodeExecutionError({
                message: `Alert condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
                nodeId,
                nodeName: alertName,
                nodeType: 'AlertCondition',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    // Reset alert state (useful for testing or manual reset)
    resetState(nodeId: string): void {
        alertState.delete(nodeId);
    }

    // Clear all alert states
    clearAllStates(): void {
        alertState.clear();
    }
}
