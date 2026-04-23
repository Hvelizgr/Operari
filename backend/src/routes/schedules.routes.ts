import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma, scheduler } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { ScheduleService } from '../services/schedule.service';
import { ExecutionService } from '../editor/execution/execution.service';

const router = Router();

let _service: ScheduleService | null = null;
function getService() {
  if (!_service) {
    _service = new ScheduleService(prisma, scheduler, new ExecutionService(prisma));
  }
  return _service;
}

router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@nanorun.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

const createSchema = z.object({
  workflowId: z.string().min(1),
  cronExpr: z.string().min(1).max(120),
});

const updateSchema = z.object({
  cronExpr: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const data = await getService().list(req.user!.tenantId);
  res.json({ data });
});

router.get('/upcoming', async (req: AuthRequest, res: Response) => {
  const hours = Math.min(parseInt(String(req.query.hours ?? '24'), 10) || 24, 168);
  const data = await getService().upcoming(req.user!.tenantId, hours);
  res.json({ data });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId, cronExpr } = createSchema.parse(req.body);
    const job = await getService().create(req.user!.tenantId, workflowId, cronExpr);
    res.status(201).json(job);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid', details: err.errors });
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to create schedule',
    });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const patch = updateSchema.parse(req.body);
    const job = await getService().update(req.user!.tenantId, String(req.params.id), patch);
    if (!job) return res.status(404).json({ error: 'Schedule not found' });
    res.json(job);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid', details: err.errors });
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to update schedule',
    });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const job = await getService().delete(req.user!.tenantId, String(req.params.id));
  if (!job) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ deleted: true, id: job.id });
});

router.post('/:id/run', async (req: AuthRequest, res: Response) => {
  const result = await getService().runNow(req.user!.tenantId, String(req.params.id));
  if (!result) return res.status(404).json({ error: 'Schedule not found' });
  res.json(result);
});

export default router;
