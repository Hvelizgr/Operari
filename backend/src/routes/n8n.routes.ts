
import { Router } from 'express';
import { n8nController } from '../controllers/n8n.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public health check (for dashboard widgets)
router.get('/health', n8nController.checkHealth);

// Protected routes
router.get('/workflows', authenticate, n8nController.getWorkflows);
router.get('/analyze/:id', authenticate, n8nController.analyzeWorkflow);

export default router;
