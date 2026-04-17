import { Router } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { AuditService, AuditEventType } from '../audit/audit.service';
import { AccountLockoutService } from '../auth/account-lockout.service';
import {
    AccountDeletionService,
    AccountDeletionError,
} from '../auth/account-deletion.service';
import { setSessionCookie, clearSessionCookie } from '../auth/session-cookie';
import {
    generateResetToken,
    hashResetToken,
    RESET_TOKEN_TTL_MS,
} from '../auth/password-reset';
import {
    hashVerificationToken,
    issueVerificationEmail,
} from '../auth/email-verification';
import { verifyTotp } from '../auth/totp';
import { consumeBackupCode, unusedBackupCodeCount } from '../auth/mfa-backup-codes';
import { secretCipherFromEnv } from '../security/secret-cipher';
import { checkBreachedPassword } from '../auth/password-breach';
import { sendEmail } from '../services/email.service';
import { renderPasswordResetEmail } from '../services/email-templates';
import { revokeJti } from '../auth/session-denylist';

/**
 * Build a signed session token with a fresh JTI so the JWT denylist
 * in session-denylist.ts can revoke individual sessions. All session
 * issuances go through this so logout works uniformly regardless of
 * whether the token was minted by login, register, reset-password,
 * or the OAuth callback.
 */
function signSessionToken(claims: { userId: string; email: string; role: string; tenantId: string }): string {
    return jwt.sign(
        { ...claims, jti: randomBytes(16).toString('base64url') },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] },
    );
}

const router = Router();

let lockoutService: AccountLockoutService | null = null;
function getLockout(): AccountLockoutService {
    if (!lockoutService) {
        lockoutService = new AccountLockoutService(prisma, getAudit());
    }
    return lockoutService;
}

let deletionService: AccountDeletionService | null = null;
function getDeletion(): AccountDeletionService {
    if (!deletionService) {
        deletionService = new AccountDeletionService(prisma, getAudit());
    }
    return deletionService;
}

let auditService: AuditService | null = null;
function getAudit(): AuditService {
    if (!auditService) auditService = new AuditService(prisma);
    return auditService;
}

/**
 * Fire-and-forget audit write for auth events. Failures are logged but
 * never break the response — auditing is observability, not a hard
 * dependency.
 */
async function safeAuditAuth(
    type: AuditEventType,
    params: {
        tenantId: string;
        actorId: string;
        ipAddress?: string;
        userAgent?: string;
        method: 'password' | 'register' | 'client-initiated';
    },
): Promise<void> {
    try {
        await getAudit().record({
            tenantId: params.tenantId,
            type,
            actorId: params.actorId,
            actorType: 'user',
            resource: params.actorId,
            payload: {
                method: params.method,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
            },
        });
    } catch {
        // never block the auth response
    }
}

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0]?.trim();
    return req.ip;
}

function userAgent(req: { headers: Record<string, unknown> }): string | undefined {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua : undefined;
}

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional(),
    tenantName: z.string().min(2),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    /**
     * TOTP verification code. Required when the user has MFA
     * enabled; ignored otherwise. The UI submits it on the second
     * pass after the first login response comes back with
     * `{ mfaRequired: true }`.
     */
    totpCode: z.string().regex(/^\d{6}$/).optional(),
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user and tenant
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, tenantName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               tenantName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                 token: { type: string }
 *             example:
 *               user:
 *                 id: "cm5..."
 *                 email: "admin@company.com"
 *                 name: "Admin User"
 *                 role: "ADMIN"
 *               tenant:
 *                 id: "tenant-123"
 *                 name: "My Company"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Validation error or email already exists
 *         content:
 *           application/json:
 *             example:
 *               error: "Email already registered"
 */
