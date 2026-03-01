
import { Router } from 'express';
import { FleetService } from '../services/fleet.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();
const fleetService = FleetService.getInstance();

// Trigger a workflow in another instance
router.post('/trigger/:instanceId/:workflowId', authenticate, async (req, res) => {
    try {
        const instanceId = req.params.instanceId as string;
        const workflowId = req.params.workflowId as string;
        const result = await fleetService.triggerRemoteWorkflow(instanceId, workflowId, req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Relay a trigger from one instance to another
router.post('/relay', authenticate, async (req, res) => {
    try {
        const { sourceInstanceId, targetInstanceId, targetWorkflowId, data } = req.body;
        const result = await fleetService.relayTrigger(sourceInstanceId, targetInstanceId, targetWorkflowId, data);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-heal an instance
router.post('/auto-heal/:instanceId', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const instanceId = req.params.instanceId as string;
        const result = await fleetService.autoHeal(instanceId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update entire fleet
router.post('/update-fleet', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { tenantId, version } = req.body;
        const count = await fleetService.updateFleet(tenantId || (req as any).user.tenantId, version);
        res.json({ message: `Update started for ${count} instances`, count });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get all instances
router.get('/instances', authenticate, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const instances = await fleetService.getInstances(tenantId);
        res.json(instances);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get global aggregated executions
router.get('/executions', authenticate, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await fleetService.getGlobalExecutions(tenantId, limit);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// AI Debug a specific remote execution
router.post('/debug/:instanceId/:executionId', authenticate, async (req, res) => {
    try {
        const instanceId = req.params.instanceId as string;
        const executionId = req.params.executionId as string;
        const result = await fleetService.debugExecution(instanceId, executionId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
