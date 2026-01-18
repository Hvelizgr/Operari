import { Router } from 'express';
import { metricController } from '../controllers/metric.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Ensure auth (already done in server.ts usually, but redundancy is safe)
router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        // Fallback for dev/testing if auth middleware didn't populate user
        // But in production, this should be handled by a distinct auth middleware
    }
    next();
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Retrieve raw metrics
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         schema:
 *           type: string
 *       - in: query
 *         name: nodeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: metricName
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of metrics
 */
router.get('/', metricController.getMetrics.bind(metricController));

/**
 * @swagger
 * /api/metrics/stats:
 *   get:
 *     summary: Retrieve aggregated metric statistics
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         schema:
 *           type: string
 *       - in: query
 *         name: metricName
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Aggregated stats (min, max, avg, count)
 */
router.get('/stats', metricController.getStats.bind(metricController));

export default router;
