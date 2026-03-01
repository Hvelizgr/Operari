import { Router } from 'express';
import { importController } from '../controllers/import.controller';

const router = Router();

router.post('/zapier', importController.importZapier);
router.post('/make', importController.importMake);
router.post('/url', importController.importFromUrl);

export default router;
