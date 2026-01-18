import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { notificationPreferencesService } from '../services/notification-preferences.service';

const router = Router();

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 */
router.get('/preferences', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const preferences = await notificationPreferencesService.getPreferences(userId);
        res.json(preferences);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 */
router.patch('/preferences', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const preferences = await notificationPreferencesService.updatePreferences(userId, req.body);
        res.json(preferences);
    } catch (error) {
        next(error);
    }
});

export default router;
