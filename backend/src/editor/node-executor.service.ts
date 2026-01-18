
import { exec } from 'child_process';
import * as ivm from 'isolated-vm';
import { SwitchNodeExecutor } from './logic/switch.executor';
import { WaitNodeExecutor } from './logic/wait.executor';

import { PrismaClient, Prisma } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import {
    WorkflowNode,
    ExecutionInput,
    ExecutionOutput,
    TriggerResult,
    HttpResult,
    EmailResult,
    ConditionResult,
    DelayResult,
    LoopResult,
    DatabaseResult,
    N8nResult,
    ShellCommandResult,
    StoreResult,
    SuspendResult,
    SetMetadataResult,
    CreateTicketResult,
    HttpNodeConfig,
    EmailNodeConfig,
    TransformNodeConfig,
    ConditionNodeConfig,
    DatabaseNodeConfig,
    DelayNodeConfig,
    LoopNodeConfig,
    N8nNodeConfig,
    DecisionNodeConfig,
    SplitNodeConfig,
    JoinNodeConfig,
    ShellCommandNodeConfig,
    StoreSetNodeConfig,
    StoreGetNodeConfig,
    SuspendNodeConfig,
    SetMetadataNodeConfig,
    CreateTicketNodeConfig,
    RepeatNodeConfig,
    MultiplexNodeConfig,
    LimitNodeConfig,
    ActionNodeConfig,
    NodeExecutionResult,
} from '../types/workflow.types';
import { DecisionNodeExecutor } from './logic/decision-node.executor';
import { SplitNodeExecutor } from './logic/split-node.executor';
import { JoinNodeExecutor } from './logic/join-node.executor';
import { RepeatNodeExecutor } from './logic/repeat-node.executor';
import { MultiplexNodeExecutor } from './logic/multiplex-node.executor';
import { LimitNodeExecutor } from './logic/limit-node.executor';
import { ActionNodeExecutor } from './logic/action-node.executor';
import { AlertConditionNodeExecutor, AlertConditionNodeConfig } from './logic/alert-condition-node.executor';
import { ThresholdNodeExecutor, ThresholdNodeConfig } from './logic/threshold-node.executor';
import { CompareNodeExecutor, CompareNodeConfig } from './logic/compare-node.executor';
import {
    DiskUsageNodeExecutor,
    DiskUsageConfig,
    CpuMonitorNodeExecutor,
    CpuMonitorConfig,
    MemoryMonitorNodeExecutor,
    MemoryMonitorConfig
} from './logic/infrastructure-monitor.executor';
import {
    PingNodeExecutor,
    PingConfig,
    HttpHealthCheckNodeExecutor,
    HttpHealthCheckConfig
} from './logic/network-monitor.executor';
import { NodeLoaderService } from '../services/node-loader.service'; // Import loader
import { n8nService } from '../services/n8n.service';
import {
    HttpError,
    SandboxError,
    ExternalServiceError,
    NodeExecutionError,
    ErrorCode,
    ErrorSeverity,
} from '../errors/custom-error';
import { Logger } from '../services/logger.service';
import { withHttpRetry, withExternalServiceRetry, RetryOptions } from '../utils/retry';
import axios from 'axios';

type commonErrorContext = { nodeId: string; nodeName: string; nodeType: string }

interface SandboxConfig {
    timeout: number;      // Tiempo máximo de ejecución en ms
    memoryLimit: number;  // Límite de memoria en MB
}

// Whitelist de funciones/objetos permitidos en el sandbox
const ALLOWED_GLOBALS = {
    // Funciones matemáticas
    Math: {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        random: Math.random,
        round: Math.round,
        sqrt: Math.sqrt,
        trunc: Math.trunc,
    },
    // Funciones de números
    Number: {
        isFinite: Number.isFinite,
        isInteger: Number.isInteger,
        isNaN: Number.isNaN,
        parseFloat: Number.parseFloat,
        parseInt: Number.parseInt,
    },
    // Utilidades de string
    String: {
        fromCharCode: String.fromCharCode,
    },
    // JSON seguro
    JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify,
    },
    // Funciones de Array permitidas
    Array: {
        isArray: Array.isArray,
        from: Array.from,
        of: Array.of,
    },
    // Object utilities
    Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign,
        fromEntries: Object.fromEntries,
    },
    // Tipos permitidos
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    // Date (solo lectura de tiempo actual)
    Date: {
        now: Date.now,
    },
};

class SecureSandbox {
    private config: SandboxConfig;
    private useIvm: boolean = true;

