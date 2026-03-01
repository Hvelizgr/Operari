
import { Router } from 'express';
import { n8nController } from '../controllers/n8n.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public health check (for dashboard widgets)
router.get('/health', n8nController.checkHealth);

// Protected routes
router.get('/workflows', authenticate, n8nController.getWorkflows);
router.get('/impersonate/:id', authenticate, n8nController.getImpersonationUrl.bind(n8nController));
router.get('/workflows/:id', authenticate, n8nController.getWorkflow);
router.post('/workflows/export', authenticate, n8nController.exportWorkflow);
router.get('/analyze/:id', authenticate, n8nController.analyzeWorkflow);
router.get('/credentials', authenticate, n8nController.getCredentials);
router.post('/credentials', authenticate, n8nController.createCredential);

export default router;
