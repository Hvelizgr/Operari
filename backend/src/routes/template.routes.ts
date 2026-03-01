import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', TemplateController.getTemplates);
router.get('/:id', TemplateController.getTemplateById);
router.post('/publish', authenticate, TemplateController.publishTemplate);
router.post('/deploy-fleet', authenticate, TemplateController.deployFleet);

export default router;
