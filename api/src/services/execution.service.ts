import { PrismaClient, ExecutionStatus, NodeLogStatus, TriggerType, Workflow, Prisma } from '@prisma/client';
import { NodeExecutor } from './node-executor.service';
import { ErrorNotificationService } from './error-notification.service';
import { Logger, ContextLogger } from './logger.service';
import {
    WorkflowNode,
    WorkflowConnection,
    ExecutionInput,
    ExecutionOutput,
} from '../types/workflow.types';
import {
    CustomError,
    ErrorCode,
    ErrorSeverity,
    NodeExecutionError,
    WorkflowError,
    wrapError,
} from '../errors/custom-error';
import { persistExecutionError } from '../utils/error-persistence';

interface ExecuteParams {
    workflowId: string;
    userId: string;
    trigger: TriggerType;
    input?: ExecutionInput;
    tenantId?: string;
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
        const { workflowId, userId, trigger, input = {}, tenantId } = params;

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

            // Run workflow asynchronously with proper error handling
            this.runWorkflow(
                execution.id,
                workflow,
                input,
                executionContext,
                tenantId
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

    private async runWorkflow(
        executionId: string,
        workflow: Workflow,
        input: ExecutionInput,
        executionContext: Record<string, unknown>,
        tenantId?: string
    ) {
        const startTime = Date.now();
        const contextLogger = this.logger.child(executionContext);

        // Cast Prisma JSON fields to typed arrays
        const nodes = workflow.nodes as unknown as WorkflowNode[];
        const connections = workflow.connections as unknown as WorkflowConnection[];

        try {
            // Validate workflow before execution
            this.validateWorkflow(nodes, connections);

            const nodeOutputs: Record<string, ExecutionOutput> = {};
            const executedNodes = new Set<string>();

            const triggerNodes = nodes.filter(n =>
                n.type === 'Webhook' || n.type === 'Trigger' || n.type === 'Schedule'
            );

            let nodesToExecute = triggerNodes.length > 0 ? triggerNodes : [nodes[0]];

            while (nodesToExecute.length > 0) {
                const currentNode = nodesToExecute.shift()!;

                if (executedNodes.has(currentNode.id)) continue;

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
                    const output = await this.nodeExecutor.execute(currentNode, nodeInput);
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