router.post('/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // HIBP k-anonymity breach check. Fail-open: if the HIBP API is
        // unreachable we allow the password through (handled inside
        // checkBreachedPassword). We reject outright when the password
        // appears above the threshold — exposing the occurrence count
        // is deliberate UX so the user knows WHY.
        const breach = await checkBreachedPassword(data.password);
        if (breach.breached) {
            return res.status(400).json({
                error: 'Password appears in public breach datasets. Pick something unique.',
                breach: { occurrences: breach.occurrences },
            });
        }

        const passwordHash = await bcrypt.hash(data.password, 12);
        const slug = data.tenantName.toLowerCase().replace(/\s+/g, '-');

        const tenant = await prisma.tenant.create({
            data: {
                name: data.tenantName,
                slug: `${slug}-${Date.now()}`,
            },
        });

        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                name: data.name,
                tenantId: tenant.id,
                role: 'ADMIN',
            },
        });

        const token = signSessionToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
        });

        await safeAuditAuth('auth.login', {
            tenantId: tenant.id,
            actorId: user.id,
            ipAddress: clientIp(req),
            userAgent: userAgent(req),
            method: 'register',
        });

        // Fire the verification email. Best-effort: register always
        // returns 201 even if the email delivery path fails so the
        // user is not blocked on our provider going down.
        issueVerificationEmail(prisma, user.id).catch((err) => {
            req.log.warn({ err, userId: user.id }, 'verification email failed to issue');
        });

        setSessionCookie(req, res, token);
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
            },
            token,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Register error');
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                 token: { type: string }
 *             example:
 *               user:
 *                 id: "cm5..."
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 role: "USER"
 *               tenant:
 *                 id: "tenant-123"
 *                 name: "Acme Corp"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid credentials"
 */
