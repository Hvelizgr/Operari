import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';

const router = Router();

router.get('/', TemplateController.getTemplates);
router.get('/:id', TemplateController.getTemplateById);

export default router;
