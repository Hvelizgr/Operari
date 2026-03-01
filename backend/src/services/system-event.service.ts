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

export class SystemEventService {
    private prismaClient: PrismaClient;
    private executionService: ExecutionService;

    constructor() {
        this.prismaClient = prisma;
        this.executionService = new ExecutionService(this.prismaClient);
    }

    async registerListener(data: { workflowId: string, eventType: SystemEventType, eventFilter?: any, isActive?: boolean }) {
        return this.prismaClient.systemEventListener.upsert({
            where: {
                workflowId_eventType: {
                    workflowId: data.workflowId,
                    eventType: data.eventType
                }
            },
            update: {
                eventFilter: data.eventFilter ?? undefined,
                isActive: data.isActive ?? true
            },
            create: {
                workflowId: data.workflowId,
                eventType: data.eventType,
                eventFilter: data.eventFilter ?? undefined,
                isActive: data.isActive ?? true
            }
        });
    }

    async unregisterListener(workflowId: string, eventType: SystemEventType) {
        try {
            await this.prismaClient.systemEventListener.delete({
                where: {
                    workflowId_eventType: {
                        workflowId,
                        eventType
                    }
                }
            });
        } catch (error) {
            // Ignore if not found
        }
    }

    async getWorkflowListeners(workflowId: string) {
        return this.prismaClient.systemEventListener.findMany({
            where: { workflowId }
        });
    }

    /**
     * Find all workflows that are listening for this event type
     */
    private async getListenersForEvent(eventType: SystemEventType): Promise<any[]> {
        return this.prismaClient.systemEventListener.findMany({
            where: {
                eventType,
                isActive: true
            },
            include: {
                workflow: true
            }
        });
    }

    /**
     * Check if event payload matches the listener's filter
     */
    private matchesFilter(payload: any, filter: Record<string, any>): boolean {
        if (!filter) return true;
        for (const key of Object.keys(filter)) {
            // Simple equality check
            if (payload[key] !== filter[key]) return false;
        }
        return true;
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
                        severity: severity as any, // Cast to ErrorSeverity enum if needed
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
                if (tenantId && listener.workflow.tenantId !== tenantId) {
                    continue;
                }

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
        // Warning: 'CUSTOM' might not be in SystemEventType enum. Assuming it is valid or cast.
        // If 'CUSTOM' is not in enum, this needs execution change.
        return this.emit({
            type: 'CUSTOM' as any, 
            source: eventName,
            sourceName: eventName,
            tenantId,
            payload: {
                eventName,
                ...payload,
            },
        });
    }
}

export const systemEventService = new SystemEventService();