router.post('/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: data.email },
            include: { tenant: true },
        });

        if (!user || !user.passwordHash) {
            // Null passwordHash = user signed up via OAuth only, so
            // password login has no credential to compare against.
            // Returning the same 401 copy keeps us consistent with the
            // anti-enumeration promise.
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Lockout gate. A locked account rejects every login attempt
        // regardless of password correctness — even the right password
        // comes back as a generic 401, so an attacker who cracks the
        // password during lockout learns nothing. We skip the bcrypt
        // call entirely to avoid wasting the ~100ms of hashing on an
        // attempt that can't succeed.
        const lockout = getLockout();
        const reqCtx = { ip: clientIp(req), userAgent: userAgent(req) };
        if (lockout.isLocked(user)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(data.password, user.passwordHash);

        if (!validPassword) {
            // Record the failure and roll the counter. `recordFailure`
            // owns the audit write for auth.login_failed and the
            // transition-edge auth.account_locked event, so the handler
            // stays focused on the wire response.
            await lockout.recordFailure(user, reqCtx).catch(() => undefined);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // MFA gate. If the user enrolled in TOTP, password alone is
        // not enough. Return a 401 with `mfaRequired: true` so the
        // frontend can show the TOTP field — distinct from a plain
        // credential failure so the UX can branch without retrying
        // the password.
        if (user.mfaEnabled && user.mfaSecretCiphered) {
            if (!data.totpCode) {
                return res.status(401).json({ error: 'MFA code required', mfaRequired: true });
            }
            const cipher = secretCipherFromEnv();
            const secret = cipher.decrypt(user.mfaSecretCiphered, `mfa:${user.id}`);
            // Try live TOTP first (6 digits); if that fails OR the
            // input doesn't look like a TOTP, treat it as a backup
            // code. Backup codes are single-use; consumeBackupCode
            // marks them used atomically.
            const totpOk = /^\d{6}$/.test(data.totpCode) && verifyTotp(secret, data.totpCode);
            const backupOk = totpOk ? false : await consumeBackupCode(prisma, user.id, data.totpCode);
            if (!totpOk && !backupOk) {
                return res.status(401).json({ error: 'Invalid MFA code', mfaRequired: true });
            }
        }

        // Credentials + MFA cleared — wipe any residual failure
        // counter so one fat-fingered attempt doesn't count against
        // the next session. Fire-and-forget: the lock write failing
        // doesn't invalidate a successful login.
        lockout.recordSuccess(user.id).catch(() => undefined);

        const token = signSessionToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
        });

        await safeAuditAuth('auth.login', {
            tenantId: user.tenantId,
            actorId: user.id,
            ipAddress: clientIp(req),
            userAgent: userAgent(req),
            method: 'password',
        });

        // Tenant-wide MFA policy: if the admin turned it on AND this
        // user never enrolled, tell the frontend to force them
        // through the enrollment flow. We still grant the session so
        // the /settings/security page is reachable without a second
        // round-trip; downstream routes can tighten this later by
        // checking the same flag in middleware.
        const mfaEnrollmentRequired =
            user.tenant.mfaRequired === true && user.mfaEnabled !== true;

        setSessionCookie(req, res, token);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
            },
            token,
            ...(mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Login error');
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             example:
 *               user:
 *                 id: "u-123"
 *                 email: "me@example.com"
 *                 name: "Me"
 *                 role: "ADMIN"
 *               tenant:
 *                 id: "t-456"
 *                 name: "My Tenant"
 *                 plan: "FREE"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { tenant: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const backupCodesRemaining = user.mfaEnabled
            ? await unusedBackupCodeCount(prisma, user.id)
            : undefined;

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
                mfaEnabled: user.mfaEnabled,
                backupCodesRemaining,
            },
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
                plan: user.tenant.plan,
            },
        });
    } catch (error) {
        req.log.error({ error }, 'Get user error');
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh authentication token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Invalid or expired token"
 */
router.post('/refresh', authenticate, async (req: AuthRequest, res) => {
    try {
        const token = signSessionToken({
            userId: req.user!.id,
            email: req.user!.email,
            role: req.user!.role,
            tenantId: req.user!.tenantId,
        });

        setSessionCookie(req, res, token);
        res.json({ token });
    } catch (error) {
        req.log.error({ error }, 'Refresh error');
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Record a logout for the authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       JWT auth in NanoRun is stateless, so the server cannot truly
 *       invalidate a token mid-flight. Calling this endpoint records an
 *       `auth.logout` audit event tied to the caller's identity, which is
 *       what compliance dashboards and incident timelines actually need.
 *       Real revocation will require a server-side denylist or short-lived
 *       tokens with refresh — tracked separately.
 *     responses:
 *       200:
 *         description: Logout recorded
 */
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
    // Pull the raw token out of whatever transport brought it in so we
    // can revoke its JTI in Redis. On a miss (no JTI claim, token from
    // WorkOS, etc.) we still clear the cookie and 200 — revocation is
    // best-effort and should not block the UX.
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : undefined;
    const cookieToken =
        (req as AuthRequest & { cookies?: Record<string, string> }).cookies?.nanorun_session;
    const rawToken = bearer ?? cookieToken;
    if (rawToken) {
        try {
            const decoded = jwt.decode(rawToken) as
                | { jti?: string; exp?: number }
                | null;
            if (decoded?.jti) {
                const ttl = decoded.exp
                    ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
                    : 7 * 24 * 60 * 60;
                await revokeJti(decoded.jti, ttl);
            }
        } catch {
            // If decoding fails we still want to complete the logout.
        }
    }

    await safeAuditAuth('auth.logout', {
        tenantId: req.user!.tenantId,
        actorId: req.user!.id,
        ipAddress: clientIp(req),
        userAgent: userAgent(req),
        method: 'client-initiated',
    });
    clearSessionCookie(req, res);
    res.json({ message: 'Logged out' });
});

const deleteAccountSchema = z.object({
    password: z.string().min(1, 'password required'),
    totpCode: z.string().optional(),
    /** Explicit opt-in for tenant deletion when the user is the
     *  sole member. Keeps accidental "delete my workspace" out of
     *  reach without a second UI confirmation. */
    deleteTenant: z.boolean().optional().default(false),
});

/**
 * DELETE /auth/account
 *
 * GDPR self-serve purge. Requires password re-confirmation (and a
 * TOTP code if MFA is enrolled) so a hijacked session can't wipe an
 * account. On success the session cookie is cleared + the user's
 * tenant is cascaded out when they are its only member.
 *
 * Error contract is stable so the UI can branch on `code`:
 *   - invalid_credentials         → 401
 *   - mfa_required | mfa_invalid  → 401 with mfaRequired: true
 *   - tenant_has_other_members    → 409
 */
router.delete('/account', authenticate, async (req: AuthRequest, res) => {
    try {
        const body = deleteAccountSchema.parse(req.body ?? {});
        const result = await getDeletion().deleteAccount({
            userId: req.user!.id,
            password: body.password,
            totpCode: body.totpCode,
            deleteTenantIfSoleMember: body.deleteTenant,
        });

        // Invalidate the session token so the now-dangling JWT can't
        // be replayed (even though the user row is gone, the token
        // signature is still valid until expiry).
        const authHeader = req.headers.authorization;
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
        const cookieToken =
            (req as AuthRequest & { cookies?: Record<string, string> }).cookies?.nanorun_session;
        const rawToken = bearer ?? cookieToken;
        if (rawToken) {
            try {
                const decoded = jwt.decode(rawToken) as { jti?: string; exp?: number } | null;
                if (decoded?.jti) {
                    const ttl = decoded.exp
                        ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
                        : 7 * 24 * 60 * 60;
                    await revokeJti(decoded.jti, ttl);
                }
            } catch {
                /* best-effort */
            }
        }

        clearSessionCookie(req, res);
        return res.status(200).json({
            deleted: true,
            userId: result.deletedUserId,
            tenantId: result.deletedTenantId,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: err.errors });
        }
        if (err instanceof AccountDeletionError) {
            switch (err.code) {
                case 'invalid_credentials':
                    return res.status(401).json({ error: err.message, code: err.code });
                case 'mfa_required':
                case 'mfa_invalid':
                    return res.status(401).json({
                        error: err.message,
                        code: err.code,
                        mfaRequired: true,
                    });
                case 'tenant_has_other_members':
                    return res.status(409).json({ error: err.message, code: err.code });
            }
        }
        req.log.error({ err }, 'Delete account error');
        return res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * POST /auth/forgot-password
 *
 * Issues a one-shot password reset token and emails it to the user.
 * We ALWAYS respond 204 (same shape, same latency target) regardless
 * of whether the email is on file — otherwise an attacker could
 * enumerate users by timing the response or matching on status codes.
 */
const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

router.post('/forgot-password', async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        // Even validation errors return 204 to keep the response shape
        // indistinguishable to an attacker.
        return res.status(204).end();
    }
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
        // Invalidate any previous tokens so a stolen inbox only gives
        // the attacker the most recent link (and the user's click
        // invalidates theirs).
        await prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
        });

        const { token, tokenHash } = generateResetToken();
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        await prisma.passwordResetToken.create({
            data: { tokenHash, userId: user.id, expiresAt },
        });

        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
        const resetUrl = `${frontendUrl}/en/reset-password?token=${encodeURIComponent(token)}`;
        const tpl = renderPasswordResetEmail({ resetUrl, userEmail: user.email });
        await sendEmail({
            to: user.email,
            subject: tpl.subject,
            text: tpl.text,
            html: tpl.html,
        });
        await safeAuditAuth('auth.login', {
            tenantId: user.tenantId,
            actorId: user.id,
            ipAddress: clientIp(req),
            userAgent: userAgent(req),
            method: 'register',
        }).catch(() => undefined);
    }
    return res.status(204).end();
});

