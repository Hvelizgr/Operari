import { PrismaClient, Prisma } from '@prisma/client';
import axios from 'axios';
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
    WebScraperNodeConfig,
    WebScraperResult,
    NodeExecutionResult,
} from '../types/workflow.types';
import { n8nService } from '../services/n8n.service';
import { ScraperService } from '../services/scraper.service';
import {
    NodeExecutionError,
    ErrorCode,
} from '../errors/custom-error';
import { Logger } from '../services/logger.service';
import { PythonExecutionService } from '../services/python-execution.service';

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
    private pythonService: PythonExecutionService;

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || new PrismaClient();
        this.logger = Logger.getInstance();
        this.pythonService = PythonExecutionService.getInstance();
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

            case 'custom.python':
            case 'n8n-nodes-base.python':
                return this.executePythonCode(config as any, input, commonErrorContext, options);

            case 'n8n-nodes-base.httpRequest':
                return this.executeHttpRequest(config as any, input, commonErrorContext, options);

            case 'n8n-nodes-base.code':
                return this.executeCode(config as any, input, commonErrorContext, options);

            case 'n8n-nodes-base.if':
                return this.executeIf(config as any, input, commonErrorContext, options);

            case 'n8n-nodes-base.switch':
                return this.executeSwitch(config as any, input, commonErrorContext, options);

            case 'n8n-nodes-base.merge':
                return this.executeMerge(config as any, input, commonErrorContext, options);

            case 'n8n-nodes-base.set':
                return this.executeSet(config as any, input, commonErrorContext, options);

            case 'WebScraper':
                return this.executeWebScraper(config as WebScraperNodeConfig, input, commonErrorContext, options);

            default:
                if (this.isTriggerNode(node.type)) {
                    return input;
                }
                return this.executeNatively(node, input, commonErrorContext, options);
        }
    }

    private async executePythonCode(
        config: any,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        _options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { pythonCode, code } = config;
        const codeToRun = pythonCode || code;

        if (!codeToRun) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Python code is required',
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        try {
            const result = await this.pythonService.execute(codeToRun, input);
            
            this.logger.debug(`Python execution completed in ${result.duration}ms`, {
                metadata: {
                    nodeId: commonErrorContext.nodeId,
                    stdout: result.stdout,
                    stderr: result.stderr
                }
            });

            return {
                ...input,
                ...result.result,
                _python: {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    duration: result.duration
                }
            };
        } catch (error) {
            if (error instanceof NodeExecutionError) throw error;
            
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: `Python execution failed: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.NODE_EXECUTION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private async executeNatively(
        node: WorkflowNode,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const nodeType = node.type;

        if (nodeType.startsWith('n8n-nodes-base.')) {
            const simpleName = nodeType.replace('n8n-nodes-base.', '');

            switch (simpleName) {
                case 'httpRequest':
                    return this.executeHttpRequest(node.config as any, input, commonErrorContext, options);
                case 'code':
                    return this.executeCode(node.config as any, input, commonErrorContext, options);
                case 'if':
                    return this.executeIf(node.config as any, input, commonErrorContext, options);
                case 'switch':
                    return this.executeSwitch(node.config as any, input, commonErrorContext, options);
                case 'merge':
                    return this.executeMerge(node.config as any, input, commonErrorContext, options);
                case 'set':
                    return this.executeSet(node.config as any, input, commonErrorContext, options);
            }
        }

        try {
            const n8nAvailable = await n8nService.isN8nAvailable();
            if (n8nAvailable) {
                return await n8nService.executeNode(nodeType, node.config as Record<string, unknown> || {}, input);
            }
        } catch (error) {
            this.logger.warn(`n8n not available for node ${nodeType}, returning input as passthrough`);
        }

        return { ...input, _warning: `Node type '${nodeType}' executed as passthrough (n8n not available)` };
    }

    private async executeHttpRequest(
        config: any,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { url, method = 'GET', body, headers = {} } = config;

        if (!url) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'URL is required for HTTP request',
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        const resolvedUrl = this.resolveTemplate(url, input, options);
        const resolvedMethod = (method || 'GET').toUpperCase();

        let resolvedBody: any = undefined;
        if (body) {
            if (typeof body === 'string') {
                resolvedBody = this.resolveTemplate(body, input, options);
                try {
                    resolvedBody = JSON.parse(resolvedBody);
                } catch { /* keep as string if not valid JSON */ }
            } else {
                resolvedBody = JSON.parse(this.resolveTemplate(JSON.stringify(body), input, options));
            }
        }

        const resolvedHeaders: Record<string, string> = {};
        if (headers && typeof headers === 'object') {
            for (const [key, value] of Object.entries(headers)) {
                resolvedHeaders[key] = this.resolveTemplate(String(value), input, options);
            }
        }
        if (!resolvedHeaders['Content-Type'] && resolvedBody) {
            resolvedHeaders['Content-Type'] = 'application/json';
        }

        try {
            this.logger.info(`HTTP ${resolvedMethod} ${resolvedUrl}`);

            const response = await axios({
                method: resolvedMethod,
                url: resolvedUrl,
                data: resolvedBody,
                headers: resolvedHeaders,
                timeout: 30000,
                validateStatus: () => true,
            });

            return {
                statusCode: response.status,
                headers: response.headers as Record<string, string>,
                body: response.data,
                data: response.data,
                json: response.data,
                ...input,
            };
        } catch (error) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.NODE_EXECUTION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private async executeCode(
        config: any,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        _options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { jsCode, code } = config;
        const codeToRun = jsCode || code;

        if (!codeToRun) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Code is required for Code node',
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        try {
            const $input = {
                first: () => ({ json: input }),
                all: () => [{ json: input }],
                item: input,
            };
            const $json = input;
            const items = [{ json: input }];

            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction('$input', '$json', 'items', codeToRun);
            const result = await fn($input, $json, items);

            if (result === undefined || result === null) {
                return input;
            }

            if (Array.isArray(result)) {
                return result.length > 0 ? result[0] : input;
            }

            if (typeof result === 'object') {
                return { ...input, ...result };
            }

            return { ...input, result };
        } catch (error) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: `Code execution failed: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.NODE_EXECUTION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private async executeIf(
        config: any,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { conditions } = config;
        let conditionMet = false;

        try {
            if (conditions) {
                if (conditions.boolean && Array.isArray(conditions.boolean)) {
                    for (const cond of conditions.boolean) {
                        const value1 = this.evaluateExpression(cond.value1, input, options);
                        const value2 = cond.value2;
                        conditionMet = Boolean(value1) === Boolean(value2);
                        if (!conditionMet) break;
                    }
                }

                if (conditions.number && Array.isArray(conditions.number)) {
                    for (const cond of conditions.number) {
                        const value1 = Number(this.evaluateExpression(cond.value1, input, options));
                        const value2 = Number(cond.value2);
                        
                        switch (cond.operation) {
                            case 'larger': conditionMet = value1 > value2; break;
                            case 'smaller': conditionMet = value1 < value2; break;
                            case 'equal': conditionMet = value1 === value2; break;
                            case 'notEqual': conditionMet = value1 !== value2; break;
                            case 'largerEqual': conditionMet = value1 >= value2; break;
                            case 'smallerEqual': conditionMet = value1 <= value2; break;
                            default: conditionMet = value1 > value2;
                        }
                        if (!conditionMet) break;
                    }
                }

                if (conditions.string && Array.isArray(conditions.string)) {
                    for (const cond of conditions.string) {
                        const value1 = String(this.evaluateExpression(cond.value1, input, options));
                        const value2 = String(cond.value2);
                        
                        switch (cond.operation) {
                            case 'equal': conditionMet = value1 === value2; break;
                            case 'notEqual': conditionMet = value1 !== value2; break;
                            case 'contains': conditionMet = value1.includes(value2); break;
                            case 'notContains': conditionMet = !value1.includes(value2); break;
                            case 'startsWith': conditionMet = value1.startsWith(value2); break;
                            case 'endsWith': conditionMet = value1.endsWith(value2); break;
                            default: conditionMet = value1 === value2;
                        }
                        if (!conditionMet) break;
                    }
                }
            }
        } catch (error) {
            this.logger.warn(`If condition evaluation failed: ${error}`);
            conditionMet = false;
        }

        return {
            ...input,
            __activePorts: conditionMet ? [0] : [1],
            __conditionMet: conditionMet,
        };
    }

    private async executeSwitch(
        config: any,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { rules } = config;
        let activePort = -1;

        if (rules?.rules && Array.isArray(rules.rules)) {
            for (let i = 0; i < rules.rules.length; i++) {
                const rule = rules.rules[i];
                const value1 = this.evaluateExpression(rule.value1, input, options);
                const value2 = rule.value2;

                let matches = false;
                switch (rule.operation) {
                    case 'equal': matches = value1 === value2; break;
                    case 'notEqual': matches = value1 !== value2; break;
                    case 'contains': matches = String(value1).includes(String(value2)); break;
                    case 'larger': matches = Number(value1) > Number(value2); break;
                    case 'smaller': matches = Number(value1) < Number(value2); break;
                    default: matches = value1 === value2;
                }

                if (matches) {
                    activePort = i;
                    break;
                }
            }
        }

        if (activePort === -1) {
            activePort = rules?.rules?.length || 0;
        }

        return {
            ...input,
            __activePorts: [activePort],
            __matchedRule: activePort,
        };
    }

    private async executeMerge(
        config: any,
        input: ExecutionInput,
        _commonErrorContext: commonErrorContext,
        _options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { mode = 'combine' } = config;
        const inputs = input.__inputs as Record<number, unknown> | undefined;

        if (!inputs) {
            return input;
        }

        const allInputs = Object.values(inputs).filter(Boolean);

        switch (mode) {
            case 'combine':
                return allInputs.reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {}) as ExecutionOutput;
            case 'append':
                return { items: allInputs } as ExecutionOutput;
            default:
                return allInputs.reduce((acc: any, curr: any) => ({ ...acc, ...curr }), {}) as ExecutionOutput;
        }
    }

    private async executeSet(
        config: any,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { values, keepOnlySet = false } = config;
        const result: Record<string, unknown> = keepOnlySet ? {} : { ...input };

        if (values && typeof values === 'object') {
            for (const [key, value] of Object.entries(values)) {
                result[key] = typeof value === 'string' 
                    ? this.resolveTemplate(value, input, options) 
                    : value;
            }
        }

        return result;
    }

    private evaluateExpression(expr: string, input: ExecutionInput, options: NodeExecutionOptions): unknown {
        if (typeof expr !== 'string') return expr;

        const match = expr.match(/^={{(.+)}}$/);
        if (match) {
            const path = match[1].trim().replace(/^\$json\./, '');
            return path.split('.').reduce((obj: any, key: string) => 
                obj && typeof obj === 'object' ? obj[key] : undefined, input);
        }

        return this.resolveTemplate(expr, input, options);
    }

    private isTriggerNode(nodeType: string): boolean {
        const triggerTypes = [
            'n8n-nodes-base.scheduleTrigger',
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.cron',
            'n8n-nodes-base.start',
            'n8n-nodes-base.emailReadImap',
            'n8n-nodes-base.errorTrigger',
            'n8n-nodes-base.workflowTrigger',
            'Trigger',
            'ManualTrigger',
            'Webhook',
            'Schedule',
            'Cron',
            'Start',
        ];
        return triggerTypes.includes(nodeType) || nodeType.toLowerCase().includes('trigger');
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

    private async executeWebScraper(
        config: WebScraperNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<WebScraperResult> {
        const { url, mode = 'fast' } = config;

        if (!url) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'URL is required for WebScraper',
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        const resolvedUrl = this.resolveTemplate(url, input, options);
        const scraper = ScraperService.getInstance();

        try {
            this.logger.info(`WebScraper [${mode}] scraping ${resolvedUrl}`);
            
            const result = await scraper.scrape(resolvedUrl, {
                mode: mode as 'fast' | 'advanced',
                selector: config.selector ? this.resolveTemplate(config.selector, input, options) : undefined,
                extractText: config.extractText,
                extractHtml: config.extractHtml,
                extractLinks: config.extractLinks,
                extractImages: config.extractImages,
            });

            return {
                ...input,
                ...result,
            };
        } catch (error) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: `WebScraper failed: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.NODE_EXECUTION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private resolveTemplate(template: string, input: ExecutionInput, _options: NodeExecutionOptions = {}): string {
        if (typeof template !== 'string') return String(template);

        return template.replace(/\{\{([^}]+)\}\}/g, (_, expression: string) => {
            const path = expression.trim().replace(/^\$json\./, '');
            const val = path.split('.').reduce((obj: unknown, key: string) => 
                obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined, input as unknown);
            return val !== undefined ? String(val) : '';
        });
    }
}
