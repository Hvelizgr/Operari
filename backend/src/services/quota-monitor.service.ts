import { prisma } from '../server';
import { emailService } from './email.service';
import { getTenantUsage } from '../middleware/plan-limits.middleware';
import { logger } from '../config/logger.config';
import { redisConfig } from '../config/redis.config';

type ResourceType = 'executions' | 'workflows' | 'users';
type ThresholdType = '80' | '100';

export class QuotaMonitorService {
    private static instance: QuotaMonitorService;
    private checkInterval: NodeJS.Timeout | null = null;

    private constructor() {}

    public static getInstance(): QuotaMonitorService {
        if (!QuotaMonitorService.instance) {
            QuotaMonitorService.instance = new QuotaMonitorService();
        }
        return QuotaMonitorService.instance;
    }

    private async hasAlertBeenSent(tenantId: string, resourceType: ResourceType, threshold: ThresholdType): Promise<boolean> {
        const redis = redisConfig.getClient();
        if (!redis || !redisConfig.isReady()) {
            return false;
        }

        const key = `quota_alert:${tenantId}:${resourceType}:${threshold}`;
        const exists = await redis.get(key);
        return exists !== null;
    }

    private async markAlertSent(tenantId: string, resourceType: ResourceType, threshold: ThresholdType): Promise<void> {
        const redis = redisConfig.getClient();
        if (!redis || !redisConfig.isReady()) {
            return;
        }

        const key = `quota_alert:${tenantId}:${resourceType}:${threshold}`;
        const expiration = resourceType === 'executions' ? this.getSecondsUntilEndOfMonth() : 86400 * 30;
        await redis.set(key, '1', 'EX', expiration);
    }

    private getSecondsUntilEndOfMonth(): number {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return Math.floor((endOfMonth.getTime() - now.getTime()) / 1000);
    }

    public async checkAndNotifyTenant(tenantId: string): Promise<void> {
        try {
            const usage = await getTenantUsage(tenantId);
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    users: {
                        where: { role: 'ADMIN' },
                        select: { email: true, notificationPreferences: true }
                    }
                }
            });

            if (!tenant) return;

            const resources: ResourceType[] = ['executions', 'workflows', 'users'];

            for (const resourceType of resources) {
                const resourceUsage = usage.usage[resourceType];
                if (resourceUsage.limit === Infinity) continue;

                const adminEmails = tenant.users
                    .filter(u => {
                        const prefs = u.notificationPreferences as any;
                        return !prefs || prefs.quotaAlerts !== false;
                    })
                    .map(u => u.email);

                if (adminEmails.length === 0) continue;

                if (resourceUsage.percentage >= 100) {
                    const alreadySent = await this.hasAlertBeenSent(tenantId, resourceType, '100');
                    if (!alreadySent) {
                        for (const email of adminEmails) {
                            await emailService.sendQuotaWarningEmail(
                                email,
                                resourceType,
                                resourceUsage.current,
                                resourceUsage.limit,
                                resourceUsage.percentage,
                                tenant.name
                            );
                        }
                        await this.markAlertSent(tenantId, resourceType, '100');
                        logger.info({ tenantId, resourceType, percentage: 100 }, 'Sent 100% quota alert');
                    }
                } else if (resourceUsage.percentage >= 80) {
                    const alreadySent = await this.hasAlertBeenSent(tenantId, resourceType, '80');
                    if (!alreadySent) {
                        for (const email of adminEmails) {
                            await emailService.sendQuotaWarningEmail(
                                email,
                                resourceType,
                                resourceUsage.current,
                                resourceUsage.limit,
                                resourceUsage.percentage,
                                tenant.name
                            );
                        }
                        await this.markAlertSent(tenantId, resourceType, '80');
                        logger.info({ tenantId, resourceType, percentage: 80 }, 'Sent 80% quota alert');
                    }
                }
            }
        } catch (error) {
            logger.error({ error, tenantId }, 'Failed to check quota for tenant');
        }
    }

    public async checkAllTenants(): Promise<void> {
        try {
            const tenants = await prisma.tenant.findMany({
                where: { plan: { not: 'ENTERPRISE' } },
                select: { id: true }
            });

            logger.info({ tenantCount: tenants.length }, 'Starting quota check for all tenants');

            for (const tenant of tenants) {
                await this.checkAndNotifyTenant(tenant.id);
            }

            logger.info('Completed quota check for all tenants');
        } catch (error) {
            logger.error({ error }, 'Failed to check quotas for all tenants');
        }
    }

    public startPeriodicCheck(intervalMinutes: number = 60): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(() => {
            this.checkAllTenants();
        }, intervalMinutes * 60 * 1000);

        logger.info({ intervalMinutes }, 'Started periodic quota monitoring');
    }

    public stopPeriodicCheck(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Stopped periodic quota monitoring');
        }
    }
}

export const quotaMonitorService = QuotaMonitorService.getInstance();