/**
 * POST /auth/reset-password
 *
 * Consumes the token, sets the new password, marks the row as used
 * so it can't be reused, and issues a fresh session so the user is
 * logged in after clicking the link.
 */
const resetPasswordSchema = z.object({
    token: z.string().min(8),
    password: z.string().min(8),
});

router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    const tokenHash = hashResetToken(parsed.data.token);
    const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { tenant: true } } },
    });

    const now = new Date();
    if (!record || record.usedAt || record.expiresAt < now) {
        return res.status(400).json({ error: 'Reset link is invalid or expired' });
    }

    const breach = await checkBreachedPassword(parsed.data.password);
    if (breach.breached) {
        return res.status(400).json({
            error: 'Password appears in public breach datasets. Pick something unique.',
            breach: { occurrences: breach.occurrences },
        });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.$transaction([
        prisma.user.update({
            where: { id: record.userId },
            data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
            where: { id: record.id },
            data: { usedAt: now },
        }),
        // Revoke any other outstanding reset tokens for this user so
        // a second click can't hijack the account.
        prisma.passwordResetToken.updateMany({
            where: { userId: record.userId, usedAt: null, id: { not: record.id } },
            data: { usedAt: now },
        }),
    ]);

    const token = signSessionToken({
        userId: record.user.id,
        email: record.user.email,
        role: record.user.role,
        tenantId: record.user.tenantId,
    });

    setSessionCookie(req, res, token);
    await safeAuditAuth('auth.login', {
        tenantId: record.user.tenantId,
        actorId: record.user.id,
        ipAddress: clientIp(req),
        userAgent: userAgent(req),
        method: 'password',
    });

    res.json({
        user: {
            id: record.user.id,
            email: record.user.email,
            name: record.user.name,
            role: record.user.role,
        },
        tenant: {
            id: record.user.tenant.id,
            name: record.user.tenant.name,
        },
        token,
    });
});