    constructor(config: Partial<SandboxConfig> = {}) {
        this.config = {
            timeout: config.timeout ?? 5000,
            memoryLimit: config.memoryLimit ?? 128,
        };
        // Check if ivm.Isolate is a constructor
        try {
            if (typeof ivm?.Isolate !== 'function') {
                this.useIvm = false;
            }
        } catch {
            this.useIvm = false;
        }
    }

    // Simple fallback execution (less secure but works)
    private executeFallback(code: string, input: ExecutionInput): ExecutionOutput {
        try {
            // Pass the code directly as the function body
            const fn = new Function(
                'input',
                'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
                code
            );
            const result = fn(input, Math, JSON, Date, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite);
            return result as ExecutionOutput;
        } catch (error: any) {
            return { error: error.message || 'Execution error' };
        }
    }

    async execute(code: string, input: ExecutionInput): Promise<ExecutionOutput> {
        // Use fallback if ivm is not available
        if (!this.useIvm) {
            return this.executeFallback(code, input);
        }

        try {
            const isolate = new ivm.Isolate({ memoryLimit: this.config.memoryLimit });

            try {
                const context = await isolate.createContext();
                const jail = context.global;

                // DO NOT expose 'global' directly to avoid prototype pollution or escaping
                // await jail.set('global', jail.derefInto()); 

                // Inject allowed globals strictly
                for (const [key, value] of Object.entries(ALLOWED_GLOBALS)) {
                    if (typeof value === 'object' && value !== null) {
                        await jail.set(key, new ivm.ExternalCopy(value).copyInto());
                    } else if (typeof value === 'function') {
                        // For functions, we need to be careful. Reference might allow calling back into host.
                        // Ideally, we wrap them or only expose pure functions.
                        // For now, keeping Reference but aware of risks.
                        await jail.set(key, new ivm.Reference(value));
                    }
                }

                await jail.set('input', new ivm.ExternalCopy(input).copyInto());
                await jail.set('__result__', undefined);

                // WRAPPER SÉGURO:
                // 1. Ocultamos 'eval', 'Function', 'require' (aunque 'require' no existe en ivm por defecto)
                // 2. Usamos 'use strict'
                // 3. Ejecutamos el código de usuario dentro de una función anónima
                const wrappedCode = `
                    (function() {
                        'use strict';
                        
                        // Shadow dangerous globals just in case
                        const eval = undefined;
                        const require = undefined;
                        const process = undefined;
                        const setTimeout = undefined;
                        const setInterval = undefined;
                        
                        // Bloquear constructor de funciones dinámicas
                        const Function = undefined;
                        const Promise = undefined; // Optional: block async if needed, but we usually want async

                        try {
                            const __userCode__ = function(input) {
                                // User code starts here
                                ${code}
                                // User code ends here
                            };
                            __result__ = __userCode__(input);
                        } catch (e) {
                            __result__ = { error: e.message || 'Error de ejecución' };
                        }
                    })();
                `;

                const script = await isolate.compileScript(wrappedCode);
                await script.run(context, { timeout: this.config.timeout });

                const resultRef = await jail.get('__result__');
                const result = resultRef instanceof ivm.Reference
                    ? await resultRef.copy()
                    : resultRef;

                return result as ExecutionOutput;
            } finally {
                isolate.dispose();
            }
        } catch (error: any) {
            // If ivm fails, use fallback
            console.warn('isolated-vm failed, using fallback:', error.message);
            this.useIvm = false;
            return this.executeFallback(code, input);
        }
    }

    // Simple fallback for condition evaluation
    private evaluateConditionFallback(condition: string, input: ExecutionInput): boolean {
        try {
            const sanitizedCondition = this.sanitizeCondition(condition);
            // Sanitize ensures no unwanted global access, but we still need to be careful with syntax.
            // For condition, it's usually an expression like "input.value > 10".
            // We need to return it.

            const fn = new Function(
                'input',
                'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
                `try { return Boolean(${sanitizedCondition}); } catch(e) { return false; }`
            );
            return fn(input, Math, JSON, Date, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite);
        } catch (error) {
            return false;
        }
    }

