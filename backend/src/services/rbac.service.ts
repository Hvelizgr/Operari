import { prisma } from '../server';
import { AccessLevel, Role } from '@prisma/client';

export class RBACService {
    private static instance: RBACService;

    private constructor() {}

    public static getInstance(): RBACService {
        if (!RBACService.instance) {
            RBACService.instance = new RBACService();
        }
        return RBACService.instance;
    }

    /**
     * Check if a user has a specific access level to a workflow
     */
    public async canAccessWorkflow(
        userId: string,
        workflowId: string,
        requiredLevel: AccessLevel | 'OWNER'
    ): Promise<boolean> {
        // Fetch user and workflow
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, tenantId: true }
        });

        if (!user) return false;

        // Admins can do anything within their tenant
        if (user.role === Role.ADMIN) return true;

        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
            select: { userId: true, tenantId: true }
        });

        if (!workflow) return false;

        // Check tenant isolation
        if (workflow.tenantId !== user.tenantId) return false;

        // Owner check
        if (workflow.userId === userId) return true;
        if (requiredLevel === 'OWNER') return workflow.userId === userId;

        // Check explicit permissions
        const permission = await prisma.workflowPermission.findUnique({
            where: {
                workflowId_userId: {
                    workflowId,
                    userId
                }
            }
        });

        if (!permission) return false;

        // Permission level hierarchy
        const levels: Record<AccessLevel, number> = {
            'READ': 1,
            'WRITE': 2,
            'ADMIN': 3
        };

        // At this point, requiredLevel cannot be 'OWNER' (handled above)
        // Cast to AccessLevel since we've already handled the OWNER case
        const required = levels[requiredLevel as AccessLevel];
        const actual = levels[permission.level];

        return actual >= required;
    }

    /**
     * Get all users with access to a workflow
     */
    public async getWorkflowPermissions(workflowId: string) {
        return prisma.workflowPermission.findMany({
            where: { workflowId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
    }

    /**
     * Set access level for a user on a workflow
     */
    public async setWorkflowPermission(
        workflowId: string,
        userId: string,
        level: AccessLevel
    ) {
        return prisma.workflowPermission.upsert({
            where: {
                workflowId_userId: {
                    workflowId,
                    userId
                }
            },
            update: { level },
            create: {
                workflowId,
                userId,
                level
            }
        });
    }

    /**
     * Remove access for a user on a workflow
     */
    public async removeWorkflowPermission(workflowId: string, userId: string) {
        return prisma.workflowPermission.delete({
            where: {
                workflowId_userId: {
                    workflowId,
                    userId
                }
            }
        });
    }
}
