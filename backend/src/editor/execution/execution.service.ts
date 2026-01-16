import { PrismaClient, ExecutionStatus, NodeLogStatus, TriggerType, Workflow, Prisma } from '@prisma/client';
import { NodeExecutor } from '../node-executor.service';
import { ErrorNotificationService } from '../../services/error-notification.service';
import { Logger, ContextLogger } from '../../services/logger.service';
import {
    WorkflowNode,
    WorkflowConnection,
    ExecutionInput,
    ExecutionOutput,
    SuspendResult,
} from '../../types/workflow.types';
import {
    CustomError,
    ErrorCode,
    ErrorSeverity,
    NodeExecutionError,
    WorkflowError,
    wrapError,
} from '../../errors/custom-error';
import { persistExecutionError } from '../../utils/error-persistence';
import { socketService } from './socket.service';

interface ExecuteParams {
    workflowId: string;
    userId: string;
    trigger: TriggerType;
    input?: ExecutionInput;
    tenantId?: string;
    startNodeId?: string;
}

interface ResumeParams {
    executionId: string;
    userId: string;
    tenantId: string;
    input?: ExecutionInput;
}

interface RunState {
    nodeOutputs: Record<string, ExecutionOutput>;
    executedNodes: Set<string>;
    nodesToExecute: WorkflowNode[];
}