    async evaluateCondition(condition: string, input: ExecutionInput): Promise<boolean> {
        // Use fallback if ivm is not available
        if (!this.useIvm) {
            return this.evaluateConditionFallback(condition, input);
        }

        try {
            const isolate = new ivm.Isolate({ memoryLimit: this.config.memoryLimit });

            try {
                const context = await isolate.createContext();
                const jail = context.global;

                // DO NOT expose global
                // await jail.set('global', jail.derefInto());

                // Inyectar funciones permitidas
                for (const [key, value] of Object.entries(ALLOWED_GLOBALS)) {
                    if (typeof value === 'object' && value !== null) {
                        await jail.set(key, new ivm.ExternalCopy(value).copyInto());
                    } else if (typeof value === 'function') {
                        await jail.set(key, new ivm.Reference(value));
                    }
                }

                // Inyectar el input
                await jail.set('input', new ivm.ExternalCopy(input).copyInto());
                await jail.set('__result__', false);

                // Sanitizar la condición para prevenir inyecciones
                const sanitizedCondition = this.sanitizeCondition(condition);

                const wrappedCode = `
                    (function() {
                        'use strict';
                        const eval = undefined;
                        const Function = undefined;
                        const require = undefined;
                        const process = undefined;
                        
                        try {
                            __result__ = Boolean(${sanitizedCondition});
                        } catch (e) {
                            __result__ = false;
                        }
                    })();
                `;

                const script = await isolate.compileScript(wrappedCode);
                await script.run(context, { timeout: this.config.timeout });

                const resultRef = await jail.get('__result__');
                return Boolean(resultRef instanceof ivm.Reference ? await resultRef.copy() : resultRef);
            } finally {
                isolate.dispose();
            }
        } catch (error: any) {
            // If ivm fails, use fallback
            console.warn('isolated-vm failed for condition, using fallback:', error.message);
            this.useIvm = false;
            return this.evaluateConditionFallback(condition, input);
        }
    }

    private sanitizeCondition(condition: string): string {
        // Lista de patrones peligrosos que no deben estar en condiciones
        const dangerousPatterns = [
            /\beval\b/gi,
            /\bFunction\b/gi,
            /\bimport\b/gi,
            /\brequire\b/gi,
            /\bprocess\b/gi,
            /\bglobal\b/gi,
            /\bwindow\b/gi,
            /\bdocument\b/gi,
            /\b__proto__\b/gi,
            /\bconstructor\b/gi,
            /\bprototype\b/gi,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(condition)) {
                throw new Error(`Condición contiene patrones no permitidos: ${pattern.source}`);
            }
        }

        return condition;
    }
}

export interface NodeExecutionOptions {
    tenantId?: string;
    executionId?: string;
    nodeOutputs?: Record<string, ExecutionOutput>;
    workflowNodes?: WorkflowNode[];
}

export class NodeExecutor {
    private emailTransporter: nodemailer.Transporter | null = null;
    private sandbox: SecureSandbox;
    private prisma: PrismaClient;
    private logger: Logger;
    private decisionExecutor: DecisionNodeExecutor;
    private splitExecutor: SplitNodeExecutor;
    private joinExecutor: JoinNodeExecutor;
    private repeatExecutor: RepeatNodeExecutor;
    private multiplexExecutor: MultiplexNodeExecutor;
    private limitExecutor: LimitNodeExecutor;
    private actionExecutor: ActionNodeExecutor;
    private alertConditionExecutor: AlertConditionNodeExecutor;
    private thresholdExecutor: ThresholdNodeExecutor;
    private compareExecutor: CompareNodeExecutor;
    private diskUsageExecutor: DiskUsageNodeExecutor;
    private cpuMonitorExecutor: CpuMonitorNodeExecutor;
    private memoryMonitorExecutor: MemoryMonitorNodeExecutor;
    private pingExecutor: PingNodeExecutor;
    private httpCheckExecutor: HttpHealthCheckNodeExecutor;
    private switchExecutor: SwitchNodeExecutor;
    private waitExecutor: WaitNodeExecutor;

    constructor(prisma?: PrismaClient) {
        // Inicializar el sandbox con configuración por defecto
        this.sandbox = new SecureSandbox({
            timeout: 5000,      // 5 segundos máximo
            memoryLimit: 128,   // 128 MB máximo
        });

        this.prisma = prisma || new PrismaClient();
        this.logger = Logger.getInstance();

        if (process.env.SMTP_HOST) {
            this.emailTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }

        this.decisionExecutor = new DecisionNodeExecutor();
        this.splitExecutor = new SplitNodeExecutor();
        this.joinExecutor = new JoinNodeExecutor();
        this.repeatExecutor = new RepeatNodeExecutor();
        this.multiplexExecutor = new MultiplexNodeExecutor();
        this.limitExecutor = new LimitNodeExecutor();
        this.actionExecutor = new ActionNodeExecutor();
        this.alertConditionExecutor = new AlertConditionNodeExecutor();
        this.thresholdExecutor = new ThresholdNodeExecutor();
        this.compareExecutor = new CompareNodeExecutor();
        this.diskUsageExecutor = new DiskUsageNodeExecutor();
        this.cpuMonitorExecutor = new CpuMonitorNodeExecutor();
        this.memoryMonitorExecutor = new MemoryMonitorNodeExecutor();
        this.pingExecutor = new PingNodeExecutor();
        this.httpCheckExecutor = new HttpHealthCheckNodeExecutor();
        this.switchExecutor = new SwitchNodeExecutor();
        this.waitExecutor = new WaitNodeExecutor();
    }

