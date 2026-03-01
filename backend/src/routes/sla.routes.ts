import { Router } from 'express';
import { SLAService } from '../services/sla.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../services/logger.service';

const router = Router();
const slaService = new SLAService();

router.use(authenticate);

/**
 * Get SLA for a workflow
 */
router.get('/workflow/:workflowId', async (req: AuthRequest, res) => {
  try {
    const workflowId = req.params.workflowId as string;
    const sla = await slaService.getSLAByWorkflow(workflowId);
    res.json(sla);
  } catch (error) {
    logger.error('Error getting SLA:', { error: error as Error });
    res.status(500).json({ error: 'Failed to get SLA' });
  }
});

/**
 * Create or update SLA
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { workflowId, name, description, maxDuration, minSuccessRate, alertOnBreach } = req.body;
    const sla = await slaService.upsertSLA({
      tenantId: req.user!.tenantId,
      workflowId,
      name,
      description,
      maxDuration,
      minSuccessRate,
      alertOnBreach,
    });
    res.json(sla);
  } catch (error) {
    logger.error('Error upserting SLA:', { error: error as Error });
    res.status(500).json({ error: 'Failed to save SLA' });
  }
});

/**
 * Get compliance report
 */
router.get('/report', async (req: AuthRequest, res) => {
  try {
    const { days } = req.query;
    const report = await slaService.getTenantComplianceReport(
      req.user!.tenantId,
      days ? parseInt(days as string) : 30
    );
    res.json(report);
  } catch (error) {
    logger.error('Error getting compliance report:', { error: error as Error });
    res.status(500).json({ error: 'Failed to get compliance report' });
  }
});

export default router;
