import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, anonymousFallback } from '../middleware/auth.middleware';
import { WaitpointError, WaitpointService } from '../runbook/services/waitpoint.service';
import { prisma } from '../server';

/**
 * Waitpoint token routes (trigger.dev parity).
 *
 * Tenant-scoped:
 *   POST   /api/waitpoints                 — create a token
 *   GET    /api/waitpoints                 — list (operator dashboard)
 *   GET    /api/waitpoints/:id             — fetch a single token
 *   POST   /api/waitpoints/:id/complete    — fulfill a token
 *   DELETE /api/waitpoints/:id             — cancel a token
 *
 * The complete route is the public surface external systems hit
 * (Slack callback, vendor webhook, etc.). The id alone is the
 * authentication signal — it carries 128 bits of entropy and the
 * operator decides who learns the URL. We deliberately do NOT
 * require an API key on POST /complete so a vendor that cannot
 * carry headers (form-action style callback) can still complete
 * tokens.
 */

const router = Router();
let _service: WaitpointService | null = null;
function getService() {
  if (!_service) _service = new WaitpointService(prisma);
  return _service;
}

const createSchema = z.object({
  executionId: z.string().min(1).max(100).nullish(),
  timeoutSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 3600)
    .nullish(),
  tags: z.array(z.string().min(1).max(64)).max(16).optional(),
});

const completeSchema = z.object({
  // Free-form payload — restricted only by JSON serialisability.
  // Capped at ~64KB at the express.json() level for safety.
  value: z.unknown(),
  completedBy: z.string().min(1).max(120).nullish(),
});

router.post('/', anonymousFallback, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors });
  }
  const tokenRow = await getService().create({
    tenantId: req.user.tenantId,
    executionId: parsed.data.executionId ?? null,
    timeoutMs: parsed.data.timeoutSeconds ? parsed.data.timeoutSeconds * 1000 : null,
    tags: parsed.data.tags ?? [],
  });
  // Public URL — same id, addressed by /complete. Frontend / vendor
  // hands this around; the route below honours it.
  const base = process.env.APP_URL || 'http://localhost:3000';
  res.status(201).json({
    data: {
      ...tokenRow,
      url: `${base.replace(/\/$/, '')}/api/waitpoints/${tokenRow.id}/complete`,
    },
  });
});

router.get('/', anonymousFallback, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const status = (req.query.status as string | undefined)?.toUpperCase();
  const allowed = ['PENDING', 'COMPLETED', 'TIMED_OUT', 'CANCELLED'] as const;
  const statusFilter = (allowed as readonly string[]).includes(status ?? '')
    ? (status as (typeof allowed)[number])
    : undefined;
  const data = await getService().list(req.user.tenantId, { status: statusFilter });
  res.json({ data });
});

router.get('/:id', anonymousFallback, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const row = await getService().retrieve(String(req.params.id), req.user.tenantId);
    res.json({ data: row });
  } catch (err) {
    if (err instanceof WaitpointError) {
      return res.status(404).json({ error: err.message, code: err.code.toLowerCase() });
    }
    throw err;
  }
});

/**
 * POST /api/waitpoints/:id/complete  body: { value, completedBy? }
 *
 * Public surface — the token id alone gates access. Tenant scope
 * is re-derived from the row. Already-completed / cancelled /
 * timed-out tokens return 409 with the prior status so a retrying
 * caller knows the state without polling.
 */
router.post('/:id/complete', async (req, res) => {
  const id = String(req.params.id);
  // We intentionally do NOT require auth here — the id is the
  // capability. We DO need to look up the row first to learn the
  // tenant; then we delegate.
  const row = await prisma.waitpoint.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: 'Waitpoint not found' });

  const parsed = completeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors });
  }

  try {
    const updated = await getService().complete(id, {
      tenantId: row.tenantId,
      value: parsed.data.value,
      completedBy: parsed.data.completedBy ?? null,
    });
    return res.json({ data: updated });
  } catch (err) {
    if (err instanceof WaitpointError) {
      const status = err.code === 'ALREADY_COMPLETED' ? 409 : 404;
      return res.status(status).json({ error: err.message, code: err.code.toLowerCase() });
    }
    throw err;
  }
});

router.delete('/:id', anonymousFallback, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const row = await getService().cancel(String(req.params.id), req.user.tenantId);
    res.json({ data: row });
  } catch (err) {
    if (err instanceof WaitpointError) {
      return res.status(404).json({ error: err.message, code: err.code.toLowerCase() });
    }
    throw err;
  }
});

export default router;
