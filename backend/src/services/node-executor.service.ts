import * as nodemailer from 'nodemailer';
import * as ivm from 'isolated-vm';
import { PrismaClient } from '@prisma/client';
import {
    WorkflowNode,
    ExecutionInput,
    ExecutionOutput,
    NodeExecutionResult,
    TriggerResult,
    HttpResult,
    EmailResult,
    ConditionResult,
    DelayResult,
    LoopResult,
    DatabaseResult,
    N8nResult,
    HttpNodeConfig,
    EmailNodeConfig,
    TransformNodeConfig,
    ConditionNodeConfig,
    DatabaseNodeConfig,
    DelayNodeConfig,
    LoopNodeConfig,
    N8nNodeConfig,
} from '../types/workflow.types';
import { n8nService } from './n8n.service';
import {
    HttpError,
    SandboxError,
    ExternalServiceError,
    NodeExecutionError,
    ErrorCode,
    ErrorSeverity,
} from '../errors/custom-error';
import { Logger } from './logger.service';
import { withHttpRetry, withExternalServiceRetry, RetryOptions } from '../utils/retry';

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
    }

    async execute(node: WorkflowNode, input: ExecutionInput): Promise<NodeExecutionResult> {
        const config = node.config || {};

        switch (node.type) {
            case 'Webhook':
            case 'Trigger':
            case 'Schedule':
                return this.executeTrigger(input);

            case 'HTTP':
            case 'Api':
                return this.executeHttp(config as HttpNodeConfig, input);

            case 'Email':
                return this.executeEmail(config as EmailNodeConfig, input);

            case 'Transform':
            case 'Code':
                return this.executeTransform(config as TransformNodeConfig, input);

            case 'Condition':
            case 'If':
                return this.executeCondition(config as ConditionNodeConfig, input);

            case 'Database':
            case 'SQL':
                return this.executeDatabase(config as DatabaseNodeConfig, input);

            case 'Delay':
            case 'Wait':
                return this.executeDelay(config as DelayNodeConfig);

            case 'Loop':
            case 'Iterator':
                return this.executeLoop(config as LoopNodeConfig, input);

            case 'n8n':
                return this.executeN8n(config as N8nNodeConfig, input);

            default:
                return { ...input, nodeType: node.type };
        }
    }

    private async executeTrigger(input: ExecutionInput): Promise<TriggerResult> {
        return { ...input, triggered: true, timestamp: new Date().toISOString() };
    }

    private async executeHttp(
        config: HttpNodeConfig,
        input: ExecutionInput
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
        input: ExecutionInput
    ): Promise<EmailResult> {
        if (!this.emailTransporter) {
            throw new ExternalServiceError({
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

    private async executeTransform(
        config: TransformNodeConfig,
        input: ExecutionInput
    ): Promise<ExecutionOutput> {
        const { code, mapping } = config;

        if (code) {
            // Ejecutar código de usuario en sandbox aislado con timeout y límite de memoria
            try {
                const result = await this.sandbox.execute(code, input);

                // Verificar si hubo error en la ejecución
                if (result && typeof result === 'object' && 'error' in result) {
                    throw new SandboxError({
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
                    result[key] = this.resolveTemplate(value, input);
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
        input: ExecutionInput
    ): Promise<ConditionResult> {
        const { condition, field, operator, value } = config;

        let result = false;

        if (condition) {
            // Evaluar condición en sandbox aislado
            try {
                result = await this.sandbox.evaluateCondition(condition, input);
            } catch (error) {
                throw new NodeExecutionError({
                    message: `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
                    nodeId: '',
                    nodeName: 'Condition',
                    nodeType: 'Condition',
                    code: ErrorCode.CONDITION_EVALUATION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                });
            }
        } else if (field && operator) {
            const fieldValue = this.getNestedValue(input, field);
            const compareValue = value ? this.resolveTemplate(value, input) : '';

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

        return { ...input, conditionResult: result };
    }

    private async executeDatabase(
        config: DatabaseNodeConfig,
        input: ExecutionInput
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

    private async executeDelay(config: DelayNodeConfig): Promise<DelayResult> {
        const { duration = 1000 } = config;

        await new Promise(resolve => setTimeout(resolve, duration));

        return { delayed: true, duration };
    }

    private async executeLoop(
        config: LoopNodeConfig,
        input: ExecutionInput
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

    private resolveTemplate(template: string, context: ExecutionInput): string {
        if (typeof template !== 'string') return String(template);

        return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
            const value = this.getNestedValue(context, path.trim());
            return value !== undefined ? String(value) : '';
        });
    }

    private getNestedValue(obj: ExecutionInput, path: string): unknown {
        return path.split('.').reduce<unknown>((current, key) => {
            if (current && typeof current === 'object' && key in current) {
                return (current as Record<string, unknown>)[key];
            }
            return undefined;
        }, obj);
    }

    private async executeN8n(
        config: N8nNodeConfig,
        input: ExecutionInput
    ): Promise<N8nResult> {
        const { workflowId, waitForCompletion = true, timeout = 30000, inputMapping } = config;

        if (!workflowId) {
            throw new NodeExecutionError({
                message: 'n8n workflow ID is required',
                nodeId: '',
                nodeName: 'n8n',
                nodeType: 'n8n',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }

        // Aplicar mapeo de inputs si existe
        let n8nInput = input;
        if (inputMapping) {
            n8nInput = {};
            for (const [key, path] of Object.entries(inputMapping)) {
                n8nInput[key] = this.getNestedValue(input, path);
            }
        }



        try {
            // Ejecutar workflow de n8n
            const execution = await n8nService.executeWorkflow(workflowId, n8nInput);

            if (waitForCompletion && execution.id) {
                // Esperar a que termine la ejecución
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
