import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { RBACService } from '../services/rbac.service';
import { AccessLevel } from '@prisma/client';

const rbacService = RBACService.getInstance();

export const checkWorkflowAccess = (requiredLevel: AccessLevel | 'OWNER') => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const workflowId = req.params.id || req.body.workflowId;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!workflowId) {
                return res.status(400).json({ error: 'Workflow ID is required' });
            }

            // Skip check for 'current-workflow' scratchpad (accessible to all in tenant)
            if (workflowId === 'current-workflow') {
                return next();
            }

            const hasAccess = await rbacService.canAccessWorkflow(userId, workflowId, requiredLevel);

            if (!hasAccess) {
                return res.status(403).json({ 
                    error: 'Forbidden', 
                    message: `You do not have ${requiredLevel} access to this workflow` 
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
