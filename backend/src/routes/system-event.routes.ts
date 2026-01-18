import { Router } from 'express';
import { systemEventController } from '../controllers/system-event.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
            role: 'USER',
            tenantId: 'default-tenant',
        };
    }
    next();
});

/**
 * @swagger
 * /api/events/types:
 *   get:
 *     summary: Get available system event types
 *     tags: [System Events]
 *     responses:
 *       200:
 *         description: List of event types
 */
router.get('/types', systemEventController.getEventTypes.bind(systemEventController));

/**
 * @swagger
 * /api/events/listeners:
 *   post:
 *     summary: Register a workflow to listen for system events
 *     tags: [System Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *               - eventType
 *             properties:
 *               workflowId:
 *                 type: string
 *               eventType:
 *                 type: string
 *                 enum: [ALERT_TRIGGERED, WORKFLOW_COMPLETED, WORKFLOW_FAILED, WORKFLOW_STARTED, CREDENTIAL_EXPIRING, CUSTOM]
 *               eventFilter:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Listener registered
 */
router.post('/listeners', systemEventController.registerListener.bind(systemEventController));

/**
 * @swagger
 * /api/events/listeners/{workflowId}:
 *   get:
 *     summary: Get all event listeners for a workflow
 *     tags: [System Events]
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of listeners
 */
router.get('/listeners/:workflowId', systemEventController.getWorkflowListeners.bind(systemEventController));

/**
 * @swagger
 * /api/events/listeners/{workflowId}/{eventType}:
 *   delete:
 *     summary: Unregister an event listener
 *     tags: [System Events]
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: eventType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Listener removed
 */
router.delete('/listeners/:workflowId/:eventType', systemEventController.unregisterListener.bind(systemEventController));

/**
 * @swagger
 * /api/events/emit:
 *   post:
 *     summary: Emit a system event (triggers listening workflows)
 *     tags: [System Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - source
 *             properties:
 *               type:
 *                 type: string
 *               source:
 *                 type: string
 *               sourceName:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event emitted
 */
router.post('/emit', systemEventController.emitEvent.bind(systemEventController));

/**
 * @swagger
 * /api/events/emit/custom/{eventName}:
 *   post:
 *     summary: Emit a custom event by name
 *     tags: [System Events]
 *     parameters:
 *       - in: path
 *         name: eventName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Custom event emitted
 */
router.post('/emit/custom/:eventName', systemEventController.emitCustomEvent.bind(systemEventController));

export default router;
