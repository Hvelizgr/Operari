
import { Router } from 'express';
import { globalVariableController } from '../controllers/global-variable.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, globalVariableController.getVariables);
router.post('/', authenticate, globalVariableController.createVariable);
router.patch('/:id', authenticate, globalVariableController.updateVariable);
router.delete('/:id', authenticate, globalVariableController.deleteVariable);
router.post('/sync', authenticate, globalVariableController.syncVariables);
router.post('/propagate', authenticate, globalVariableController.propagateVariables);

export default router;
