
import { Router } from 'express';
import { credentialController } from '../controllers/credential.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Middleware to ensure anonymous user if not authenticated (Same as workflow routes)
router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        // This assumes 'anonymous' user exists in DB. If not, foreign key constraints will fail on create.
        // It serves as a placeholder for development without strict auth.
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
            role: 'USER',
            tenantId: 'default-tenant',
        };
    }
    next();
});

router.post('/', credentialController.create.bind(credentialController));
router.get('/', credentialController.getAll.bind(credentialController));
router.delete('/:id', credentialController.delete.bind(credentialController));

export default router;
