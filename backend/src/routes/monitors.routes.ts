import { Response, Router } from 'express';
import { z } from 'zod';

import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';
import { MonitorService } from '../services/monitor.service';

const router = Router();

let _service: MonitorService | null = null;
function getService() {
  if (!_service) _service = new MonitorService(prisma);
  return _service;
}

router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

const checkConfigSchema = z.object({
  windowMinutes: z.number().int().min(1).max(10080),
  threshold: z.number().min(0).max(1).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  runbookId: z.string().min(1),
  checkType: z.enum(['last_success_within', 'no_run_within', 'failure_rate_above']),
  checkConfig: checkConfigSchema,
  isEnabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

router.get('/', async (req: AuthRequest, res: Response) => {
  const data = await getService().list(req.user!.tenantId);
  res.json({ data });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const monitor = await getService().get(req.user!.tenantId, String(req.params.id));
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
  res.json(monitor);
});

router.get('/:id/events', async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const events = await getService().listEvents(req.user!.tenantId, String(req.params.id), limit);
  res.json({ data: events });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = createSchema.parse(req.body);
    const monitor = await getService().create(req.user!.tenantId, body);
    res.status(201).json(monitor);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid', details: err.errors });
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to create monitor',
    });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const body = updateSchema.parse(req.body);
    const monitor = await getService().update(req.user!.tenantId, String(req.params.id), body);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    res.json(monitor);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid', details: err.errors });
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to update monitor',
    });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const monitor = await getService().delete(req.user!.tenantId, String(req.params.id));
  if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
  res.json({ deleted: true, id: monitor.id });
});

export default router;
