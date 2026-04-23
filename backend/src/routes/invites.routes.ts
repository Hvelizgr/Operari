import type { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { type Request, type Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { type AuditEventType, AuditService } from '../audit/audit.service';
import { generateInviteToken, hashInviteToken, INVITE_TOKEN_TTL_MS } from '../auth/invite-token';
import { setSessionCookie } from '../auth/session-cookie';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';
import { sendEmail } from '../services/email.service';
import { renderInviteEmail } from '../services/email-templates';

const router = Router();

let auditService: AuditService | null = null;
function getAudit(): AuditService {
  if (!auditService) auditService = new AuditService(prisma);
  return auditService;
}

/**
 * Fire-and-forget audit write for invite lifecycle. Never blocks the
 * HTTP response — auditing is observability, not a dependency.
 */
async function safeAudit(
  type: AuditEventType,
  tenantId: string,
  actorId: string | null,
  resource: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await getAudit().record({
      tenantId,
      type,
      actorId,
      actorType: actorId ? 'user' : 'system',
      resource,
      payload,
    });
  } catch {
    // Observability, not a hard dependency.
  }
}

/**
 * Build a fresh JTI'd session token. Duplicates the helper in
 * auth.routes.ts rather than importing it so the routes stay
 * decoupled — accept-invite should not pull in the full password
 * reset module.
 */
function signSessionToken(claims: {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}): string {
  return jwt.sign(
    { ...claims, jti: randomBytes(16).toString('base64url') },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );
}

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

/**
 * POST /api/invites — invite a teammate by email.
 *
 * Only ADMIN/OWNER users can invite. Caller's tenantId is trusted
 * from the session; a compromised client can't invite into a
 * different tenant. Any pending invite for the same (tenant, email)
 * is revoked before issuing a new one so the email recipient
 * doesn't end up with two live links.
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid invite payload', issues: parsed.error.issues });
  }
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'OWNER') {
    return res.status(403).json({ error: 'Only admins can invite' });
  }

  const email = parsed.data.email.toLowerCase();

  // If the email already belongs to a user on THIS tenant, fail
  // loudly so the admin can't accidentally invite someone who's
  // already in.
  const existingOnTenant = await prisma.user.findFirst({
    where: { email, tenantId: req.user!.tenantId },
    select: { id: true },
  });
  if (existingOnTenant) {
    return res.status(409).json({ error: 'This user is already a member of the tenant' });
  }

  await prisma.tenantInvite.updateMany({
    where: { tenantId: req.user!.tenantId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
  const invite = await prisma.tenantInvite.create({
    data: {
      tokenHash,
      email,
      tenantId: req.user!.tenantId,
      role: parsed.data.role as Role,
      invitedByUserId: req.user!.id,
      expiresAt,
    },
  });

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const inviteUrl = `${frontendUrl}/en/invite/${encodeURIComponent(token)}`;
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { name: true },
  });
  const tpl = renderInviteEmail({
    inviteUrl,
    inviterEmail: req.user!.email,
    tenantName: tenant?.name ?? 'a Cairn workspace',
  });

  await sendEmail({
    to: email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  }).catch(() => undefined);

  await safeAudit('invite.created', req.user!.tenantId, req.user!.id, invite.id, {
    inviteEmail: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });

  return res.status(201).json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
});

/**
 * GET /api/invites — list pending + recently-accepted invites for
 * the authenticated user's tenant. Tenants rarely have hundreds of
 * open invites so pagination is not needed in v1.
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const invites = await prisma.tenantInvite.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: [{ acceptedAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  res.json({ data: invites });
});

/**
 * DELETE /api/invites/:id — revoke a pending invite. Already-accepted
 * invites return 409; the admin should just remove the user row
 * instead. 404 when the invite is not in this tenant, so one tenant
 * admin cannot probe another tenant's invite ids.
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'OWNER') {
    return res.status(403).json({ error: 'Only admins can revoke invites' });
  }
  const invite = await prisma.tenantInvite.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.acceptedAt) {
    return res.status(409).json({ error: 'Invite was already accepted — remove the user instead' });
  }
  await prisma.tenantInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });
  await safeAudit('invite.revoked', req.user!.tenantId, req.user!.id, invite.id, {
    inviteEmail: invite.email,
  });
  res.status(204).end();
});

/**
 * GET /api/invites/lookup/:token — public lookup for the accept page.
 *
 * Returns the invite metadata the UI needs to render the accept
 * screen (tenant name, invited email, inviter, expiresAt, role)
 * without exposing internal ids. 410 Gone is the right answer for a
 * consumed, revoked, or expired invite — the UI branches on it to
 * show "this link is no longer valid" instead of the signup form.
 */
router.get('/lookup/:token', async (req: Request, res: Response) => {
  const rawToken = String(req.params.token ?? '');
  if (!rawToken) return res.status(400).json({ error: 'Missing token' });

  const invite = await prisma.tenantInvite.findUnique({
    where: { tokenHash: hashInviteToken(rawToken) },
    include: { tenant: { select: { name: true } } },
  });
  const now = new Date();
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.acceptedAt || invite.revokedAt || invite.expiresAt < now) {
    return res.status(410).json({ error: 'Invite is no longer valid' });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: invite.invitedByUserId },
    select: { email: true, name: true },
  });

  return res.json({
    data: {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      tenantName: invite.tenant.name,
      invitedBy: inviter?.email ?? null,
    },
  });
});

const acceptSchema = z.object({
  token: z.string().min(8),
  password: z.string().min(8),
  name: z.string().optional(),
});

/**
 * POST /api/invites/accept — consume an invite + provision the
 * recipient's account.
 *
 * Creates a User linked to the invite's tenant (NOT a new tenant —
 * this is the whole point of invites). Password is hashed with the
 * same bcrypt 12 we use everywhere else. On success we mark the
 * invite accepted, audit, and issue a session cookie so the user
 * lands directly in the dashboard.
 *
 * Pre-existing users cannot accept — an invite assumes a fresh user
 * on the receiving end. Cross-tenant migration ("move my user from
 * tenant A to tenant B") is a separate feature we are not building
 * in v1.
 */
router.post('/accept', async (req: Request, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }
  const invite = await prisma.tenantInvite.findUnique({
    where: { tokenHash: hashInviteToken(parsed.data.token) },
  });
  const now = new Date();
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.acceptedAt || invite.revokedAt || invite.expiresAt < now) {
    return res.status(410).json({ error: 'Invite is no longer valid' });
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return res
      .status(409)
      .json({ error: 'A user with that email already exists — sign in instead' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const newUser = await prisma.user.create({
    data: {
      email: invite.email,
      passwordHash,
      name: parsed.data.name,
      tenantId: invite.tenantId,
      role: invite.role,
      emailVerified: true, // the invite link itself proves email ownership
    },
  });

  await prisma.tenantInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: now, acceptedByUserId: newUser.id },
  });
  await safeAudit('invite.accepted', invite.tenantId, newUser.id, invite.id, {
    inviteEmail: invite.email,
    role: invite.role,
    invitedBy: invite.invitedByUserId,
  });

  const token = signSessionToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    tenantId: newUser.tenantId,
  });
  setSessionCookie(req, res, token);

  const tenant = await prisma.tenant.findUnique({
    where: { id: invite.tenantId },
    select: { id: true, name: true },
  });

  res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    },
    tenant: {
      id: tenant?.id,
      name: tenant?.name,
    },
    token,
  });
});

export default router;
