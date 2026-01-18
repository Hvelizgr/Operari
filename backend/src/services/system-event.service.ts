import { PrismaClient, SystemEventType } from '@prisma/client';
import { prisma } from '../config/database';
import { ExecutionService } from '../editor/execution/execution.service';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { logger } from '../config/logger.config';

export interface SystemEvent {
    tenantId?: string;
    type: SystemEventType;
    source: string;           // ID of the source (workflowId, alertId, etc.)
    sourceName?: string;      // Human readable name
    payload: Record<string, any>;
    timestamp?: Date;
}

// ... lines 15-126 unchanged

    /**
     * Emit a system event - triggers all listening workflows
     */
    async emit(event: SystemEvent): Promise<{ triggered: number; executions: string[] }> {
        const { type, source, sourceName, payload, tenantId } = event;
        const timestamp = event.timestamp || new Date();

        logger.info({ eventType: type, source, tenantId }, `Emitting system event`);

        // Persist meaningful events to AlertHistory if tenantId is present
        if (tenantId && (type === 'ALERT_TRIGGERED' || type === 'WORKFLOW_FAILED')) {
            try {
                const severity = type === 'WORKFLOW_FAILED' ? 'HIGH' : (payload.severity || 'MEDIUM');
                const title = type === 'WORKFLOW_FAILED' ? `Workflow Failed: ${sourceName}` : (payload.alertTitle || `Alert: ${sourceName}`);
                const message = type === 'WORKFLOW_FAILED' ? (payload.error || 'Unknown error') : (payload.alertMessage || JSON.stringify(payload));
                
                await this.prismaClient.alertHistory.create({
                    data: {
                        tenantId,
                        type,
                        severity: severity as any, // Cast to ErrorSeverity enum
                        title,
                        message,
                        metadata: payload,
                        createdAt: timestamp
                    }
                });
            } catch (err) {
                 logger.error({ err }, 'Failed to persist alert history');
            }
        }

        try {
            // Find all active listeners for this event type
            const listeners = await this.getListenersForEvent(type);

            const executions: string[] = [];
            let triggered = 0;

            for (const listener of listeners) {
                // If event has tenantId, only trigger listeners for that tenant
                // (Optional: cross-tenant system events might exist for admins, but safety first)
                if (tenantId && listener.workflow.tenantId !== tenantId) {
                    continue;
                }

                // Check if workflow is active
                if (!listener.workflow.isActive) {
                    logger.debug({ workflowId: listener.workflowId }, `Skipping inactive workflow`);
                    continue;
                }
                
                // ... rest of logic (filtering, execution)
                // Need to ensure the loop continues correctly
                
                // Check event filter if present
                if (listener.eventFilter) {
                    if (!this.matchesFilter(payload, listener.eventFilter as Record<string, any>)) {
                        logger.debug({ workflowId: listener.workflowId }, `Event filter not matched`);
                        continue;
                    }
                }

                try {
                    // Execute the workflow with the event as input
                    const execution = await this.executionService.execute({
                        workflowId: listener.workflowId,
                        userId: listener.workflow.userId,
                        tenantId: listener.workflow.tenantId,
                        trigger: 'SYSTEM_EVENT',
                        input: {
                            $event: {
                                type,
                                source,
                                sourceName,
                                payload,
                                timestamp: timestamp.toISOString(),
                            },
                            ...payload,
                        },
                    });

                    executions.push(execution.id);
                    triggered++;

                    logger.info({
                        workflowId: listener.workflowId,
                        executionId: execution.id,
                        eventType: type
                    }, `Triggered workflow from system event`);
                } catch (error) {
                    logger.error({
                        workflowId: listener.workflowId,
                        eventType: type,
                        error
                    }, `Failed to trigger workflow from system event`);
                }
            }

            return { triggered, executions };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to emit system event',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    /**
     * Convenience methods for common events
     */
    async emitAlertTriggered(alertName: string, alertData: Record<string, any>, tenantId?: string) {
        return this.emit({
            type: 'ALERT_TRIGGERED',
            source: alertName,
            sourceName: alertName,
            tenantId,
            payload: {
                alertName,
                ...alertData,
            },
        });
    }

    async emitWorkflowCompleted(workflowId: string, workflowName: string, result: any, tenantId?: string) {
        return this.emit({
            type: 'WORKFLOW_COMPLETED',
            source: workflowId,
            sourceName: workflowName,
            tenantId,
            payload: {
                workflowId,
                workflowName,
                result,
            },
        });
    }

    async emitWorkflowFailed(workflowId: string, workflowName: string, error: string, tenantId?: string) {
        return this.emit({
            type: 'WORKFLOW_FAILED',
            source: workflowId,
            sourceName: workflowName,
            tenantId,
            payload: {
                workflowId,
                workflowName,
                error,
            },
        });
    }

    async emitCustomEvent(eventName: string, payload: Record<string, any>, tenantId?: string) {
        return this.emit({
            type: 'CUSTOM',
            source: eventName,
            sourceName: eventName,
            tenantId,
            payload: {
                eventName,
                ...payload,
            },
        });
    }

export interface EventListenerConfig {
    workflowId: string;
    eventType: SystemEventType;
    eventFilter?: Record<string, any>;
    isActive?: boolean;
}

export class SystemEventService {
    private executionService: ExecutionService;
    private prismaClient: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prismaClient = prismaClient || prisma;
        this.executionService = new ExecutionService(this.prismaClient);
    }

    /**
     * Register a workflow to listen for a specific event type
     */
    async registerListener(config: EventListenerConfig) {
        const { workflowId, eventType, eventFilter, isActive = true } = config;

        try {
            // Verify workflow exists
            const workflow = await this.prismaClient.workflow.findUnique({
                where: { id: workflowId },
            });

            if (!workflow) {
                throw new CustomError({
                    message: `Workflow ${workflowId} not found`,
                    code: ErrorCode.WORKFLOW_NOT_FOUND
                });
            }

            // Create or update listener
            const listener = await this.prismaClient.systemEventListener.upsert({
                where: {
                    workflowId_eventType: { workflowId, eventType }
                },
                create: {
                    workflowId,
                    eventType,
                    eventFilter: eventFilter || undefined,
                    isActive,
                },
                update: {
                    eventFilter: eventFilter || undefined,
                    isActive,
                    updatedAt: new Date(),
                },
            });

            logger.info({ workflowId, eventType }, `Registered system event listener`);
            return listener;
        } catch (error) {
            if (error instanceof CustomError) throw error;
            throw new CustomError({
                message: 'Failed to register event listener',
                code: ErrorCode.DATABASE_OPERATION_FAILED,
                cause: error as Error
            });
        }
    }

    /**
     * Remove a workflow's listener for an event type
     */
    async unregisterListener(workflowId: string, eventType: SystemEventType) {
        try {
            await this.prismaClient.systemEventListener.delete({
                where: {
                    workflowId_eventType: { workflowId, eventType }
                },
            });
            logger.info({ workflowId, eventType }, `Unregistered system event listener`);
        } catch (error) {
            // Ignore if not found
            logger.warn({ workflowId, eventType }, `Listener not found for removal`);
        }
    }

    /**
     * Get all listeners for a workflow
     */
    async getWorkflowListeners(workflowId: string) {
        return this.prismaClient.systemEventListener.findMany({
            where: { workflowId },
        });
    }

    /**
     * Get all active listeners for an event type
     */
    async getListenersForEvent(eventType: SystemEventType) {
        return this.prismaClient.systemEventListener.findMany({
            where: {
                eventType,
                isActive: true,
            },
            include: {
                workflow: {
                    select: {
                        id: true,
                        name: true,
                        userId: true,
                        tenantId: true,
                        isActive: true,
                    }
                }
            }
        });
    }

    /**
     * Emit a system event - triggers all listening workflows
     */
    async emit(event: SystemEvent): Promise<{ triggered: number; executions: string[] }> {
        const { type, source, sourceName, payload, tenantId } = event;
        const timestamp = event.timestamp || new Date();

        logger.info({ eventType: type, source, tenantId }, `Emitting system event`);

        // Persist meaningful events to AlertHistory if tenantId is present
        if (tenantId && (type === 'ALERT_TRIGGERED' || type === 'WORKFLOW_FAILED')) {
            try {
                const severity = type === 'WORKFLOW_FAILED' ? 'HIGH' : (payload.severity || 'MEDIUM');
                const title = type === 'WORKFLOW_FAILED' ? `Workflow Failed: ${sourceName}` : (payload.alertTitle || `Alert: ${sourceName}`);
                const message = type === 'WORKFLOW_FAILED' ? (payload.error || 'Unknown error') : (payload.alertMessage || JSON.stringify(payload));
                
                await this.prismaClient.alertHistory.create({
                    data: {
                        tenantId,
                        type,
                        severity: severity as any, // Cast to ErrorSeverity enum
                        title,
                        message,
                        metadata: payload,
                        createdAt: timestamp
                    }
                });
            } catch (err) {
                 logger.error({ err }, 'Failed to persist alert history');
            }
        }

        try {
            // Find all active listeners for this event type
            const listeners = await this.getListenersForEvent(type);

            const executions: string[] = [];
            let triggered = 0;

            for (const listener of listeners) {
                // Check if workflow is active
                if (!listener.workflow.isActive) {
                    logger.debug({ workflowId: listener.workflowId }, `Skipping inactive workflow`);
                    continue;
                }

                // Check event filter if present
                if (listener.eventFilter) {
                    if (!this.matchesFilter(payload, listener.eventFilter as Record<string, any>)) {
                        logger.debug({ workflowId: listener.workflowId }, `Event filter not matched`);
                        continue;
                    }
                }

                try {
                    // Execute the workflow with the event as input
                    const execution = await this.executionService.execute({
                        workflowId: listener.workflowId,
                        userId: listener.workflow.userId,
                        tenantId: listener.workflow.tenantId,
                        trigger: 'SYSTEM_EVENT',
                        input: {
                            $event: {
                                type,
                                source,
                                sourceName,
                                payload,
                                timestamp: timestamp.toISOString(),
                            },
                            ...payload,
                        },
                    });

                    executions.push(execution.id);
                    triggered++;

                    logger.info({
                        workflowId: listener.workflowId,
                        executionId: execution.id,
                        eventType: type
                    }, `Triggered workflow from system event`);
                } catch (error) {
                    logger.error({
                        workflowId: listener.workflowId,
                        eventType: type,
                        error
                    }, `Failed to trigger workflow from system event`);
                }
            }

            return { triggered, executions };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to emit system event',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    /**
     * Convenience methods for common events
     */
    async emitAlertTriggered(alertName: string, alertData: Record<string, any>, tenantId?: string) {
        return this.emit({
            type: 'ALERT_TRIGGERED',
            source: alertName,
            sourceName: alertName,
            tenantId,
            payload: {
                alertName,
                ...alertData,
            },
        });
    }

    async emitWorkflowCompleted(workflowId: string, workflowName: string, result: any, tenantId?: string) {
        return this.emit({
            type: 'WORKFLOW_COMPLETED',
            source: workflowId,
            sourceName: workflowName,
            tenantId,
            payload: {
                workflowId,
                workflowName,
                result,
            },
        });
    }

    async emitWorkflowFailed(workflowId: string, workflowName: string, error: string, tenantId?: string) {
        return this.emit({
            type: 'WORKFLOW_FAILED',
            source: workflowId,
            sourceName: workflowName,
            tenantId,
            payload: {
                workflowId,
                workflowName,
                error,
            },
        });
    }

    async emitCustomEvent(eventName: string, payload: Record<string, any>, tenantId?: string) {
        return this.emit({
            type: 'CUSTOM',
            source: eventName,
            sourceName: eventName,
            tenantId,
            payload: {
                eventName,
                ...payload,
            },
        });
    }

    /**
     * Check if payload matches the filter criteria
     */
    private matchesFilter(payload: Record<string, any>, filter: Record<string, any>): boolean {
        for (const [key, value] of Object.entries(filter)) {
            const payloadValue = this.getNestedValue(payload, key);

            if (typeof value === 'object' && value !== null) {
                // Handle operators like { $gt: 10, $contains: "error" }
                if (!this.matchesOperator(payloadValue, value)) {
                    return false;
                }
            } else {
                // Direct equality check
                if (payloadValue !== value) {
                    return false;
                }
            }
        }
        return true;
    }

    private getNestedValue(obj: Record<string, any>, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    private matchesOperator(value: any, operators: Record<string, any>): boolean {
        for (const [op, opValue] of Object.entries(operators)) {
            switch (op) {
                case '$eq':
                    if (value !== opValue) return false;
                    break;
                case '$ne':
                    if (value === opValue) return false;
                    break;
                case '$gt':
                    if (!(value > opValue)) return false;
                    break;
                case '$gte':
                    if (!(value >= opValue)) return false;
                    break;
                case '$lt':
                    if (!(value < opValue)) return false;
                    break;
                case '$lte':
                    if (!(value <= opValue)) return false;
                    break;
                case '$contains':
                    if (!String(value).includes(String(opValue))) return false;
                    break;
                case '$in':
                    if (!Array.isArray(opValue) || !opValue.includes(value)) return false;
                    break;
                case '$nin':
                    if (Array.isArray(opValue) && opValue.includes(value)) return false;
                    break;
            }
        }
        return true;
    }
}

export const systemEventService = new SystemEventService();