    async execute(node: WorkflowNode, rawInput: ExecutionInput, options: NodeExecutionOptions = {}): Promise<NodeExecutionResult> {
        const config = node.config || {};
        const commonErrorContext = {
            nodeId: node.id,
            nodeName: node.title,
            nodeType: node.type,
        };
        const { tenantId, executionId } = options;

        // Enrich input with context
        // We cast node to any because WorkflowNode interface might be strictly UI type but runtime has DB props
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
            case 'Webhook':
            case 'Trigger':
            case 'ManualTrigger':
            case 'n8n-nodes-base.webhook':
            case 'n8n-nodes-base.manualTrigger':
            case 'n8n-nodes-base.ManualTrigger': // Added PascalCase support
            case 'n8n-nodes-base.scheduleTrigger':
            case 'Schedule':
                return this.executeTrigger(input);

            case 'Switch':
            case 'n8n-nodes-base.switch':
                return this.switchExecutor.execute(node, input);

            case 'Wait':
            case 'Delay':
            case 'n8n-nodes-base.wait':
                return this.waitExecutor.execute(node, input);

            case 'HTTP':
            case 'Api':
            case 'HttpRequest':
            case 'n8n-nodes-base.httpRequest':
            case 'n8n-nodes-base.HttpRequest': // Added PascalCase support
                return this.executeHttp(config as HttpNodeConfig, input, commonErrorContext, options);

            case 'Email':
                return this.executeEmail(config as EmailNodeConfig, input, commonErrorContext, options);
            case 'custom.email':
                return this.executeEmail(config as EmailNodeConfig, input, commonErrorContext, options);

            case 'Transform':
            case 'Code':
            case 'Function':
            case 'n8n-nodes-base.code':
            case 'n8n-nodes-base.Code': // Added PascalCase support
            case 'n8n-nodes-base.function': // Legacy support
                return this.executeTransform(config as TransformNodeConfig, input, commonErrorContext, options);

            case 'Condition':
            case 'If':
            case 'n8n-nodes-base.if':
            case 'n8n-nodes-base.If': // Added PascalCase support
                return this.executeCondition(config as ConditionNodeConfig, input, commonErrorContext, options);

            case 'Database':
            case 'SQL':
                return this.executeDatabase(config as DatabaseNodeConfig, input, commonErrorContext, options);

            case 'Delay':
            case 'Wait':
            case 'n8n-nodes-base.wait':
            case 'n8n-nodes-base.Wait': // Added PascalCase support
                return this.executeDelay(config as DelayNodeConfig);

            case 'Loop':
            case 'Iterator':
            case 'n8n-nodes-base.loop':
            case 'n8n-nodes-base.splitInBatches':
            case 'n8n-nodes-base.SplitInBatches': // Added PascalCase support
                return this.executeLoop(config as LoopNodeConfig, input, commonErrorContext);

            case 'n8n':
                return this.executeN8n(config as N8nNodeConfig, input, commonErrorContext, options);

            case 'Decision':
                return this.decisionExecutor.execute(config as DecisionNodeConfig, input);

            case 'Split':
                return this.splitExecutor.execute(config as SplitNodeConfig, input);

            case 'Join':
                return this.joinExecutor.execute(input);

            case 'Repeat':
                return this.repeatExecutor.execute(config as RepeatNodeConfig, input);

            case 'Multiplex':
                return this.multiplexExecutor.execute(config as MultiplexNodeConfig, input);

            case 'Limit':
                return this.limitExecutor.execute(config as LimitNodeConfig, input);

            case 'Action':
                return this.actionExecutor.execute(config as ActionNodeConfig, input);

            case 'ShellCommand':
            case 'custom.shellCommand':
                return this.executeShellCommand(config as ShellCommandNodeConfig, input, commonErrorContext, options);

            case 'StoreSet':
                if (!tenantId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Tenant ID is required for storage operations', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeStoreSet(config as StoreSetNodeConfig, input, tenantId, commonErrorContext, options);

            case 'StoreGet':
                if (!tenantId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Tenant ID is required for storage operations', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeStoreGet(config as StoreGetNodeConfig, input, tenantId, commonErrorContext, options);

            case 'Suspend':
                return this.executeSuspend(config as SuspendNodeConfig, input);

            case 'SetMetadata':
                if (!executionId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Execution ID is required for SetMetadata operation', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeSetMetadata(config as SetMetadataNodeConfig, input, executionId, commonErrorContext, options);

            case 'CreateTicket':
                return this.executeCreateTicket(config as CreateTicketNodeConfig, input, commonErrorContext, options);

            case 'AlertCondition':
            case 'Alert':
                return this.alertConditionExecutor.execute(config as AlertConditionNodeConfig, input, node.id);

            case 'Threshold':
                return this.thresholdExecutor.execute(config as ThresholdNodeConfig, input);

            case 'Compare':
                return this.compareExecutor.execute(config as CompareNodeConfig, input);


            case 'custom.note':
                return input;

            case 'DiskUsage':
                return this.diskUsageExecutor.execute(config as DiskUsageConfig, input);

            case 'CpuMonitor':
                return this.cpuMonitorExecutor.execute(config as CpuMonitorConfig, input);

            case 'MemoryMonitor':
                return this.memoryMonitorExecutor.execute(config as MemoryMonitorConfig, input);

            case 'Ping':
                return this.pingExecutor.execute(config as PingConfig, input);
            
            case 'HttpHealthCheck':
                return this.httpCheckExecutor.execute(config as HttpHealthCheckConfig, input);

            default:
                // Try dynamic nodes
                const dynamicExecutor = NodeLoaderService.getInstance().getExecutor(node.type);
                if (dynamicExecutor) {
                     // Instantiate if it's a class constructable, or call execute directly if it's an instance
                     // Simple assumption for now: if it has .prototype.execute, it's a class. 
                     // Or we just assume the exported 'executor' is an INSTANCE or object with execute().
                     // Let's assume it's an object/instance for simplicity in V1 logic.
                     if (typeof dynamicExecutor.execute === 'function') {
                         return dynamicExecutor.execute(config, input);
                     }
                     // If it's a class
                     if (typeof dynamicExecutor === 'function') {
                         const instance = new dynamicExecutor();
                         return instance.execute(config, input);
                     }
                }

                throw new NodeExecutionError({
                    ...commonErrorContext,
                    message: `Unknown node type: ${node.type}`,
                    code: ErrorCode.NODE_NOT_FOUND,
                    userMessage: `Node type '${node.type}' is not recognized or supported.`,
                });
        }
    }

    private async executeTrigger(input: ExecutionInput): Promise<TriggerResult> {
        return { ...input, triggered: true, timestamp: new Date().toISOString() };
    }

    private async executeShellCommand(
        config: ShellCommandNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ShellCommandResult> {
        const { command } = config;

        if (!command) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Shell command is not defined',
                userMessage: 'Shell command is empty',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        const resolvedCommand = this.resolveTemplate(command, input, options);

        this.logger.warn(`Executing shell command: "${resolvedCommand}"`, {
            metadata: { command: resolvedCommand },
        });

        return new Promise((resolve, reject) => {
            exec(resolvedCommand, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    const execError = new NodeExecutionError({
                        ...commonErrorContext,
                        message: `Shell command failed: ${error.message}`,
                        userMessage: `Command failed with error: ${error.message}. Stderr: ${stderr}`,
                        code: ErrorCode.NODE_EXECUTION_FAILED,
                        cause: error,
                    });
                    this.logger.error('Shell command execution failed', {
                        error: execError,
                        metadata: { command: resolvedCommand, stderr },
                    });
                    return reject(execError);
                }

                const result: ShellCommandResult = { stdout, stderr };

                const trimmedStdout = stdout.trim();
                if (trimmedStdout.startsWith('{') && trimmedStdout.endsWith('}')) {
                    try {
                        // @ts-ignore
                        result.json = JSON.parse(trimmedStdout);
                    } catch (e) {
                        // Not valid JSON, leave it as a string
                    }
                }

                resolve(result);
            });
        });
    }


    private async executeHttp(
        config: HttpNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<HttpResult> {
        const { url, method = 'GET', headers = {}, body, retries = 3 } = config;

        const resolvedUrl = this.resolveTemplate(url || '', input, options);
        const resolvedBody = body ? this.resolveTemplate(JSON.stringify(body), input, options) : undefined;

        try {
            const result = await withHttpRetry(
                async () => {
                    const response = await fetch(resolvedUrl, {
                        method,
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            ...headers,
                        },
                        body: resolvedBody,
                    });

                    if (!response.ok) {
                        throw new HttpError({
                            ...commonErrorContext,
                            message: `HTTP ${response.status} ${response.statusText}`,
                            code: this.getHttpErrorCode(response.status),
                            statusCode: response.status,
                            url: resolvedUrl,
                        });
                    }

                    const data = await response.json().catch(() => response.text());

                    return {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        data,
                    };
                },
                `HTTP ${method} ${resolvedUrl}`,
                { maxRetries: retries - 1 }
            );

            return result;
        } catch (error) {
            const httpError = error instanceof HttpError
                ? error
                : new HttpError({
                    message: error instanceof Error ? error.message : 'Unknown HTTP error',
                    url: resolvedUrl,
                    cause: error instanceof Error ? error : undefined,
                });

            this.logger.error('HTTP request failed', {
                error: httpError,
                metadata: { url: resolvedUrl, method },
            });

            throw httpError;
        }
    }

    private async executeEmail(
        config: EmailNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<EmailResult> {
        if (!this.emailTransporter) {
            throw new ExternalServiceError({
                ...commonErrorContext,
                message: 'Email service is not configured',
                code: ErrorCode.EMAIL_NOT_CONFIGURED,
                serviceName: 'Email',
                userMessage: 'Email service is not available at this time',
                isRetryable: false,
            });
        }

        const { to, subject, body, html } = config;

        const resolvedTo = this.resolveTemplate(to || '', input, options);
        const resolvedSubject = this.resolveTemplate(subject || '', input, options);
        const resolvedBody = this.resolveTemplate(body || '', input, options);
        const resolvedHtml = html ? this.resolveTemplate(html, input, options) : undefined;

        try {
            const info = await withExternalServiceRetry(
                async () => {
                    return await this.emailTransporter!.sendMail({
                        from: process.env.SMTP_USER,
                        to: resolvedTo,
                        subject: resolvedSubject,
                        text: resolvedBody,
                        html: resolvedHtml,
                    });
                },
                'Email Service',
                { maxRetries: 2 }
            );

            return {
                messageId: info.messageId,
                accepted: info.accepted as string[],
                rejected: info.rejected as string[],
            };
        } catch (error) {
            const emailError = error instanceof ExternalServiceError
                ? error
                : new ExternalServiceError({
                    message: error instanceof Error ? error.message : 'Failed to send email',
                    code: ErrorCode.EMAIL_SEND_FAILED,
                    serviceName: 'Email',
                    cause: error instanceof Error ? error : undefined,
                });

            this.logger.error('Email sending failed', {
                error: emailError,
                metadata: { to: resolvedTo },
            });

            throw emailError;
        }
    }

    private async executeTransform(
        config: TransformNodeConfig & { jsCode?: string },
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ExecutionOutput> {
        const { code: configCode, mapping, jsCode } = config;
        const code = configCode || jsCode;

        if (code) {
            try {
                const result = await this.sandbox.execute(code, input);

                if (result && typeof result === 'object' && 'error' in result) {
                    throw new SandboxError({
                        ...commonErrorContext,
                        message: `Sandbox execution error: ${result.error}`,
                        code: ErrorCode.SANDBOX_EXECUTION_FAILED,
                        userMessage: 'Code execution failed',
                    });
                }

                return result;
            } catch (error) {
                if (error instanceof SandboxError) {
                    throw error;
                }

                const sandboxError = new SandboxError({
                    message: error instanceof Error ? error.message : 'Unknown sandbox error',
                    code: ErrorCode.SANDBOX_EXECUTION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                    userMessage: 'Failed to execute transformation code',
                });

                this.logger.error('Transform node execution failed', {
                    error: sandboxError,
                });

                throw sandboxError;
            }
        }

        if (mapping) {
            try {
                const result: ExecutionOutput = {};
                for (const [key, value] of Object.entries(mapping)) {
                    result[key] = this.resolveTemplate(value, input, options);
                }
                return result;
            } catch (error) {
                throw new NodeExecutionError({
                    message: `Failed to map transformation: ${error instanceof Error ? error.message : String(error)}`,
                    nodeId: '',
                    nodeName: 'Transform',
                    nodeType: 'Transform',
                    code: ErrorCode.NODE_EXECUTION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                });
            }
        }

        return input;
    }

    private async executeCondition(
        config: ConditionNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<ConditionResult> {
        const { condition, field, operator, value } = config;

        let result = false;

        if (condition) {
            try {
                result = await this.sandbox.evaluateCondition(condition, input);
            } catch (error) {
                throw new NodeExecutionError({
                    ...commonErrorContext,
                    message: `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
                    code: ErrorCode.CONDITION_EVALUATION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                });
            }
        } else if (field && operator) {
            const fieldValue = this.getNestedValue(input, field);
            const compareValue = value ? this.resolveTemplate(value, input, options) : '';

            switch (operator) {
                case 'equals':
                    result = fieldValue == compareValue;
                    break;
                case 'notEquals':
                    result = fieldValue != compareValue;
                    break;
                case 'contains':
                    result = String(fieldValue).includes(compareValue);
                    break;
                case 'greaterThan':
                    result = Number(fieldValue) > Number(compareValue);
                    break;
                case 'lessThan':
                    result = Number(fieldValue) < Number(compareValue);
                    break;
                case 'isEmpty':
                    result = !fieldValue || fieldValue === '';
                    break;
                case 'isNotEmpty':
                    result = !!fieldValue && fieldValue !== '';
                    break;
            }
        }

        return { 
            ...input, 
            conditionResult: result,
            __activePorts: result ? [0] : [1] 
        };
    }

    private async executeDatabase(
        config: DatabaseNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<DatabaseResult> {
        const { operation, table, query, data } = config;

        return {
            operation,
            table,
            query: this.resolveTemplate(query || '', input, options),
            data: data ? JSON.parse(this.resolveTemplate(JSON.stringify(data), input, options)) : null,
            message: 'Database operations require connection configuration',
        };
    }

    private async executeDelay(config: DelayNodeConfig): Promise<DelayResult> {
        const { duration = 1000 } = config;

        await new Promise(resolve => setTimeout(resolve, duration));

        return { delayed: true, duration };
    }

    private async executeLoop(
        config: LoopNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext
    ): Promise<LoopResult> {
        const { items, itemsPath } = config;

        const loopItems = itemsPath
            ? this.getNestedValue(input, itemsPath)
            : items || [];

        return {
            items: Array.isArray(loopItems) ? loopItems : [],
            count: Array.isArray(loopItems) ? loopItems.length : 0,
        };
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
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Storage key is required for Set operation', code: ErrorCode.CONFIGURATION_ERROR });
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
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Storage key is required for Get operation', code: ErrorCode.CONFIGURATION_ERROR });
        }

        const resolvedBucketName = this.resolveTemplate(bucketName, input, options);
        const resolvedKey = this.resolveTemplate(key, input, options);

        const bucket = await this.prisma.storageBucket.findUnique({
            where: { tenantId_name: { tenantId, name: resolvedBucketName } },
        });

        if (!bucket) {
            return { ...input, [resolvedKey]: null };
        }

        const data = (bucket.data as Record<string, unknown>) || {};
        const value = data[resolvedKey] || null;

        return { ...input, [resolvedKey]: value };
    }

    private async executeSuspend(
        config: SuspendNodeConfig,
        input: ExecutionInput
    ): Promise<SuspendResult> {
        return { ...input, isSuspended: true };
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
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Metadata is not defined for SetMetadata operation',
                userMessage: 'Metadata for the node is empty',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        const resolvedMetadata = JSON.parse(this.resolveTemplate(JSON.stringify(metadata), input, options));

        const execution = await this.prisma.execution.findUnique({
            where: { id: executionId },
            select: { metadata: true },
        });

        const currentMetadata = (execution?.metadata as Record<string, unknown>) || {};
        const newMetadata = { ...currentMetadata, ...resolvedMetadata };

        await this.prisma.execution.update({
            where: { id: executionId },
            data: { metadata: newMetadata as Prisma.InputJsonValue },
        });

        return { success: true, metadata: newMetadata };
    }

    private async executeCreateTicket(
        config: CreateTicketNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<CreateTicketResult> {
        const { webhookUrl, subject, body } = config;

        if (!webhookUrl) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Webhook URL is not defined for Create Ticket operation',
                userMessage: 'Webhook URL for ticket creation is empty',
                code: ErrorCode.CONFIGURATION_ERROR,
            });
        }

        const resolvedWebhookUrl = this.resolveTemplate(webhookUrl, input, options);
        const resolvedSubject = this.resolveTemplate(subject || '', input, options);
        const resolvedBody = this.resolveTemplate(body || '', input, options);

        try {
            const response = await axios.post(resolvedWebhookUrl, {
                subject: resolvedSubject,
                body: resolvedBody,
                source: 'NanoFlow',
                inputContext: input,
            });

            return {
                success: true,
                response: response.data,
                webhookUrl: resolvedWebhookUrl,
            };
        } catch (error) {
            const ticketError = new NodeExecutionError({
                ...commonErrorContext,
                message: `Failed to create ticket: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
                userMessage: 'Failed to send ticket information to external system',
                cause: error instanceof Error ? error : undefined,
                context: { webhookUrl: resolvedWebhookUrl },
            });
            this.logger.error('Create Ticket node failed', { error: ticketError });
            throw ticketError;
        }
    }

    private resolveTemplate(template: string, input: ExecutionInput, options: NodeExecutionOptions = {}): string {
        if (typeof template !== 'string') return String(template);

        return template.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
            return this.evaluateExpressionSync(expression.trim(), input, options);
        });
    }

    private evaluateExpressionSync(expression: string, input: ExecutionInput, options: NodeExecutionOptions): string {
        let path = expression;
        if (path.startsWith('$json.')) {
            path = path.substring(6);
            const val = this.getNestedValue(input, path);
            return val !== undefined ? String(val) : '';
        }

        const nodeMatch = path.match(/^\$node\["([^"]+)"\](?:\.json)?\.(.+)$/);
        if (nodeMatch) {
            const [_, nodeName, restPath] = nodeMatch;
            const targetNode = options.workflowNodes?.find(n => n.title === nodeName);
            if (targetNode && options.nodeOutputs && options.nodeOutputs[targetNode.id]) {
                const nodeData = options.nodeOutputs[targetNode.id];
                const val = this.getNestedValue(nodeData as any, restPath);
                return val !== undefined ? String(val) : '';
            }
            return '';
        }

        const val = this.getNestedValue(input, path);
        return val !== undefined ? String(val) : '';
    }

    private getNestedValue(obj: any, path: string): unknown {
        return path.split('.').reduce<unknown>((current, key) => {
            if (current && typeof current === 'object' && key in current) {
                return (current as Record<string, unknown>)[key];
            }
            return undefined;
        }, obj);
    }

    private async executeN8n(
        config: N8nNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext,
        options: NodeExecutionOptions
    ): Promise<N8nResult> {
        const { workflowId, waitForCompletion = true, timeout = 30000, inputMapping } = config;

        if (!workflowId) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'n8n workflow ID is required',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        let n8nInput = input;
        if (inputMapping) {
            n8nInput = {};
            for (const [key, path] of Object.entries(inputMapping)) {
                n8nInput[key] = this.resolveTemplate(path, input, options);
            }
        }

        try {
            const execution = await n8nService.executeWorkflow(workflowId, n8nInput);

            if (waitForCompletion && execution.id) {
                const startTime = Date.now();
                let status = await n8nService.getExecution(execution.id);

                while (status.status === 'running' || status.status === 'waiting') {
                    if (Date.now() - startTime > timeout) {
                        throw new NodeExecutionError({
                            message: `n8n workflow execution timed out after ${timeout}ms`,
                            nodeId: '',
                            nodeName: 'n8n',
                            nodeType: 'n8n',
                            code: ErrorCode.NODE_EXECUTION_FAILED,
                        });
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

            return {
                executionId: execution.id || 'pending',
                workflowId,
                status: 'running',
                data: {},
                startedAt: new Date().toISOString(),
            };
        } catch (error) {
            if (error instanceof NodeExecutionError) {
                throw error;
            }

            throw new NodeExecutionError({
                message: `n8n workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '',
                nodeName: 'n8n',
                nodeType: 'n8n',
                code: ErrorCode.NODE_EXECUTION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private getHttpErrorCode(statusCode: number): ErrorCode {
        if (statusCode === 408 || statusCode === 504) {
            return ErrorCode.HTTP_TIMEOUT;
        } else if (statusCode === 401 || statusCode === 403) {
            return ErrorCode.HTTP_REQUEST_FAILED;
        } else if (statusCode >= 500) {
            return ErrorCode.HTTP_REQUEST_FAILED;
        } else if (statusCode >= 400) {
            return ErrorCode.HTTP_REQUEST_FAILED;
        }
        return ErrorCode.HTTP_REQUEST_FAILED;
    }
}
