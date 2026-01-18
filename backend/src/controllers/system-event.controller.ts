import { Response, NextFunction } from 'express';
import { systemEventService } from '../services/system-event.service';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { AuthRequest } from '../middleware/auth.middleware';
import { SystemEventType } from '@prisma/client';

const VALID_EVENT_TYPES: SystemEventType[] = [
    'ALERT_TRIGGERED',
    'WORKFLOW_COMPLETED',
    'WORKFLOW_FAILED',
    'WORKFLOW_STARTED',
    'CREDENTIAL_EXPIRING',
    'CUSTOM'
];

export class SystemEventController {
    async registerListener(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { workflowId, eventType, eventFilter, isActive } = req.body;

            if (!workflowId || !eventType) {
                throw new CustomError({
                    message: 'workflowId and eventType are required',
                    code: ErrorCode.VALIDATION_ERROR
                });
            }

            if (!VALID_EVENT_TYPES.includes(eventType as SystemEventType)) {
                throw new CustomError({
                    message: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
                    code: ErrorCode.VALIDATION_ERROR
                });
            }

            const listener = await systemEventService.registerListener({
                workflowId,
                eventType,
                eventFilter,
                isActive
            });

            res.status(201).json(listener);
        } catch (error) {
            next(error);
        }
    }

    async unregisterListener(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const workflowId = req.params.workflowId as string;
            const eventType = req.params.eventType as string;

            if (!VALID_EVENT_TYPES.includes(eventType as SystemEventType)) {
                throw new CustomError({
                    message: 'Invalid eventType',
                    code: ErrorCode.VALIDATION_ERROR
                });
            }

            await systemEventService.unregisterListener(workflowId, eventType as SystemEventType);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    async getWorkflowListeners(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const workflowId = req.params.workflowId as string;
            const listeners = await systemEventService.getWorkflowListeners(workflowId);
            res.json(listeners);
        } catch (error) {
            next(error);
        }
    }

    async emitEvent(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { type, source, sourceName, payload } = req.body;

            if (!type || !source) {
                throw new CustomError({
                    message: 'type and source are required',
                    code: ErrorCode.VALIDATION_ERROR
                });
            }

            if (!VALID_EVENT_TYPES.includes(type as SystemEventType)) {
                throw new CustomError({
                    message: `Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
                    code: ErrorCode.VALIDATION_ERROR
                });
            }

            const result = await systemEventService.emit({
                type,
                source,
                sourceName,
                payload: payload || {},
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async emitCustomEvent(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const eventName = req.params.eventName as string;
            const payload = req.body;

            if (!eventName) {
                throw new CustomError({
                    message: 'eventName is required',
                    code: ErrorCode.VALIDATION_ERROR
                });
            }

            const result = await systemEventService.emitCustomEvent(eventName, payload || {});
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async getEventTypes(_req: AuthRequest, res: Response, next: NextFunction) {
        try {
            res.json({
                eventTypes: VALID_EVENT_TYPES,
                descriptions: {
                    ALERT_TRIGGERED: 'Triggered when an alert condition fires',
                    WORKFLOW_COMPLETED: 'Triggered when another workflow completes successfully',
                    WORKFLOW_FAILED: 'Triggered when another workflow fails',
                    WORKFLOW_STARTED: 'Triggered when another workflow starts',
                    CREDENTIAL_EXPIRING: 'Triggered when a credential is about to expire',
                    CUSTOM: 'Custom user-defined events',
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

export const systemEventController = new SystemEventController();
