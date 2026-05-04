import type { Role } from '@prisma/client';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { AuditService, type AuditEventType } from '../audit/audit.service';
import { type AuditExportRow, buildDeletedActorSet, redactRow } from '../audit/audit-redaction';
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
 * Compute defaults shape. Mirrors the per-device ComputePrefs panel
 * but lives at the workspace level — admin-set, applied at trigger
 * time when neither the request payload nor the runbook spec
 * supplies an explicit value. Each field is optional so admins can
 * pin one knob without committing to all four.
 */
const computeDefaultsSchema = z.object({
  machine: z
    .enum(['micro', 'small-1x', 'small-2x', 'medium-1x', 'medium-2x', 'large-1x', 'large-2x'])
    .nullable()
    .optional(),
  ttlSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 3600)
    .nullable()
    .optional(),
  retryCount: z.number().int().min(0).max(10).nullable().optional(),
  dryRun: z.boolean().nullable().optional(),
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

/**
 * GET /api/tenants/compute-defaults
 *
 * Read the workspace compute defaults. Visible to every authed
 * member because the trigger dialog reads them to show "this
 * machine is the workspace default" hints. Write is admin-only.
 */
router.get('/compute-defaults', authenticate, async (req: AuthRequest, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { computeDefaults: true },
  });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  res.json({ data: tenant.computeDefaults ?? {} });
});

/**
 * PATCH /api/tenants/compute-defaults
 *
 * Admin-only. Merge-style update: any field the body omits is left
 * alone; explicit `null` clears that knob (so a tenant can revert
 * a single default without wiping the whole object).
 */
router.patch('/compute-defaults', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can change workspace defaults' });
  }
  const parsed = computeDefaultsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors });
  }

  // Merge so a PATCH that only sets `machine` doesn't clobber a
  // previously-set ttlSeconds. Explicit nulls land in the merged
  // object and behave as "this knob has no default" downstream.
  const existing = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { computeDefaults: true },
  });
  const merged = {
    ...((existing?.computeDefaults ?? {}) as Record<string, unknown>),
    ...parsed.data,
  };

  const updated = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data: { computeDefaults: merged },
    select: { computeDefaults: true },
  });

  void getAudit()
    .record({
      tenantId: req.user!.tenantId,
      type: 'tenant.compute_defaults_changed',
      actorId: req.user!.id,
      actorType: 'user',
      resource: req.user!.tenantId,
      payload: { defaults: updated.computeDefaults },
    })
    .catch(() => undefined);

  res.json({ data: updated.computeDefaults ?? {} });
});

/**
 * GET /api/tenants/audit/verify
 *
 * Walks the caller tenant's audit chain and reports whether the hash
 * sequence is intact. Session-authenticated mirror of the API-key
 * `/api/v1/audit/verify` endpoint so an admin can run "verify chain"
 * from the Settings page without minting an API key.
 *
 * Admin-only: the chain status is sensitive operational metadata. A
 * tampered or broken chain is the first signal an attacker would try
 * to suppress; non-admin members do not get to read it.
 *
 * Not plan-gated. Verification has to be free for self-host and free
 * tenants — it is the whole point of an immutable audit log.
 */
router.get('/audit/verify', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can verify the audit chain' });
  }

  const tenantId = req.user!.tenantId;

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

  const status = await getAudit().verifyChain(tenantId, { fromSeq });

  res.json({
    tenantId: status.tenantId,
    eventCount: status.eventCount,
    intact: status.firstBrokenSeq === null && status.firstGapAfterSeq === null,
    firstBrokenSeq: status.firstBrokenSeq?.toString() ?? null,
    firstGapAfterSeq: status.firstGapAfterSeq?.toString() ?? null,
    verifiedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/tenants/audit/events
 *
 * Paginated read of the caller tenant's audit chain for the inspector
 * UI. Cursor pagination by seq (ascending) so the UI can step forward
 * one page at a time without expensive offset-based scans.
 *
 * Query params:
 *   - fromSeq:  optional bigint string, the inclusive low bound
 *   - pageSize: optional, default 50, clamped to [1, 200]
 *   - type:     optional repeatable filter by AuditEventType, e.g.
 *               `?type=run.started&type=run.failed`
 *
 * Admin-only for the same reason as verify. GDPR redaction of
 * deleted-actor references is applied before bytes leave the process,
 * mirroring the export endpoint so the inspector and the export show
 * the same redacted view.
 */
router.get('/audit/events', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can read the audit log' });
  }

  const tenantId = req.user!.tenantId;

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

  let pageSize = 50;
  if (typeof req.query.pageSize === 'string') {
    const parsed = Number.parseInt(req.query.pageSize, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
      return res.status(400).json({
        error: 'pageSize must be an integer between 1 and 200',
        code: 'invalid_pageSize',
      });
    }
    pageSize = parsed;
  }

  const typesParam = req.query.type;
  const types = Array.isArray(typesParam)
    ? typesParam.filter((t): t is string => typeof t === 'string')
    : typeof typesParam === 'string'
      ? [typesParam]
      : undefined;

  const deletedActors = await buildDeletedActorSet(getAudit(), tenantId);

  const collected: AuditExportRow[] = [];
  // streamEvents yields one page at a time internally; we cap the
  // collection at pageSize for the inspector. The +1 lets us decide
  // whether a `nextSeq` cursor exists without a second query.
  // Cast: AuditEventType is a closed union but the request layer hands
  // us arbitrary strings. Prisma's `IN` is a no-match on unknown
  // values, so an attacker probing junk types just gets [].
  for await (const row of getAudit().streamEvents(tenantId, {
    fromSeq,
    pageSize: pageSize + 1,
    types: types as AuditEventType[] | undefined,
  })) {
    collected.push(redactRow(row, deletedActors));
    if (collected.length > pageSize) break;
  }

  const hasMore = collected.length > pageSize;
  const trimmed = hasMore ? collected.slice(0, pageSize) : collected;
  const data = trimmed.map(row => ({
    ...row,
    seq: row.seq.toString(),
    createdAt: row.createdAt.toISOString(),
  }));

  res.json({
    data,
    nextSeq:
      hasMore && trimmed.length > 0 ? (trimmed[trimmed.length - 1].seq + 1n).toString() : null,
  });
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

  const filename = `operari-audit-${tenantId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.ndjson`;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.flushHeaders?.();

  // GDPR: mask any reference to a deleted user before bytes leave
  // the process. Mirrors the /api/v1/audit/export behavior so both
  // surfaces produce equivalent redacted streams.
  const deletedActors = await buildDeletedActorSet(getAudit(), tenantId);

  let count = 0;
  try {
    for await (const row of getAudit().streamEvents(tenantId, { fromSeq })) {
      const redacted = redactRow(row, deletedActors);
      const serialized = {
        ...redacted,
        seq: redacted.seq.toString(),
        createdAt:
          redacted.createdAt instanceof Date
            ? redacted.createdAt.toISOString()
            : redacted.createdAt,
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
