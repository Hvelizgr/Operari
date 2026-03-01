import { Router } from 'express';
import { EnvironmentController } from '../controllers/environment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/set-environment', authenticate, EnvironmentController.setEnvironment);
router.post('/promote', authenticate, EnvironmentController.promoteWorkflow);
router.get('/:env', authenticate, EnvironmentController.getByEnvironment);

export default router;
