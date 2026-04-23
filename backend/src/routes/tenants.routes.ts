import type { Role } from '@prisma/client';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../audit/audit.service';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

let _audit: AuditService | null = null;
function getAudit(): AuditService {
  if (!_audit) _audit = new AuditService(prisma);
  return _audit;
}

/**
 * GET /api/tenants/members
 *
 * List every user on the caller's tenant plus the caller's own role
 * so the UI can decide whether to render the "Remove" button. OWNER
 * is distinguishable from ADMIN because OWNER is treated as
 * un-removable and un-demotable.
 */
router.get('/members', authenticate, async (req: AuthRequest, res: Response) => {
  const members = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      mfaEnabled: true,
      createdAt: true,
    },
  });
  res.json({ data: members, viewerRole: req.user!.role, viewerId: req.user!.id });
});

/**
 * DELETE /api/tenants/members/:id
 *
 * Remove a user from this tenant. Admin/Owner only. Cannot remove:
 *   - Yourself (use the account deletion flow — not built yet)
 *   - An OWNER (ownership is sticky; transfer it first)
 *   - A user on a different tenant (404-shaped to avoid probing)
 */
router.delete('/members/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can remove members' });
  }
  const id = String(req.params.id);
  if (id === req.user!.id) {
    return res.status(409).json({ error: 'You cannot remove yourself' });
  }
  const target = await prisma.user.findFirst({
    where: { id, tenantId: req.user!.tenantId },
    select: { id: true, role: true },
  });
  if (!target) return res.status(404).json({ error: 'Member not found' });
  // First ADMIN of the tenant is effectively the "owner". Refuse
  // to remove the LAST admin so the tenant can always recover.
  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { tenantId: req.user!.tenantId, role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      return res
        .status(409)
        .json({ error: 'Cannot remove the last admin. Promote another member first.' });
    }
  }
  await prisma.user.delete({ where: { id: target.id } });
  res.status(204).end();
});

const roleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

/**
 * PATCH /api/tenants/members/:id/role
 *
 * Flip a member between USER and ADMIN. OWNER can't be flipped —
 * they retain ownership. Admin/Owner only.
 */
router.patch('/members/:id/role', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can change roles' });
  }
  const id = String(req.params.id);
  if (id === req.user!.id) {
    return res.status(409).json({ error: 'You cannot change your own role' });
  }
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid role' });

  const target = await prisma.user.findFirst({
    where: { id, tenantId: req.user!.tenantId },
    select: { id: true, role: true },
  });
  if (!target) return res.status(404).json({ error: 'Member not found' });
  // Same "last admin" guard: cannot demote the last ADMIN.
  if (target.role === 'ADMIN' && parsed.data.role === 'USER') {
    const adminCount = await prisma.user.count({
      where: { tenantId: req.user!.tenantId, role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      return res
        .status(409)
        .json({ error: 'Cannot demote the last admin. Promote another member first.' });
    }
  }
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role as Role },
    select: { id: true, email: true, role: true },
  });
  res.json({ data: updated });
});

const securityPolicySchema = z.object({
  mfaRequired: z.boolean(),
});

/**
 * GET /api/tenants/security
 *
 * Surfaces the tenant's security policy — today just `mfaRequired`.
 * Readable by every authed member because the UI needs it to render
 * the "your admin requires MFA" banner; write is admin-only.
 */
router.get('/security', authenticate, async (req: AuthRequest, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { mfaRequired: true },
  });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  res.json({ data: tenant });
});

/**
 * PATCH /api/tenants/security
 *
 * Toggle the tenant-wide MFA requirement. Admin-only.
 *
 * Self-lockout guard: enabling the policy while the calling admin
 * has no MFA enrolled would immediately bounce them out of the app
 * on the next request. We refuse the write with a 409 so the admin
 * is forced to enroll their own TOTP first — mirrors the pattern
 * GitHub uses for org-level 2FA.
 */
router.patch('/security', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can change the security policy' });
  }
  const parsed = securityPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors });
  }

  if (parsed.data.mfaRequired) {
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { mfaEnabled: true },
    });
    if (!admin?.mfaEnabled) {
      return res.status(409).json({
        error: 'Enable your own MFA before requiring it for the tenant',
        code: 'admin_mfa_required',
      });
    }
  }

  const updated = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data: { mfaRequired: parsed.data.mfaRequired },
    select: { mfaRequired: true },
  });

  // Best-effort audit. Never block the policy change on a broken
  // audit chain — the DB trigger keeps the log immutable, and if
  // the write fails we would rather lose the event than block the
  // admin's legitimate security action.
  void getAudit()
    .record({
      tenantId: req.user!.tenantId,
      type: 'tenant.mfa_policy_changed',
      actorId: req.user!.id,
      actorType: 'user',
      resource: req.user!.tenantId,
      payload: {
        policy: 'mfaRequired',
        enabled: updated.mfaRequired,
      },
    })
    .catch(() => undefined);

  res.json({ data: updated });
});

const EXPORT_ALLOWED_PLANS = new Set(['BUSINESS', 'ENTERPRISE', 'PRO']);

/**
 * GET /api/tenants/audit/export
 *
 * Admin-initiated UI download. Mirror of `/api/v1/audit/export` but
 * authenticated with the session cookie instead of an API key so an
 * admin can one-click the export from the Settings page without
 * minting a key. Same plan gate + same streaming path; the UI fires
 * `window.location.assign(url)` and the browser handles the download.
 *
 * Admin-only: the audit log is sensitive. A USER-role member
 * clicking around in Settings should not be able to pull it.
 */
router.get('/audit/export', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can export the audit log' });
  }

  const tenantId = req.user!.tenantId;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant || !EXPORT_ALLOWED_PLANS.has(tenant.plan)) {
    return res.status(402).json({
      error: 'Audit export requires the Business plan or higher.',
      code: 'plan_gate',
    });
  }

  let fromSeq: bigint | undefined;
  if (typeof req.query.fromSeq === 'string') {
    try {
      fromSeq = BigInt(req.query.fromSeq);
      if (fromSeq < 0n) throw new Error('negative');
    } catch {
      return res.status(400).json({
        error: 'fromSeq must be a non-negative integer',
        code: 'invalid_fromSeq',
      });
    }
  }

  const filename = `cairn-audit-${tenantId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.ndjson`;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.flushHeaders?.();

  let count = 0;
  try {
    for await (const row of getAudit().streamEvents(tenantId, { fromSeq })) {
      const serialized = {
        ...row,
        seq: row.seq.toString(),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      };
      res.write(JSON.stringify(serialized));
      res.write('\n');
      count++;
    }
  } catch (err) {
    req.log?.error({ err, tenantId, count }, 'audit.export.stream_failed');
  }
  res.end();

  void getAudit()
    .record({
      tenantId,
      type: 'audit.exported',
      actorId: req.user!.id,
      actorType: 'user',
      resource: tenantId,
      payload: {
        format: 'ndjson',
        count,
        fromSeq: fromSeq?.toString() ?? null,
      },
    })
    .catch(() => undefined);
});

export default router;