/**
 * POST /auth/change-password — authenticated password rotation.
 *
 * Requires the current password even for users who authenticate via
 * OAuth in practice, as long as they have a local password set.
 * Social-only users (passwordHash === null) can't use this endpoint;
 * they need to run /forgot-password first to set one.
 */
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});

router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (!user.passwordHash) {
        return res
            .status(409)
            .json({ error: 'No password set. Use forgot-password to create one.' });
    }
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const breach = await checkBreachedPassword(parsed.data.newPassword);
    if (breach.breached) {
        return res.status(400).json({
            error: 'New password appears in public breach datasets. Pick something unique.',
            breach: { occurrences: breach.occurrences },
        });
    }
    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
    });
    res.json({ message: 'Password updated' });
});

/**
 * GET /auth/verify-email?token=xxx
 *
 * Public endpoint — the link lives in an email we already sent. On
 * success we mark emailVerified=true, invalidate the token, and 302
 * to the frontend dashboard with ?verified=true so the client can
 * surface a success toast. Invalid/expired tokens also redirect to
 * a frontend page (/verify-email with an `error` param) rather than
 * returning a JSON 4xx, because the user is clicking a link from an
 * email client and a raw 400 JSON is a terrible end state.
 */
router.get('/verify-email', async (req, res) => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
    if (!rawToken) {
        return res.redirect(`${frontendUrl}/en/verify-email?error=missing_token`);
    }
    try {
        const tokenHash = hashVerificationToken(rawToken);
        const record = await prisma.emailVerificationToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        const now = new Date();
        if (!record || record.usedAt || record.expiresAt < now) {
            return res.redirect(`${frontendUrl}/en/verify-email?error=invalid_or_expired`);
        }
        await prisma.$transaction([
            prisma.user.update({
                where: { id: record.userId },
                data: { emailVerified: true },
            }),
            prisma.emailVerificationToken.update({
                where: { id: record.id },
                data: { usedAt: now },
            }),
            prisma.emailVerificationToken.updateMany({
                where: { userId: record.userId, usedAt: null, id: { not: record.id } },
                data: { usedAt: now },
            }),
        ]);
        return res.redirect(`${frontendUrl}/en/dashboard?verified=true`);
    } catch (err) {
        req.log.error({ err }, 'verify-email failed');
        return res.redirect(`${frontendUrl}/en/verify-email?error=server`);
    }
});

/**
 * POST /auth/send-verification
 *
 * Resend the verification email to the authenticated user. Rate-
 * limited by the surrounding auth tier (5/min/IP) so a user who
 * clicks the "Resend" button repeatedly does not spam the email
 * provider. Returns 204 regardless of outcome — the caller only
 * needs "we tried", not a detailed status.
 */
router.post('/send-verification', authenticate, async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, emailVerified: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) {
        // Idempotent: already verified → treat as success.
        return res.status(204).end();
    }
    await issueVerificationEmail(prisma, user.id);
    return res.status(204).end();
});

export default router;
