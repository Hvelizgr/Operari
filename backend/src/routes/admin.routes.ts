import { Response, Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../audit/audit.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { KeyRotationError, KeyRotationService } from '../security/key-rotation.service';
import { secretCipherFromEnv } from '../security/secret-cipher';
import { prisma } from '../server';

const router = Router();

// req.user is populated by the global `attachUserIfPresent` middleware
// in server.ts. This fallback handles the edge case where auth is
// missing entirely (should not happen in normal flow, but keeps the
// route from crashing on req.user!.tenantId).
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
 * GET /api/admin/overview
 *
 * Read-only snapshot for the Admin page: tenant info + plan, user list,
 * custom roles, and counts of the major resources. Mutations
 * (invite user, change plan, edit role) are intentionally NOT here in
 * v0.1 — the page is a "what do I have" view, not a control surface.
 * The control surface lives in the existing /api/auth, /api/v1/keys, etc.
 */
router.get('/overview', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const tenantId = req.user!.tenantId;

  const [tenant, users, customRoles, counts] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        workosOrganizationId: true,
        stripeCustomerId: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.customRole.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        permissions: true,
        createdAt: true,
      },
    }),
    Promise.all([
      prisma.runbook.count({ where: { tenantId } }),
      prisma.execution.count({ where: { tenantId } }),
      prisma.apiKey.count({ where: { tenantId } }),
      prisma.webhook.count({ where: { tenantId } }),
      prisma.scheduledJob.count({ where: { runbook: { tenantId } } }),
      prisma.eventAgent.count({ where: { tenantId } }),
      prisma.monitor.count({ where: { tenantId } }),
      prisma.auditEvent.count({ where: { tenantId } }),
    ]),
  ]);

  res.json({
    tenant,
    users,
    customRoles,
    counts: {
      runbooks: counts[0],
      runs: counts[1],
      apiKeys: counts[2],
      webhooks: counts[3],
      schedules: counts[4],
      agents: counts[5],
      monitors: counts[6],
      auditEvents: counts[7],
    },
  });
});

// ─── Key rotation (S3.4) ─────────────────────────────────────────

let keyRotationServiceSingleton: KeyRotationService | null = null;
function getKeyRotationService(): KeyRotationService {
  if (!keyRotationServiceSingleton) {
    keyRotationServiceSingleton = new KeyRotationService({
      prisma,
      cipher: secretCipherFromEnv(),
      audit: new AuditService(prisma),
    });
  }
  return keyRotationServiceSingleton;
}

/** Admin-only gate. Plain ADMIN role check; richer RBAC for this
 *  surface can come later — rotation is rare and high-stakes, so
 *  one-role-fits-all is fine for v0.1. */
function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin role required' });
    return false;
  }
  return true;
}

const startRotationSchema = z.object({
  /** ISO-8601 datetime when the rotation should be complete. Used
   *  for alerting if progress < 90% at deadline − 24h. */
  deadline: z.string().datetime(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/admin/key-rotation/start
 * Body: { deadline: ISO-8601, dryRun?: boolean }
 *
 * Creates a KeyRotationJob row and returns it. The background worker
 * (server.ts interval) picks it up on the next tick. Rejects when
 * another rotation is active or when OPERARI_SECRET_KEY_LEGACY is
 * unset (unless dryRun).
 */
router.post('/key-rotation/start', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = startRotationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }
  try {
    const job = await getKeyRotationService().startRotation({
      deadline: new Date(parsed.data.deadline),
      actorId: req.user!.id,
      dryRun: parsed.data.dryRun,
    });
    return res.status(201).json({ data: job });
  } catch (err) {
    if (err instanceof KeyRotationError) {
      const status = err.code === 'ACTIVE_JOB_EXISTS' ? 409 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    req.log?.error({ err }, 'key-rotation start failed');
    return res.status(500).json({ error: 'Failed to start key rotation' });
  }
});

/**
 * GET /api/admin/key-rotation/status
 * Returns the currently active job (PENDING/RUNNING) or the most
 * recent terminal one. Dashboard polls this to render progress.
 */
router.get('/key-rotation/status', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const active = await getKeyRotationService().getActiveJob();
  if (active) return res.json({ data: active, active: true });
  const lastTerminal = await prisma.keyRotationJob.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ data: lastTerminal, active: false });
});

/**
 * POST /api/admin/key-rotation/:jobId/cancel
 * Flips an active rotation to CANCELLED. Already-rotated rows stay
 * rotated; the operator can resume later by starting a fresh job.
 */
router.post('/key-rotation/:jobId/cancel', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const job = await getKeyRotationService().cancel(req.params.jobId as string);
    return res.json({ data: job });
  } catch (err) {
    if (err instanceof KeyRotationError) {
      const status = err.code === 'JOB_NOT_FOUND' ? 404 : 409;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    req.log?.error({ err }, 'key-rotation cancel failed');
    return res.status(500).json({ error: 'Failed to cancel key rotation' });
  }
});

export default router;
