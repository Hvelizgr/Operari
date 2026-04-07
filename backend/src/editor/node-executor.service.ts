import * as ivm from 'isolated-vm';
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
import { DelayNodeExecutor } from './nodes/delay.executor';
import { TransformNodeExecutor } from './nodes/transform.executor';
import { ConditionNodeExecutor } from './nodes/condition.executor';
import { NoteNodeExecutor } from './nodes/note.executor';
import { createExecutorRegistry } from '../runbook/executors';
import type { StepExecutor, ExecutorContext } from '../runbook/types/executor.types';
import type { ShellConfig } from '../runbook/executors/shell.executor';
import { socketService } from './execution/socket.service';
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
import {
    NodeErrorContext,
    resolveTemplate as sharedResolveTemplate,
    getNestedValue as sharedGetNestedValue,
} from './nodes/_shared';

// Local alias preserved so the existing call sites compile unchanged.
// New code should import NodeErrorContext from ./nodes/_shared directly.
type commonErrorContext = NodeErrorContext

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

    constructor(config: Partial<SandboxConfig> = {}) {
        this.config = {
            timeout: config.timeout ?? 5000,      // 5 segundos por defecto
            memoryLimit: config.memoryLimit ?? 128, // 128 MB por defecto
        };
    }

    async execute(code: string, input: ExecutionInput): Promise<ExecutionOutput> {
        const isolate = new ivm.Isolate({ memoryLimit: this.config.memoryLimit });

        try {
            const context = await isolate.createContext();
            const jail = context.global;

            // Configurar el objeto global con funciones permitidas
            await jail.set('global', jail.derefInto());

            // Inyectar las funciones permitidas de la whitelist
            for (const [key, value] of Object.entries(ALLOWED_GLOBALS)) {
                if (typeof value === 'object' && value !== null) {
                    await jail.set(key, new ivm.ExternalCopy(value).copyInto());
                } else if (typeof value === 'function') {
                    await jail.set(key, new ivm.Reference(value));
                }
            }

            // Inyectar el input de forma segura
            await jail.set('input', new ivm.ExternalCopy(input).copyInto());

            // Crear una variable para almacenar el resultado
            await jail.set('__result__', undefined);

            // Envolver el código para capturar el resultado
            const wrappedCode = `
                (function() {
                    try {
                        const __userCode__ = function(input) {
                            ${code}
                        };
                        __result__ = __userCode__(input);
                    } catch (e) {
                        __result__ = { error: e.message || 'Error de ejecución' };
                    }
                })();
            `;

            // Compilar y ejecutar el código con timeout
            const script = await isolate.compileScript(wrappedCode);
            await script.run(context, { timeout: this.config.timeout });

            // Obtener el resultado
            const resultRef = await jail.get('__result__');
            const result = resultRef instanceof ivm.Reference
                ? await resultRef.copy()
                : resultRef;

            return result as ExecutionOutput;
        } finally {
            // Liberar recursos del isolate
            isolate.dispose();
        }
    }

    async evaluateCondition(condition: string, input: ExecutionInput): Promise<boolean> {
        const isolate = new ivm.Isolate({ memoryLimit: this.config.memoryLimit });

        try {
            const context = await isolate.createContext();
            const jail = context.global;

            await jail.set('global', jail.derefInto());

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
    // ADR 0002 step 2: pure-logic nodes extracted to ./nodes/
    private delayExecutor: DelayNodeExecutor;
    private transformExecutor: TransformNodeExecutor;
    private conditionExecutor: ConditionNodeExecutor;
    private noteExecutor: NoteNodeExecutor;
    // NanoRun: registry of new executors (shell, approval, notify, wait)
    private runbookRegistry: Map<string, StepExecutor>;

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
        // Pure-logic node executors share `this.sandbox` and `this.logger`
        // so existing tests that spy on `(nodeExecutor as any).sandbox`
        // keep observing the same instance.
        const editorNodeDeps = { sandbox: this.sandbox, logger: this.logger };
        this.delayExecutor = new DelayNodeExecutor();
        this.transformExecutor = new TransformNodeExecutor(editorNodeDeps);
        this.conditionExecutor = new ConditionNodeExecutor(editorNodeDeps);
        this.noteExecutor = new NoteNodeExecutor();
        this.runbookRegistry = createExecutorRegistry(this.prisma);
    }

    /**
     * NanoRun: try to execute the node using the new runbook executor registry.
     * Returns null if the node type is not registered (caller should fall through
     * to the legacy switch statement).
     */
    private async tryRunbookExecutor(
        node: WorkflowNode,
        input: ExecutionInput,
        tenantId: string | undefined,
        executionId: string | undefined,
    ): Promise<NodeExecutionResult | null> {
        const executor = this.runbookRegistry.get(node.type);
        if (!executor) return null;

        const context: ExecutorContext = {
            runId: executionId ?? 'unknown',
            stepId: node.id,
            variables: (input as Record<string, unknown>) ?? {},
            previousOutputs: (input as Record<string, unknown>) ?? {},
            tenantId: tenantId ?? 'default-tenant',
            emit: executionId
                ? (event) => {
                    socketService.emitLog(executionId, event.text.trimEnd(), {
                        nodeId: node.id,
                        nodeType: node.type,
                        stream: event.type,
                    });
                }
                : undefined,
        };

        const result = await executor.execute(node.config ?? {}, context);

        if (!result.success) {
            throw new NodeExecutionError({
                nodeId: node.id,
                nodeName: node.title,
                nodeType: node.type,
                message: result.error ?? 'Step failed',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        // NodeExecutionResult is a generic shape; we wrap the executor output in it
        return (result.output ?? { success: true }) as unknown as NodeExecutionResult;
    }

    async execute(node: WorkflowNode, input: ExecutionInput, tenantId?: string, executionId?: string): Promise<NodeExecutionResult> {
        const config = node.config || {};
        const commonErrorContext = {
            nodeId: node.id,
            nodeName: node.title,
            nodeType: node.type,
        };

        // NanoRun: check the new executor registry first (shell, approval, notify, wait)
        const runbookResult = await this.tryRunbookExecutor(node, input, tenantId, executionId);
        if (runbookResult !== null) {
            return runbookResult;
        }

        switch (node.type) {
            case 'Webhook':
            case 'Trigger':
            case 'Schedule':
                return this.executeTrigger(input);

            case 'HTTP':
            case 'Api':
                return this.executeHttp(config as HttpNodeConfig, input, commonErrorContext);

            case 'Email':
                return this.executeEmail(config as EmailNodeConfig, input, commonErrorContext);
            case 'custom.email':
                return this.executeEmail(config as EmailNodeConfig, input, commonErrorContext);

            case 'Transform':
            case 'Code':
                return this.transformExecutor.execute(
                    config as TransformNodeConfig,
                    input,
                    commonErrorContext,
                );

            case 'Condition':
            case 'If':
                return this.conditionExecutor.execute(
                    config as ConditionNodeConfig,
                    input,
                    commonErrorContext,
                );

            case 'Database':
            case 'SQL':
                return this.executeDatabase(config as DatabaseNodeConfig, input, commonErrorContext);

            case 'Delay':
            case 'Wait':
                return this.delayExecutor.execute(
                    config as DelayNodeConfig,
                    input,
                    commonErrorContext,
                );

            case 'Loop':
            case 'Iterator':
                return this.executeLoop(config as LoopNodeConfig, input, commonErrorContext);

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
                return this.executeShellCommand(config as ShellCommandNodeConfig, input, commonErrorContext);

            case 'StoreSet':
                if (!tenantId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Tenant ID is required for storage operations', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeStoreSet(config as StoreSetNodeConfig, input, tenantId, commonErrorContext);

            case 'StoreGet':
                if (!tenantId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Tenant ID is required for storage operations', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeStoreGet(config as StoreGetNodeConfig, input, tenantId, commonErrorContext);

            case 'Suspend':
                return this.executeSuspend(config as SuspendNodeConfig, input);

            case 'SetMetadata':
                if (!executionId) throw new NodeExecutionError({ ...commonErrorContext, message: 'Execution ID is required for SetMetadata operation', code: ErrorCode.CONFIGURATION_ERROR });
                return this.executeSetMetadata(config as SetMetadataNodeConfig, input, executionId, commonErrorContext);

            case 'CreateTicket':
                return this.executeCreateTicket(config as CreateTicketNodeConfig, input, commonErrorContext);

            case 'custom.note':
                return this.noteExecutor.execute(
                    config as Record<string, unknown>,
                    input,
                    commonErrorContext,
                );


            default:
                // Handle unknown node types with an error
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
        commonErrorContext: commonErrorContext
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

        // Delegate to the runbook ShellExecutor — it goes through the configured
        // Runner (local / docker / fly), enforcing NANORUN_RUNNER. This removes
        // the raw child_process.exec path that was a multi-tenant RCE bomb.
        // See IMPLEMENTACION_NANORUN.md P0 #1 and SECURITY.md.
        const shellExecutor = this.runbookRegistry.get('shell');
        if (!shellExecutor) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Shell executor is not registered in the runbook registry',
                userMessage: 'Shell command execution is not available on this server',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        const shellConfig: ShellConfig = { command };

        const context: ExecutorContext = {
            runId: 'editor-preview',
            stepId: commonErrorContext.nodeId,
            variables: (input as Record<string, unknown>) ?? {},
            previousOutputs: (input as Record<string, unknown>) ?? {},
            tenantId: 'default-tenant',
        };

        const result = await shellExecutor.execute(shellConfig, context);

        if (!result.success) {
            const stderr = (result.output as { stderr?: string } | undefined)?.stderr ?? '';
            const execError = new NodeExecutionError({
                ...commonErrorContext,
                message: `Shell command failed: ${result.error ?? 'unknown error'}`,
                userMessage: `Command failed: ${result.error ?? 'unknown error'}. Stderr: ${stderr}`,
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
            this.logger.error('Shell command execution failed', {
                error: execError,
                metadata: { command, stderr },
            });
            throw execError;
        }

        const out = (result.output ?? {}) as { stdout?: string; stderr?: string };
        return { stdout: out.stdout ?? '', stderr: out.stderr ?? '' };
    }


    private async executeHttp(
        config: HttpNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext
    ): Promise<HttpResult> {
        const { url, method = 'GET', headers = {}, body, retries = 3 } = config;

        const resolvedUrl = this.resolveTemplate(url || '', input);
        const resolvedBody = body ? this.resolveTemplate(JSON.stringify(body), input) : undefined;

        try {
            const result = await withHttpRetry(
                async () => {
                    const response = await fetch(resolvedUrl, {
                        method,
                        headers: {
                            'Content-Type': 'application/json',
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
        commonErrorContext: commonErrorContext
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

        const resolvedTo = this.resolveTemplate(to || '', input);
        const resolvedSubject = this.resolveTemplate(subject || '', input);
        const resolvedBody = this.resolveTemplate(body || '', input);
        const resolvedHtml = html ? this.resolveTemplate(html, input) : undefined;

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

    private async executeDatabase(
        config: DatabaseNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext
    ): Promise<DatabaseResult> {
        const { operation, table, query, data } = config;

        return {
            operation,
            table,
            query: this.resolveTemplate(query || '', input),
            data: data ? JSON.parse(this.resolveTemplate(JSON.stringify(data), input)) : null,
            message: 'Database operations require connection configuration',
        };
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
        commonErrorContext: commonErrorContext
    ): Promise<StoreResult> {
        const { bucketName = 'default', key, value } = config;

        if (!key) {
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Storage key is required for Set operation', code: ErrorCode.CONFIGURATION_ERROR });
        }

        const resolvedBucketName = this.resolveTemplate(bucketName, input);
        const resolvedKey = this.resolveTemplate(key, input);
        const resolvedValue = this.resolveTemplate(value, input);

        const bucket = await this.prisma.storageBucket.upsert({
            where: { tenantId_name: { tenantId, name: resolvedBucketName } },
            create: { name: resolvedBucketName, tenantId, data: {} as Prisma.InputJsonValue }, // Ensure data is initialized
            update: {},
        });

        const currentData = (bucket.data as Record<string, unknown>) || {};
        const newData = { ...currentData, [resolvedKey]: resolvedValue };

        await this.prisma.storageBucket.update({
            where: { id: bucket.id },
            data: { data: newData as Prisma.InputJsonValue }, // Explicitly cast to Prisma.InputJsonValue
        });

        return { success: true, key: resolvedKey, value: resolvedValue };
    }

    private async executeStoreGet(
        config: StoreGetNodeConfig,
        input: ExecutionInput,
        tenantId: string,
        commonErrorContext: commonErrorContext
    ): Promise<ExecutionOutput> {
        const { bucketName = 'default', key } = config;

        if (!key) {
            throw new NodeExecutionError({ ...commonErrorContext, message: 'Storage key is required for Get operation', code: ErrorCode.CONFIGURATION_ERROR });
        }

        const resolvedBucketName = this.resolveTemplate(bucketName, input);
        const resolvedKey = this.resolveTemplate(key, input);

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
        // This node doesn't do anything but signal the execution service to pause.
        return { ...input, isSuspended: true };
    }

    private async executeSetMetadata(
        config: SetMetadataNodeConfig,
        input: ExecutionInput,
        executionId: string,
        commonErrorContext: commonErrorContext
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

        const resolvedMetadata = JSON.parse(this.resolveTemplate(JSON.stringify(metadata), input));

        const execution = await this.prisma.execution.findUnique({
            where: { id: executionId },
            select: { metadata: true },
        });

        const currentMetadata = (execution?.metadata as Record<string, unknown>) || {};
        const newMetadata = { ...currentMetadata, ...resolvedMetadata };

        await this.prisma.execution.update({
            where: { id: executionId },
            data: { metadata: newMetadata as Prisma.InputJsonValue }, // Explicitly cast
        });

        return { success: true, metadata: newMetadata };
    }

    private async executeCreateTicket(
        config: CreateTicketNodeConfig,
        input: ExecutionInput,
        commonErrorContext: commonErrorContext
    ): Promise<CreateTicketResult> {
        const { webhookUrl, subject, body } = config;

        if (!webhookUrl) {
            throw new NodeExecutionError({
                ...commonErrorContext,
                message: 'Webhook URL is not defined for Create Ticket operation',
                userMessage: 'Webhook URL for ticket creation is empty',
                code: ErrorCode.CONFIGURATION_ERROR, // Changed to CONFIGURATION_ERROR
            });
        }

        const resolvedWebhookUrl = this.resolveTemplate(webhookUrl, input);
        const resolvedSubject = this.resolveTemplate(subject || '', input);
        const resolvedBody = this.resolveTemplate(body || '', input);

        try {
            const response = await axios.post(resolvedWebhookUrl, {
                subject: resolvedSubject,
                body: resolvedBody,
                source: 'NanoFlow',
                // Potentially include more context from input if desired
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
                code: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE, // Changed to EXTERNAL_SERVICE_UNAVAILABLE
                userMessage: 'Failed to send ticket information to external system',
                cause: error instanceof Error ? error : undefined,
                context: { webhookUrl: resolvedWebhookUrl },
            });
            this.logger.error('Create Ticket node failed', { error: ticketError });
            throw ticketError;
        }
    }

    private resolveTemplate(template: string, context: ExecutionInput): string {
        return sharedResolveTemplate(template, context);
    }

    private getNestedValue(obj: ExecutionInput, path: string): unknown {
        return sharedGetNestedValue(obj, path);
    }

    /**
     * Map HTTP status codes to appropriate error codes
     */
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