export class ExecutionService {
    private prisma: PrismaClient;
    private nodeExecutor: NodeExecutor;
    private logger: Logger;
    private notificationService: ErrorNotificationService;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.nodeExecutor = new NodeExecutor(prisma);
        this.logger = Logger.getInstance();
        this.notificationService = new ErrorNotificationService(prisma);
    }

    async execute(params: ExecuteParams) {
        const { workflowId, userId, trigger, input = {}, tenantId, startNodeId } = params;

        try {
            // Fetch workflow
            const workflow = await this.prisma.workflow.findUnique({
                where: { id: workflowId },
            });

            if (!workflow) {
                throw new WorkflowError({
                    message: `Workflow not found: ${workflowId}`,
                    code: ErrorCode.WORKFLOW_NOT_FOUND,
                    workflowId,
                    context: { userId, tenantId },
                });
            }

            // Create execution record
            const execution = await this.prisma.execution.create({
                data: {
                    workflowId,
                    userId,
                    trigger,
                    status: 'RUNNING',
                },
            });

            // Create context logger for this execution
            const executionContext = {
                executionId: execution.id,
                workflowId,
                workflowName: workflow.name,
                userId,
                tenantId,
            };

            const contextLogger = this.logger.child(executionContext);
            contextLogger.info('Workflow execution started');
            socketService.emitLog(execution.id, 'Workflow execution started');

            // Run workflow asynchronously with proper error handling
            this.runWorkflow(
                execution.id,
                workflow,
                input,
                executionContext,
                tenantId,
                startNodeId
            ).catch((error) => {
                // This handles uncaught errors from runWorkflow
                this.logger.error('Uncaught error in workflow execution', {
                    context: executionContext,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            });

            return execution;
        } catch (error) {
            const wrappedError = wrapError(error, { workflowId, userId, tenantId });
            this.logger.error('Failed to initialize workflow execution', {
                error: wrappedError,
            });
            throw wrappedError;
        }
    }

    async replayExecution(params: {
        executionId: string;
        nodeId?: string;
        userId: string;
        tenantId: string;
    }) {
        const { executionId, nodeId, userId, tenantId } = params;

        // Fetch original execution and its logs
        const originalExecution = await this.prisma.execution.findUnique({
            where: { id: executionId },
            include: {
                workflow: true,
                nodeLogs: true
            }
        });

        if (!originalExecution) {
            throw new WorkflowError({
                message: `Original execution not found: ${executionId}`,
                code: ErrorCode.EXECUTION_NOT_FOUND,
                workflowId: '',
            });
        }

        // Create a new execution for the replay
        const newExecution = await this.prisma.execution.create({
            data: {
                workflowId: originalExecution.workflowId,
                userId,
                trigger: originalExecution.trigger,
                status: 'RUNNING',
            },
        });

        const executionContext = {
            executionId: newExecution.id,
            workflowId: originalExecution.workflowId,
            workflowName: originalExecution.workflow.name,
            userId,
            tenantId,
            isReplay: true,
            originalExecutionId: executionId,
        };

        const contextLogger = this.logger.child(executionContext);
        contextLogger.info('Workflow replay started');
        socketService.emitLog(newExecution.id, 'Workflow replay started');

        // Prepare initial state from historical data if replaying from a specific node
        if (nodeId) {
            const log = originalExecution.nodeLogs.find(l => l.nodeId === nodeId);
            if (!log) throw new Error('Node log not found for replay');

            this.runWorkflow(
                newExecution.id,
                originalExecution.workflow,
                log.input as any,
                executionContext,
                tenantId,
                nodeId
            ).catch(err => {
                this.logger.error('Error in replayed workflow', { context: executionContext, error: err });
            });
        } else {
            this.runWorkflow(
                newExecution.id,
                originalExecution.workflow,
                {}, // Start from the beginning
                executionContext,
                tenantId
            ).catch(err => {
                this.logger.error('Error in replayed workflow', { context: executionContext, error: err });
            });
        }

        return newExecution;
    }

    async resumeExecution(params: ResumeParams) {
        const { executionId, userId, tenantId, input = {} } = params;

        const execution = await this.prisma.execution.findFirst({
            where: {
                id: executionId,
                workflow: { tenantId },
                status: 'PAUSED'
            },
            include: { workflow: true },
        });

        if (!execution || !execution.workflow) {
            throw new WorkflowError({
                message: `Paused execution not found: ${executionId}`,
                code: ErrorCode.EXECUTION_NOT_FOUND,
                workflowId: '',
            });
        }

        const contextLogger = this.logger.child({ executionId, workflowId: execution.workflowId, userId, tenantId, isResumed: true });
        contextLogger.info('Workflow execution resumed');

        // Update status to running
        await this.prisma.execution.update({
            where: { id: executionId },
            data: { status: 'RUNNING', pausedAt: null },
        });

        const resumeState = execution.resumeState as any;
        const allNodes = execution.workflow.nodes as unknown as WorkflowNode[];

        // Restore state
        const initialState: RunState = {
            nodeOutputs: resumeState.nodeOutputs || {},
            executedNodes: new Set(resumeState.executedNodes || []),
            nodesToExecute: (resumeState.nodesToExecute || []).map((nodeId: string) => allNodes.find((n: WorkflowNode) => n.id === nodeId)).filter((n: WorkflowNode | undefined): n is WorkflowNode => !!n),
        };

        // Merge new input with the output of the node that paused the execution
        const lastExecutedNodeId = Array.from(initialState.executedNodes).pop();
        if (lastExecutedNodeId && initialState.nodeOutputs[lastExecutedNodeId]) {
            Object.assign(initialState.nodeOutputs[lastExecutedNodeId], input);
        }

        this.runWorkflow(
            execution.id,
            execution.workflow,
            {}, // Original input is already baked into the state
            { executionId, workflowId: execution.workflowId, userId, tenantId },
            tenantId,
            undefined,
            initialState
        ).catch((error) => {
            this.logger.error('Uncaught error in resumed workflow execution', {
                error: error instanceof Error ? error : new Error(String(error)),
            });
        });

        return execution;
    }

    private async runWorkflow(
        executionId: string,
        workflow: Workflow,
        input: ExecutionInput,
        executionContext: Record<string, unknown>,
        tenantId?: string,
        startNodeId?: string,
        initialState?: RunState
    ) {
        const startTime = Date.now();
        const contextLogger = this.logger.child(executionContext);

        // Cast Prisma JSON fields to typed arrays
        const nodes = workflow.nodes as unknown as WorkflowNode[];
        const connections = workflow.connections as unknown as WorkflowConnection[];

        try {
            // Validate workflow before execution
            if (!initialState) { // Only validate on first run, not on resume
                this.validateWorkflow(nodes, connections);
            }

            const nodeOutputs = initialState?.nodeOutputs || {};
            const executedNodes = initialState?.executedNodes ? new Set(initialState.executedNodes) : new Set<string>();

            let nodesToExecute: WorkflowNode[];
            if (initialState) {
                // If resuming, use the nodes that were pending execution
                nodesToExecute = initialState.nodesToExecute || [];
            } else if (startNodeId) {
                nodesToExecute = nodes.filter(n => n.id === startNodeId);
            } else {
                const triggerNodes = nodes.filter(n =>
                    n.type === 'Webhook' || n.type === 'Trigger' || n.type === 'Schedule'
                );
                nodesToExecute = triggerNodes.length > 0 ? triggerNodes : [nodes[0]];
            }

            while (nodesToExecute.length > 0) {

                const currentNode = nodesToExecute.shift()!;



                if (executedNodes.has(currentNode.id)) continue;



                // Skip disabled nodes

                if (currentNode.enabled === false) {

                    await this.prisma.nodeLog.create({

                        data: {

                            executionId,

                            nodeId: currentNode.id,

                            nodeName: currentNode.title,

                            nodeType: currentNode.type,

                            status: 'SKIPPED',

                            input: {} as any,

                        },

                    });

                    socketService.emitNodeStatus(executionId, currentNode.id, 'SKIPPED');

                    executedNodes.add(currentNode.id); // Mark as "executed" to allow children to run



                    // Add children of the skipped node to the execution queue

                    const nextNodes = connections

                        .filter(c => c.source === currentNode.id)

                        .map(c => nodes.find(n => n.id === c.target))

                        .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));

                    nodesToExecute.push(...nextNodes);



                    continue;

                }



                // Check if all parents have been executed (Synchronization logic for Join/Advanced nodes)

                const incomingConns = connections.filter(c => c.target === currentNode.id);
                const allParentsExecuted = incomingConns.every(c => executedNodes.has(c.source));

                if (incomingConns.length > 1 && !allParentsExecuted) {
                    // If the node has multiple inputs and not all are ready, we skip it for now.
                    // It will be re-queued when other parent nodes finish.
                    continue;
                }

                const nodeInput = this.getNodeInput(currentNode.id, connections, nodeOutputs, input);

                const nodeLog = await this.prisma.nodeLog.create({
                    data: {
                        executionId,
                        nodeId: currentNode.id,
                        nodeName: currentNode.title,
                        nodeType: currentNode.type,
                        status: 'RUNNING',
                        input: nodeInput as unknown as Prisma.InputJsonValue,
                    },
                });

                socketService.emitNodeStatus(executionId, currentNode.id, 'RUNNING');
                socketService.emitLog(executionId, `Node execution started: ${currentNode.title}`, { nodeId: currentNode.id });

                const nodeContext = {
                    ...executionContext,
                    nodeId: currentNode.id,
                    nodeName: currentNode.title,
                    nodeType: currentNode.type,
                };
                const nodeContextLogger = this.logger.child(nodeContext);
                const nodeStartTime = Date.now();

                try {
                    nodeContextLogger.debug('Node execution started');
                    const output = await this.nodeExecutor.execute(currentNode, nodeInput, tenantId, executionId);

                    // Handle suspend signal
                    if ((output as SuspendResult).isSuspended) {
                        await this.prisma.execution.update({
                            where: { id: executionId },
                            data: {
                                status: 'PAUSED',
                                pausedAt: new Date(),
                                resumeState: {
                                    nodeOutputs,
                                    executedNodes: Array.from(executedNodes),
                                    nodesToExecute: nodesToExecute.map(n => n.id),
                                } as any,
                            },
                        });
                        contextLogger.info('Workflow execution paused');
                        socketService.emitLog(executionId, 'Workflow execution paused', { nodeId: currentNode.id });
                        socketService.emitExecutionStatus(executionId, 'PAUSED');
                        return; // Stop execution
                    }

                    const nodeDuration = Date.now() - nodeStartTime;

                    nodeOutputs[currentNode.id] = output;
                    executedNodes.add(currentNode.id);

                    await this.prisma.nodeLog.update({
                        where: { id: nodeLog.id },
                        data: {
                            status: 'SUCCESS',
                            output: output as unknown as Prisma.InputJsonValue,
                            completedAt: new Date(),
                            duration: nodeDuration,
                        },
                    });

                    socketService.emitNodeStatus(executionId, currentNode.id, 'SUCCESS', output);
                    socketService.emitLog(executionId, `Node execution completed: ${currentNode.title}`, { nodeId: currentNode.id, duration: nodeDuration });

                    nodeContextLogger.debug('Node execution completed successfully', { duration: nodeDuration });

                    const nextNodes = connections
                        .filter(c => c.source === currentNode.id)
                        .map(c => nodes.find(n => n.id === c.target))
                        .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));

                    nodesToExecute.push(...nextNodes);
                } catch (error) {
                    const wrappedError = wrapError(error, nodeContext);
                    const nodeDuration = Date.now() - nodeStartTime;

                    // Persist error to database
                    await persistExecutionError(
                        this.prisma,
                        wrappedError,
                        executionId,
                        nodeLog.id
                    );

                    // Update node log with error
                    const errorMessage = wrappedError instanceof CustomError
                        ? wrappedError.userMessage
                        : error instanceof Error ? error.message : 'Unknown error';

                    await this.prisma.nodeLog.update({
                        where: { id: nodeLog.id },
                        data: {
                            status: 'FAILED',
                            error: errorMessage,
                            completedAt: new Date(),
                            duration: nodeDuration,
                        },
                    });

                    socketService.emitNodeStatus(executionId, currentNode.id, 'FAILED', { error: errorMessage });
                    socketService.emitLog(executionId, `Node execution failed: ${currentNode.title}`, { nodeId: currentNode.id, error: errorMessage });

                    nodeContextLogger.error('Node execution failed', { error: wrappedError });

                    // Handle retryable errors
                    if (wrappedError.isRetryable && wrappedError.context.retryCount! < (wrappedError.context.maxRetries ?? 3)) {
                        nodeContextLogger.warn('Retrying node execution', {
                            metadata: {
                                retryCount: (wrappedError.context.retryCount ?? 0) + 1,
                                maxRetries: wrappedError.context.maxRetries ?? 3,
                            },
                        });
                        // In a real scenario, you'd implement retry logic here
                    }

                    // Notify about error if it's high severity
                    if ([ErrorSeverity.HIGH, ErrorSeverity.CRITICAL].includes(wrappedError.severity)) {
                        const errorRecord = await this.prisma.executionError.findFirst({
                            where: {
                                executionId,
                                nodeLogId: nodeLog.id,
                                code: wrappedError.code,
                            },
                            orderBy: { createdAt: 'desc' },
                        });

                        if (errorRecord && tenantId) {
                            await this.notificationService.notifyError(
                                wrappedError,
                                executionId,
                                errorRecord.id,
                                tenantId
                            );
                            await this.notificationService.emitErrorEvent(wrappedError, executionId);
                        }
                    }

                    throw wrappedError;
                }
            }

            const duration = Date.now() - startTime;

            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: 'SUCCESS',
                    completedAt: new Date(),
                    duration,
                },
            });

            contextLogger.info('Workflow execution completed successfully', { duration });
        } catch (error) {
            const duration = Date.now() - startTime;
            const wrappedError = wrapError(error, executionContext);

            // Persist error to database
            await persistExecutionError(this.prisma, wrappedError, executionId);

            const errorMessage = wrappedError instanceof CustomError
                ? wrappedError.userMessage
                : error instanceof Error ? error.message : 'Unknown error';

            await this.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: 'FAILED',
                    error: errorMessage,
                    completedAt: new Date(),
                    duration,
                },
            });

            contextLogger.error('Workflow execution failed', {
                error: wrappedError,
                metadata: { duration },
            });

            // Notify about critical errors
            if (wrappedError instanceof CustomError && [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL].includes(wrappedError.severity)) {
                const errorRecord = await this.prisma.executionError.findFirst({
                    where: {
                        executionId,
                        code: wrappedError.code,
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (errorRecord && tenantId) {
                    await this.notificationService.notifyError(
                        wrappedError,
                        executionId,
                        errorRecord.id,
                        tenantId
                    );
                    await this.notificationService.emitErrorEvent(wrappedError, executionId);
                }
            }
        }
    }

    /**
     * Validate workflow structure before execution
     */
    private validateWorkflow(nodes: WorkflowNode[], connections: WorkflowConnection[]): void {
        if (!nodes || nodes.length === 0) {
            throw new WorkflowError({
                message: 'Workflow has no nodes',
                code: ErrorCode.WORKFLOW_INVALID,
                workflowId: '',
            });
        }

        // Validate all nodes exist
        const nodeIds = new Set(nodes.map(n => n.id));
        for (const conn of connections) {
            if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
                throw new WorkflowError({
                    message: `Connection references non-existent node: ${conn.source} -> ${conn.target}`,
                    code: ErrorCode.WORKFLOW_INVALID,
                    workflowId: '',
                });
            }
        }

        // Check for cycles (simplified - could be enhanced with full DFS)
        this.checkForCycles(nodeIds, connections);
    }

    /**
     * Check for circular dependencies in the workflow
     */
    private checkForCycles(nodeIds: Set<string>, connections: WorkflowConnection[]): void {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const path: string[] = [];

        const hasCycle = (nodeId: string): string[] | null => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const neighbors = connections
                .filter(c => c.source === nodeId)
                .map(c => c.target);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    const cyclePath = hasCycle(neighbor);
                    if (cyclePath) return cyclePath;
                } else if (recursionStack.has(neighbor)) {
                    const cycleStart = path.indexOf(neighbor);
                    return path.slice(cycleStart).concat(neighbor);
                }
            }

            recursionStack.delete(nodeId);
            path.pop();
            return null;
        };

        for (const nodeId of nodeIds) {
            if (!visited.has(nodeId)) {
                const cyclePath = hasCycle(nodeId);
                if (cyclePath) {
                    throw new WorkflowError({
                        message: `Workflow contains circular dependencies. Cycle detected: ${cyclePath.join(' → ')}`,
                        code: ErrorCode.WORKFLOW_INVALID,
                        workflowId: '',
                        context: { cyclePath, cycleNodes: cyclePath },
                    });
                }
            }
        }
    }

    private getNodeInput(
        nodeId: string,
        connections: WorkflowConnection[],
        nodeOutputs: Record<string, ExecutionOutput>,
        initialInput: ExecutionInput
    ): ExecutionInput {
        const incomingConnections = connections.filter(c => c.target === nodeId);

        if (incomingConnections.length === 0) {
            return initialInput;
        }

        const input: ExecutionInput = {};

        for (const conn of incomingConnections) {
            if (nodeOutputs[conn.source]) {
                Object.assign(input, nodeOutputs[conn.source]);
            }
        }

        return input;
    }
}
