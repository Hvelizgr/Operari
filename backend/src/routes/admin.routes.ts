
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/instances', authenticate, adminController.getInstances);
router.post('/instances', authenticate, adminController.createInstance);
router.post('/instances/:id/refresh', authenticate, adminController.refreshInstance);
router.delete('/instances/:id', authenticate, adminController.deleteInstance);

// Process Mining
router.get('/process-mining/global', authenticate, adminController.getGlobalBottlenecks);
router.get('/process-mining/:workflowId', authenticate, adminController.getProcessMining);

export default router;
