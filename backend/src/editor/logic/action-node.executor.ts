import { ExecutionInput, ActionResult, ActionNodeConfig } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

export class ActionNodeExecutor {
    async execute(config: ActionNodeConfig, input: ExecutionInput): Promise<ActionResult> {
        const {
            actionType = 'webhook',
            condition = 'complete',
            enabled = true,
            // Email config
            emailTo,
            emailSubject,
            emailBody,
            emailTemplate,
            // Webhook config
            webhookUrl,
            webhookMethod = 'POST',
            webhookHeaders = {},
            webhookBody,
            // Tag config
            tags = [],
            // Run event config
            eventId,
            eventInput = {},
            // Channel config
            channelTargets = [],
        } = config;

        // If the action is disabled, just pass through
        if (!enabled) {
            return {
                ...input,
                isAction: true,
                actionType,
                condition,
                executed: false,
                result: { skipped: true, reason: 'Action disabled' },
            };
        }

        // Validate action type
        const validActionTypes = ['email', 'webhook', 'disable', 'delete', 'tag', 'run_event', 'channel'];
        if (!validActionTypes.includes(actionType)) {
            throw new NodeExecutionError({
                message: `Invalid action type: ${actionType}. Valid types are: ${validActionTypes.join(', ')}`,
                nodeId: '',
                nodeName: 'Action',
                nodeType: 'Action',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        // Validate condition
        const validConditions = ['success', 'error', 'complete', 'warning'];
        if (!validConditions.includes(condition)) {
            throw new NodeExecutionError({
                message: `Invalid action condition: ${condition}. Valid conditions are: ${validConditions.join(', ')}`,
                nodeId: '',
                nodeName: 'Action',
                nodeType: 'Action',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        // Validate required fields based on action type
        switch (actionType) {
            case 'email':
                if (!emailTo) {
                    throw new NodeExecutionError({
                        message: 'Email action requires recipient (emailTo)',
                        nodeId: '',
                        nodeName: 'Action',
                        nodeType: 'Action',
                        code: ErrorCode.NODE_EXECUTION_FAILED,
                    });
                }
                break;
            case 'webhook':
                if (!webhookUrl) {
                    throw new NodeExecutionError({
                        message: 'Webhook action requires URL (webhookUrl)',
                        nodeId: '',
                        nodeName: 'Action',
                        nodeType: 'Action',
                        code: ErrorCode.NODE_EXECUTION_FAILED,
                    });
                }
                break;
            case 'run_event':
                if (!eventId) {
                    throw new NodeExecutionError({
                        message: 'Run event action requires event ID (eventId)',
                        nodeId: '',
                        nodeName: 'Action',
                        nodeType: 'Action',
                        code: ErrorCode.NODE_EXECUTION_FAILED,
                    });
                }
                break;
            case 'tag':
                if (!tags || tags.length === 0) {
                    throw new NodeExecutionError({
                        message: 'Tag action requires at least one tag',
                        nodeId: '',
                        nodeName: 'Action',
                        nodeType: 'Action',
                        code: ErrorCode.NODE_EXECUTION_FAILED,
                    });
                }
                break;
            case 'channel':
                if (!channelTargets || channelTargets.length === 0) {
                    throw new NodeExecutionError({
                        message: 'Channel action requires at least one target',
                        nodeId: '',
                        nodeName: 'Action',
                        nodeType: 'Action',
                        code: ErrorCode.NODE_EXECUTION_FAILED,
                    });
                }
                break;
        }

        // The actual action execution is handled by the ExecutionService
        // This executor signals the action configuration to be executed
        return {
            ...input,
            isAction: true,
            actionType,
            condition,
            executed: true, // Will be set to true by ExecutionService after actual execution
            actionConfig: {
                emailTo,
                emailSubject,
                emailBody,
                emailTemplate,
                webhookUrl,
                webhookMethod,
                webhookHeaders,
                webhookBody,
                tags,
                eventId,
                eventInput,
                channelTargets,
            },
        };
    }
}
