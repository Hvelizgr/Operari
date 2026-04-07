import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import {
    WorkflowNode,
    NodeExecutionResult,
} from '../types/workflow.types';
import { SplitNodeExecutor } from './logic/split-node.executor';
import { JoinNodeExecutor } from './logic/join-node.executor';
import { RepeatNodeExecutor } from './logic/repeat-node.executor';
import { MultiplexNodeExecutor } from './logic/multiplex-node.executor';
import { DelayNodeExecutor } from './nodes/delay.executor';
import { TransformNodeExecutor } from './nodes/transform.executor';
import { ConditionNodeExecutor } from './nodes/condition.executor';
import { NoteNodeExecutor } from './nodes/note.executor';
import { HttpNodeExecutor } from './nodes/http.executor';
import { EmailNodeExecutor } from './nodes/email.executor';
import { DatabaseNodeExecutor } from './nodes/database.executor';
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
    NodeExecutionError,
    ErrorCode,
} from '../errors/custom-error';
import { Logger } from '../services/logger.service';
import {
    NodeErrorContext,
    resolveTemplate as sharedResolveTemplate,
    getNestedValue as sharedGetNestedValue,
} from './nodes/_shared';
import type { ExecutionInput } from '../types/workflow.types';

// Local alias preserved so the existing call sites compile unchanged.
// New code should import NodeErrorContext from ./nodes/_shared directly.
type commonErrorContext = NodeErrorContext

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditorExecutor = EditorNodeExecutor<any, any>;

export class NodeExecutor {
    private emailTransporter: nodemailer.Transporter | null = null;
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

        const editorNodeDeps = { logger: this.logger };

        // Pure-logic nodes
        register(new DelayNodeExecutor());
        register(new TransformNodeExecutor(editorNodeDeps));
        register(new ConditionNodeExecutor());
        register(new NoteNodeExecutor());

        // IO nodes
        register(new HttpNodeExecutor({ logger: this.logger }));
        register(
            new EmailNodeExecutor({
                logger: this.logger,
                getEmailTransporter: () => this.emailTransporter,
            }),
        );
        register(new DatabaseNodeExecutor());

        // State nodes
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

        // Multi-target / fan-out logic nodes
        register(new SplitNodeExecutor());
        register(new JoinNodeExecutor());
        register(new RepeatNodeExecutor());
        register(new MultiplexNodeExecutor());

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
