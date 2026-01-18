
import { Router } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate } from '../middleware/auth.middleware';
import { getTenantUsage } from '../middleware/plan-limits.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Workspaces
 *   description: Tenant and Workspace management
 */

router.get('/me', authenticate, tenantController.getMe);
router.patch('/me', authenticate, tenantController.updateMe);
router.get('/users', authenticate, tenantController.listUsers);
router.get('/audit-logs', authenticate, tenantController.getAuditLogs);

// Get current usage stats
router.get('/usage', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const usage = await getTenantUsage(tenantId);
        res.json(usage);
    } catch (error) {
        next(error);
    }
});

export default router;
