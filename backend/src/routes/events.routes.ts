import { Response, Router } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

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

/**
 * GET /api/events
 *
 * Read view over the AuditEvent chain. Powers the Events page in the
 * UI — a single feed of "what happened in this tenant", filtered by
 * type or resource. The chain integrity itself is verified via the
 * separate /api/v1/audit/verify endpoint.
 *
 * Query params:
 *   ?type=run.started     filter by exact event type
 *   ?resource=<id>        filter by resource id
 *   ?limit=N              max 200, default 100
 *   ?cursor=<seq>         pagination cursor (the seq number, descending)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const type = req.query.type ? String(req.query.type) : undefined;
  const resource = req.query.resource ? String(req.query.resource) : undefined;
  const limitRaw = parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;
  const cursorRaw = req.query.cursor ? String(req.query.cursor) : undefined;

  const where: Record<string, unknown> = { tenantId };
  if (type) where.type = type;
  if (resource) where.resource = resource;
  if (cursorRaw) where.seq = { lt: BigInt(cursorRaw) };

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { seq: 'desc' },
    take: limit + 1,
  });
  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;

  res.json({
    data: page.map(e => ({
      id: e.id,
      seq: e.seq.toString(),
      type: e.type,
      actorId: e.actorId,
      actorType: e.actorType,
      resource: e.resource,
      payload: e.payload,
      hash: e.hash,
      createdAt: e.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].seq.toString() : null,
  });
});

/**
 * GET /api/events/types
 * Return the distinct event types observed in this tenant — used to
 * populate the type filter dropdown in the UI.
 */
router.get('/types', async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const rows = await prisma.auditEvent.groupBy({
    by: ['type'],
    where: { tenantId },
    _count: { _all: true },
    orderBy: { _count: { type: 'desc' } },
    take: 50,
  });
  res.json({
    data: rows.map(r => ({ type: r.type, count: r._count._all })),
  });
});

export default router;
