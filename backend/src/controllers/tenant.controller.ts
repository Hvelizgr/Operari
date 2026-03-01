import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { auditService, AuditAction } from '../services/audit.service';
import { safeParseInt } from '../utils/validation';

export class TenantController {
    /**
     * Get current tenant information
     */
    async getMe(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                throw new CustomError({ message: 'Tenant ID required', code: ErrorCode.UNAUTHORIZED });
            }

            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    _count: {
                        select: {
                            users: true,
                            workflows: true,
                        }
                    }
                }
            });

            if (!tenant) {
                throw new CustomError({ message: 'Tenant not found', code: ErrorCode.NOT_FOUND });
            }

            res.json(tenant);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update current tenant
     */
    async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            const role = req.user?.role;

            if (role !== 'ADMIN') {
                throw new CustomError({ message: 'Only admins can update workspace settings', code: ErrorCode.UNAUTHORIZED });
            }

            const { name, themeConfig } = req.body;
            
            const tenant = await prisma.tenant.update({
                where: { id: tenantId },
                data: { 
                    name,
                    themeConfig: themeConfig || undefined
                }
            });

            await auditService.log({
                tenantId: tenantId!,
                userId: req.user!.id,
                action: AuditAction.TENANT_UPDATE,
                resourceType: 'TENANT',
                resourceId: tenantId!,
                details: { oldName: 'unknown', newName: name },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json(tenant);
        } catch (error) {
            next(error);
        }
    }

    /**
     * List users in this tenant
     */
    async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            
            const users = await prisma.user.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true
                }
            });

            res.json(users);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get audit logs for this tenant
     */
    async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            const limit = safeParseInt(req.query.limit as string, 50);
            const offset = safeParseInt(req.query.offset as string, 0);

            const logs = await prisma.auditLog.findMany({
                where: { tenantId },
                include: {
                    user: {
                        select: { name: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            });

            res.json(logs);
        } catch (error) {
            next(error);
        }
    }
}

export const tenantController = new TenantController();
