import { PrismaClient, Prisma } from '@prisma/client';
import {
    WorkflowNode,
    ExecutionInput,
    ExecutionOutput,
    N8nResult,
    StoreResult,
    SetMetadataResult,
    N8nNodeConfig,
    StoreSetNodeConfig,
    StoreGetNodeConfig,
    SetMetadataNodeConfig,
    NodeExecutionResult,
} from '../types/workflow.types';
import { n8nService } from '../services/n8n.service';
import {
    NodeExecutionError,
    ErrorCode,
} from '../errors/custom-error';
import { Logger } from '../services/logger.service';

type commonErrorContext = { nodeId: string; nodeName: string; nodeType: string }

export interface NodeExecutionOptions {
    tenantId?: string;
    executionId?: string;
    nodeOutputs?: Record<string, ExecutionOutput>;
    workflowNodes?: WorkflowNode[];
}

export class NodeExecutor {
    private prisma: PrismaClient;
    private logger: Logger;

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || new PrismaClient();
        this.logger = Logger.getInstance();
    }

    async execute(node: WorkflowNode, rawInput: ExecutionInput, options: NodeExecutionOptions = {}): Promise<NodeExecutionResult> {
        const config = node.config || {};
        const commonErrorContext = {
            nodeId: node.id,
            nodeName: node.title,
            nodeType: node.type,
        };
        const { tenantId, executionId } = options;

        const input: ExecutionInput = {
            ...rawInput,
            _context: {
                tenantId: tenantId,
                executionId: executionId,
                workflowId: (node as any).workflowId,
                nodeId: node.id,
                nodeTitle: node.title
            }
        };

        switch (node.type) {
            case 'n8n':
                return this.executeN8n(config as N8nNodeConfig, input, commonErrorContext, options);

            case 'StoreSet':
                if (!tenantId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Tenant ID is required for storage operations', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeStoreSet(config as StoreSetNodeConfig, input, tenantId, commonErrorContext, options);

            case 'StoreGet':
                if (!tenantId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Tenant ID is required for storage operations', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeStoreGet(config as StoreGetNodeConfig, input, tenantId, commonErrorContext, options);

            case 'SetMetadata':
                if (!executionId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Execution ID is required for SetMetadata operation', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeSetMetadata(config as SetMetadataNodeConfig, input, executionId, commonErrorContext, options);

            case 'custom.note':
                return input;

            default:
                return this.executeViaN8n(node, input, commonErrorContext);
        }
    }

    private async executeViaN8n(
        node: WorkflowNode,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext
    ): Promise<ExecutionOutput> {
        const n8nNodeType = this.mapToN8nNodeType(node.type);
        
        if (!n8nNodeType) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: `Node type '${node.type}' not mapped. Use n8n workflow node instead.`,
                code: ErrorCode.NODE_NOT_FOUND,
                userMessage: `Use an n8n workflow to execute '${node.type}'.`,
            });
        }

        try {
            return await n8nService.executeNode(n8nNodeType, node.config as Record<string, unknown> || {}, input);
        } catch (error) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: `n8n execution failed: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.NODE_EXECUTION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private mapToN8nNodeType(nanoflowType: string): string | null {
        const mapping: Record<string, string> = {
            'Webhook': 'n8n-nodes-base.webhook',
            'Trigger': 'n8n-nodes-base.manualTrigger',
            'ManualTrigger': 'n8n-nodes-base.manualTrigger',
            'Schedule': 'n8n-nodes-base.scheduleTrigger',
            'HTTP': 'n8n-nodes-base.httpRequest',
            'HttpRequest': 'n8n-nodes-base.httpRequest',
            'Api': 'n8n-nodes-base.httpRequest',
            'Email': 'n8n-nodes-base.emailSend',
            'Transform': 'n8n-nodes-base.code',
            'Code': 'n8n-nodes-base.code',
            'Function': 'n8n-nodes-base.code',
            'Condition': 'n8n-nodes-base.if',
            'If': 'n8n-nodes-base.if',
            'Switch': 'n8n-nodes-base.switch',
            'Delay': 'n8n-nodes-base.wait',
            'Wait': 'n8n-nodes-base.wait',
            'Suspend': 'n8n-nodes-base.wait',
            'Loop': 'n8n-nodes-base.splitInBatches',
            'Iterator': 'n8n-nodes-base.splitInBatches',
            'Database': 'n8n-nodes-base.postgres',
            'SQL': 'n8n-nodes-base.postgres',
            'ShellCommand': 'n8n-nodes-base.executeCommand',
            'CreateTicket': 'n8n-nodes-base.httpRequest',
            'Slack': 'n8n-nodes-base.slack',
            'Telegram': 'n8n-nodes-base.telegram',
            'Discord': 'n8n-nodes-base.discord',
            'Gmail': 'n8n-nodes-base.gmail',
            'GoogleSheets': 'n8n-nodes-base.googleSheets',
            'Notion': 'n8n-nodes-base.notion',
            'Airtable': 'n8n-nodes-base.airtable',
        };
        
        return mapping[nanoflowType] || null;
    }

    private async executeStoreSet(
        config: StoreSetNodeConfig,
        input: ExecutionInput,
        tenantId: string,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<StoreResult> {
        const { bucketName = 'default', key, value } = config;

        if (!key) {
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Storage key is required', code: ErrorCode.CONFIGURATION_ERROR });
        }

        const resolvedBucketName = this.resolveTemplate(bucketName, input, options);
        const resolvedKey = this.resolveTemplate(key, input, options);
        const resolvedValue = this.resolveTemplate(value, input, options);

        const bucket = await this.prisma.storageBucket.upsert({
            where: { tenantId_name: { tenantId, name: resolvedBucketName } },
            create: { name: resolvedBucketName, tenantId, data: {} as Prisma.InputJsonValue },
            update: {},
        });

        const currentData = (bucket.data as Record<string, unknown>) || {};
        const newData = { ...currentData, [resolvedKey]: resolvedValue };

        await this.prisma.storageBucket.update({
            where: { id: bucket.id },
            data: { data: newData as Prisma.InputJsonValue },
        });

        return { success: true, key: resolvedKey, value: resolvedValue };
    }

    private async executeStoreGet(
        config: StoreGetNodeConfig,
        input: ExecutionInput,
        tenantId: string,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { bucketName = 'default', key } = config;

        if (!key) {
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Storage key is required', code: ErrorCode.CONFIGURATION_ERROR });
        }

        const resolvedBucketName = this.resolveTemplate(bucketName, input, options);
        const resolvedKey = this.resolveTemplate(key, input, options);

        const bucket = await this.prisma.storageBucket.findUnique({
            where: { tenantId_name: { tenantId, name: resolvedBucketName } },
        });

        const data = (bucket?.data as Record<string, unknown>) || {};
        return { ...input, [resolvedKey]: data[resolvedKey] || null };
    }

    private async executeSetMetadata(
        config: SetMetadataNodeConfig,
        input: ExecutionInput,
        executionId: string,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<SetMetadataResult> {
        const { metadata } = config;

        if (!metadata) {
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Metadata is required', code: ErrorCode.NODE_EXECUTION_FAILED });
        }

        const resolvedMetadata = JSON.parse(this.resolveTemplate(JSON.stringify(metadata), input, options));

        const execution = await this.prisma.execution.findUnique({
            where: { id: executionId },
            select: { metadata: true },
        });

        const newMetadata = { ...(execution?.metadata as Record<string, unknown>) || {}, ...resolvedMetadata };

        await this.prisma.execution.update({
            where: { id: executionId },
            data: { metadata: newMetadata as Prisma.InputJsonValue },
        });

        return { success: true, metadata: newMetadata };
    }

    private async executeN8n(
        config: N8nNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<N8nResult> {
        const { workflowId, waitForCompletion = true, timeout = 30000, inputMapping } = config;

        if (!workflowId) {
            throw new NodeExecutionError({ ...commonErrorContext, message: 'n8n workflow ID is required', code: ErrorCode.NODE_EXECUTION_FAILED });
        }

        let n8nInput = input;
        if (inputMapping) {
            n8nInput = {};
            for (const [key, path] of Object.entries(inputMapping)) {
                n8nInput[key] = this.resolveTemplate(path, input, options);
            }
        }

        const execution = await n8nService.executeWorkflow(workflowId, n8nInput);

        if (waitForCompletion && execution.id) {
            const startTime = Date.now();
            let status = await n8nService.getExecution(execution.id);

            while (status.status === 'running' || status.status === 'waiting') {
                if (Date.now() - startTime > timeout) {
                    throw new NodeExecutionError({ ...commonErrorContext, message: `Timeout after ${timeout}ms`, code: ErrorCode.NODE_EXECUTION_FAILED });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                status = await n8nService.getExecution(execution.id);
            }

            return {
                executionId: execution.id,
                workflowId,
                status: status.status as 'success' | 'error' | 'waiting' | 'running',
                data: status.data || {},
                startedAt: status.startedAt || new Date().toISOString(),
                finishedAt: status.stoppedAt,
            };
        }

        return { executionId: execution.id || 'pending', workflowId, status: 'running', data: {}, startedAt: new Date().toISOString() };
    }

    private resolveTemplate(template: string, input: ExecutionInput, options: NodeExecutionOptions = {}): string {
        if (typeof template !== 'string') return String(template);

        return template.replace(/\{\{([^}]+)\}\}/g, (_, expression: string) => {
            const path = expression.trim().replace(/^\$json\./, '');
            const val = path.split('.').reduce((obj: unknown, key: string) => 
                obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined, input as unknown);
            return val !== undefined ? String(val) : '';
        });
    }
}
