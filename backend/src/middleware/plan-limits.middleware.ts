
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Plan limits configuration
 */
const PLAN_LIMITS = {
    FREE: {
        maxWorkflows: 5,
        maxExecutionsPerMonth: 1000,
        maxNodesPerWorkflow: 10,
        maxUsers: 1,
        features: {
            customDomains: false,
            sso: false,
            auditLogs: false,
            prioritySupport: false
        }
    },
    PRO: {
        maxWorkflows: 50,
        maxExecutionsPerMonth: 50000,
        maxNodesPerWorkflow: 100,
        maxUsers: 10,
        features: {
            customDomains: true,
            sso: false,
            auditLogs: true,
            prioritySupport: true
        }
    },
    ENTERPRISE: {
        maxWorkflows: Infinity,
        maxExecutionsPerMonth: Infinity,
        maxNodesPerWorkflow: Infinity,
        maxUsers: Infinity,
        features: {
            customDomains: true,
            sso: true,
            auditLogs: true,
            prioritySupport: true
        }
    }
};

/**
 * Middleware to check tenant plan limits
 */
export const checkPlanLimits = (resource: 'workflows' | 'executions' | 'users') => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    _count: {
                        select: {
                            workflows: true,
                            users: true
                        }
                    }
                }
            });

            if (!tenant) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            const limits = PLAN_LIMITS[tenant.plan];

            // Check specific resource limits
            switch (resource) {
                case 'workflows':
                    if (tenant._count.workflows >= limits.maxWorkflows) {
                        return res.status(403).json({
                            error: 'Plan limit exceeded',
                            message: `Your ${tenant.plan} plan allows a maximum of ${limits.maxWorkflows} workflows. Please upgrade to create more.`,
                            limit: limits.maxWorkflows,
                            current: tenant._count.workflows,
                            upgradeUrl: `${process.env.FRONTEND_URL}/settings/billing`
                        });
                    }
                    break;

                case 'users':
                    if (tenant._count.users >= limits.maxUsers) {
                        return res.status(403).json({
                            error: 'Plan limit exceeded',
                            message: `Your ${tenant.plan} plan allows a maximum of ${limits.maxUsers} users. Please upgrade to add more.`,
                            limit: limits.maxUsers,
                            current: tenant._count.users,
                            upgradeUrl: `${process.env.FRONTEND_URL}/settings/billing`
                        });
                    }
                    break;

                case 'executions':
                    // Check monthly execution count
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);

                    const executionCount = await prisma.execution.count({
                        where: {
                            workflow: { tenantId },
                            startedAt: { gte: startOfMonth }
                        }
                    });

                    if (executionCount >= limits.maxExecutionsPerMonth) {
                        return res.status(403).json({
                            error: 'Plan limit exceeded',
                            message: `Your ${tenant.plan} plan allows ${limits.maxExecutionsPerMonth} executions per month. Please upgrade for more capacity.`,
                            limit: limits.maxExecutionsPerMonth,
                            current: executionCount,
                            upgradeUrl: `${process.env.FRONTEND_URL}/settings/billing`
                        });
                    }
                    break;
            }

            // Attach plan info to request for downstream use
            (req as any).planLimits = limits;
            (req as any).tenantPlan = tenant.plan;

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Middleware to check feature availability
 */
export const requireFeature = (feature: keyof typeof PLAN_LIMITS.FREE.features) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId }
            });

            if (!tenant) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            const limits = PLAN_LIMITS[tenant.plan];

            if (!limits.features[feature]) {
                return res.status(403).json({
                    error: 'Feature not available',
                    message: `The ${feature} feature is not available on your ${tenant.plan} plan. Please upgrade to access this feature.`,
                    requiredPlan: 'PRO',
                    currentPlan: tenant.plan,
                    upgradeUrl: `${process.env.FRONTEND_URL}/settings/billing`
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Get current usage stats for a tenant
 */
export const getTenantUsage = async (tenantId: string) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            _count: {
                select: {
                    workflows: true,
                    users: true
                }
            }
        }
    });

    if (!tenant) {
        throw new Error('Tenant not found');
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const executionCount = await prisma.execution.count({
        where: {
            workflow: { tenantId },
            startedAt: { gte: startOfMonth }
        }
    });

    const limits = PLAN_LIMITS[tenant.plan];

    return {
        plan: tenant.plan,
        limits,
        usage: {
            workflows: {
                current: tenant._count.workflows,
                limit: limits.maxWorkflows,
                percentage: limits.maxWorkflows === Infinity ? 0 : (tenant._count.workflows / limits.maxWorkflows) * 100
            },
            users: {
                current: tenant._count.users,
                limit: limits.maxUsers,
                percentage: limits.maxUsers === Infinity ? 0 : (tenant._count.users / limits.maxUsers) * 100
            },
            executions: {
                current: executionCount,
                limit: limits.maxExecutionsPerMonth,
                percentage: limits.maxExecutionsPerMonth === Infinity ? 0 : (executionCount / limits.maxExecutionsPerMonth) * 100
            }
        }
    };
};
