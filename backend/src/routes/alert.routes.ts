import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get recent alerts
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of alerts
 */
router.get('/', alertController.getAlerts.bind(alertController));

/**
 * @swagger
 * /api/alerts/stats:
 *   get:
 *     summary: Get alert statistics (unread counts by severity)
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: Alert stats
 */
router.get('/stats', alertController.getStats.bind(alertController));

/**
 * @swagger
 * /api/alerts/mark-read:
 *   post:
 *     summary: Mark alerts as read
 *     tags: [Alerts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alertIds:
 *                 oneOf:
 *                   - type: string
 *                     enum: ['all']
 *                   - type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Success message
 */
router.post('/mark-read', alertController.markAsRead.bind(alertController));

export default router;
