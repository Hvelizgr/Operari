
import { Router } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate } from '../middleware/auth.middleware';

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

export default router;
