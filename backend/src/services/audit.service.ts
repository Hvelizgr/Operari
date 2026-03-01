
import { prisma } from '../server';
import { logger } from '../config/logger.config';

export enum AuditAction {
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    WORKFLOW_CREATE = 'WORKFLOW_CREATE',
    WORKFLOW_UPDATE = 'WORKFLOW_UPDATE',
    WORKFLOW_DELETE = 'WORKFLOW_DELETE',
    CREDENTIAL_CREATE = 'CREDENTIAL_CREATE',
    CREDENTIAL_ACCESS = 'CREDENTIAL_ACCESS',
    TENANT_UPDATE = 'TENANT_UPDATE',
    USER_INVITED = 'USER_INVITED',
    APPROVAL_REQUEST = 'APPROVAL_REQUEST',
    APPROVAL_REVIEW = 'APPROVAL_REVIEW',
}

export interface AuditLogInput {
    tenantId: string;
    userId: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
}

export class AuditService {
    private static instance: AuditService;

    private constructor() {}

    public static getInstance(): AuditService {
        if (!AuditService.instance) {
            AuditService.instance = new AuditService();
        }
        return AuditService.instance;
    }

    public async log(input: AuditLogInput) {
        try {
            await prisma.auditLog.create({
                data: {
                    tenantId: input.tenantId,
                    userId: input.userId,
                    action: input.action,
                    resourceType: input.resourceType,
                    resourceId: input.resourceId,
                    details: input.details || {},
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                }
            });
        } catch (error) {
            // Don't throw if audit logging fails, just log it
            logger.error({ error, input }, 'Failed to create audit log');
        }
    }
}

export const auditService = AuditService.getInstance();
