import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../types/express';
import { CustomError, ErrorCode, ErrorSeverity } from '../errors/custom-error';
import { SystemEventType } from '@prisma/client';

export class AlertController {
    
    /**
     * Get recent alerts for the authenticated tenant
     */
    async getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                throw new CustomError({
                    message: 'Tenant ID required',
                    code: ErrorCode.UNAUTHORIZED,
                    severity: ErrorSeverity.HIGH
                });
            }

            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;
            const isRead = req.query.isRead === 'true' ? true : (req.query.isRead === 'false' ? false : undefined);
            const severity = req.query.severity as string;

            const where: any = { tenantId };
            
            if (isRead !== undefined) {
                where.isRead = isRead;
            }
            
            if (severity) {
                where.severity = severity;
            }

            const [alerts, total] = await Promise.all([
                prisma.alertHistory.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset
                }),
                prisma.alertHistory.count({ where })
            ]);

            res.json({
                data: alerts,
                pagination: {
                    total,
                    limit,
                    offset
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mark alerts as read
     */
    async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            const { alertIds } = req.body; // Array of IDs or 'all'

            if (!tenantId) {
                throw new CustomError({
                    message: 'Tenant ID required',
                    code: ErrorCode.UNAUTHORIZED
                });
            }

            let count = 0;

            if (alertIds === 'all') {
                const result = await prisma.alertHistory.updateMany({
                    where: { tenantId, isRead: false },
                    data: { isRead: true }
                });
                count = result.count;
            } else if (Array.isArray(alertIds) && alertIds.length > 0) {
                const result = await prisma.alertHistory.updateMany({
                    where: { 
                        tenantId, 
                        id: { in: alertIds } 
                    },
                    data: { isRead: true }
                });
                count = result.count;
            }

            res.json({ message: 'Alerts marked as read', count });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get alert stats (count by severity)
     */
    async getStats(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) throw new CustomError({ message: 'Unauthorized', code: ErrorCode.UNAUTHORIZED });

            const stats = await prisma.alertHistory.groupBy({
                by: ['severity'],
                where: { tenantId, isRead: false },
                _count: {
                    id: true
                }
            });

            // Transform to easier format { HIGH: 5, MEDIUM: 2 }
            const result = stats.reduce((acc: any, curr) => {
                acc[curr.severity] = curr._count.id;
                return acc;
            }, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const alertController = new AlertController();
