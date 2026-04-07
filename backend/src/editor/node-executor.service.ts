import * as ivm from 'isolated-vm';
import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import {
    WorkflowNode,
    ExecutionInput,
    ExecutionOutput,
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
import { HttpNodeExecutor } from './nodes/http.executor';
import { EmailNodeExecutor } from './nodes/email.executor';
import { DatabaseNodeExecutor } from './nodes/database.executor';
import { CreateTicketNodeExecutor } from './nodes/create-ticket.executor';
import { TriggerNodeExecutor } from './nodes/trigger.executor';
import { LoopNodeExecutor } from './nodes/loop.executor';
import { SuspendNodeExecutor } from './nodes/suspend.executor';
import { StoreSetNodeExecutor } from './nodes/store-set.executor';
import { StoreGetNodeExecutor } from './nodes/store-get.executor';
import { SetMetadataNodeExecutor } from './nodes/set-metadata.executor';
import { ShellCommandNodeExecutor } from './nodes/shell-command.executor';
import type { EditorNodeExecutor } from './nodes/_shared';
import { createExecutorRegistry } from '../runbook/executors';
import type { StepExecutor, ExecutorContext } from '../runbook/types/executor.types';
import { socketService } from './execution/socket.service';
import {
    SandboxError,
    NodeExecutionError,
    ErrorCode,
    ErrorSeverity,
} from '../errors/custom-error';
import { Logger } from '../services/logger.service';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditorExecutor = EditorNodeExecutor<any, any>;

export class NodeExecutor {
    private emailTransporter: nodemailer.Transporter | null = null;
    private sandbox: SecureSandbox;
    private prisma: PrismaClient;
    private logger: Logger;
    /**
     * Single registry of every editor node type, keyed by canonical type
     * AND by every alias declared on the executor. The dispatcher does
     * one Map.get() instead of a 27-case switch.
     *
     * Built once in the constructor; immutable thereafter.
     */
    private editorRegistry: Map<string, AnyEditorExecutor>;
    // NanoRun: registry of runbook executors (shell, approval, notify, wait).
    // Kept separate from editorRegistry because the runbook executors use a
    // different context shape; step 6 of ADR 0002 will merge the two.
    private runbookRegistry: Map<string, StepExecutor>;

    constructor(prisma?: PrismaClient) {
        // Initialize the JS sandbox with conservative defaults
        this.sandbox = new SecureSandbox({
            timeout: 5000,      // 5 seconds max
            memoryLimit: 128,   // 128 MB max
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

        this.runbookRegistry = createExecutorRegistry(this.prisma);
        this.editorRegistry = this.buildEditorRegistry();
    }

    /**
     * Build the editor node registry. Each executor is registered under
     * its canonical type and under every alias it declares. Throws on
     * duplicate registration so a copy/paste bug surfaces immediately
     * instead of silently routing one node type to the wrong executor.
     */
    private buildEditorRegistry(): Map<string, AnyEditorExecutor> {
        const registry = new Map<string, AnyEditorExecutor>();
        const register = (executor: AnyEditorExecutor) => {
            const types = [executor.type, ...(executor.aliases ?? [])];
            for (const t of types) {
                if (registry.has(t)) {
                    throw new Error(
                        `Duplicate editor node type registration: ${t} (already mapped to ${registry.get(t)!.type})`,
                    );
                }
                registry.set(t, executor);
            }
        };

        const editorNodeDeps = { sandbox: this.sandbox, logger: this.logger };

        // Pure-logic nodes (ADR 0002 step 2)
        register(new DelayNodeExecutor());
        register(new TransformNodeExecutor(editorNodeDeps));
        register(new ConditionNodeExecutor(editorNodeDeps));
        register(new NoteNodeExecutor());

        // IO nodes (ADR 0002 step 3)
        register(new HttpNodeExecutor({ logger: this.logger }));
        register(
            new EmailNodeExecutor({
                logger: this.logger,
                getEmailTransporter: () => this.emailTransporter,
            }),
        );
        register(new DatabaseNodeExecutor());
        register(new CreateTicketNodeExecutor({ logger: this.logger }));

        // State nodes (ADR 0002 step 4)
        register(new TriggerNodeExecutor());
        register(new LoopNodeExecutor());
        register(new SuspendNodeExecutor());
        register(new StoreSetNodeExecutor(this.prisma));
        register(new StoreGetNodeExecutor(this.prisma));
        register(new SetMetadataNodeExecutor(this.prisma));

        // Shell command — adapter that delegates to the runbook ShellExecutor
        // through `this.runbookRegistry.get('shell')`. Looking it up via a
        // getter means tests can swap the runbook executor without rebuilding
        // the editor registry.
        register(
            new ShellCommandNodeExecutor(
                { logger: this.logger },
                () => this.runbookRegistry.get('shell'),
            ),
        );

        // Logic nodes (editor/logic/*, refactored in step 6 to implement
        // EditorNodeExecutor directly — no more adapter wrapper needed).
        register(new DecisionNodeExecutor());
        register(new SplitNodeExecutor());
        register(new JoinNodeExecutor());
        register(new RepeatNodeExecutor());
        register(new MultiplexNodeExecutor());
        register(new LimitNodeExecutor());
        register(new ActionNodeExecutor());

        return registry;
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

    async execute(
        node: WorkflowNode,
        input: ExecutionInput,
        tenantId?: string,
        executionId?: string,
    ): Promise<NodeExecutionResult> {
        const commonErrorContext = {
            nodeId: node.id,
            nodeName: node.title,
            nodeType: node.type,
        };

        // 1. Runbook executors (shell/approval/notify/wait) take precedence
        //    so the runbook engine can intercept node types it owns.
        const runbookResult = await this.tryRunbookExecutor(
            node,
            input,
            tenantId,
            executionId,
        );
        if (runbookResult !== null) {
            return runbookResult;
        }

        // 2. Editor registry — single Map.get instead of a 27-case switch.
        const editorExecutor = this.editorRegistry.get(node.type);
        if (editorExecutor) {
            return editorExecutor.execute(
                node.config ?? {},
                input,
                commonErrorContext,
                tenantId,
                executionId,
            );
        }

        // 3. Unknown node type — fail loud.
        throw new NodeExecutionError({
            ...commonErrorContext,
            message: `Unknown node type: ${node.type}`,
            code: ErrorCode.NODE_NOT_FOUND,
            userMessage: `Node type '${node.type}' is not recognized or supported.`,
        });
    }

    private resolveTemplate(template: string, context: ExecutionInput): string {
        return sharedResolveTemplate(template, context);
    }

    private getNestedValue(obj: ExecutionInput, path: string): unknown {
        return sharedGetNestedValue(obj, path);
    }
}
