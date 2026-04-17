import { Router, type Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../server';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import {
    buildOtpauthUrl,
    generateTotpSecret,
    verifyTotp,
} from '../auth/totp';
import { secretCipherFromEnv } from '../security/secret-cipher';
import { AuditService, type AuditEventType } from '../audit/audit.service';
import { issueBackupCodes } from '../auth/mfa-backup-codes';

const router = Router();

let auditService: AuditService | null = null;
function getAudit(): AuditService {
    if (!auditService) auditService = new AuditService(prisma);
    return auditService;
}

/**
 * Fire-and-forget audit write. Failures never break the response —
 * the MFA endpoints must never fail because the audit chain wobbled.
 */
async function safeAudit(
    type: AuditEventType,
    actorId: string,
    tenantId: string,
    payload: Record<string, unknown>,
): Promise<void> {
    try {
        await getAudit().record({
            tenantId,
            type,
            actorId,
            actorType: 'user',
            resource: actorId,
            payload,
        });
    } catch {
        // Observability, not a hard dependency.
    }
}

/**
 * MFA enroll flow:
 *   1. POST /enroll → server mints a fresh base32 secret, stores the
 *      CIPHERTEXT on the user row (mfaEnabled stays false), returns
 *      the plaintext secret + otpauth URL. The user scans it into
 *      Google Authenticator / 1Password.
 *   2. POST /verify-enroll {code} → we hit our own verifyTotp with
 *      the decrypted secret. If it matches, flip mfaEnabled=true.
 *      The secret stays in the DB (encrypted) so future logins can
 *      verify against it.
 *
 * Intentional one-shot enroll (no re-scan): calling /enroll while
 * already enrolled returns 409 — we don't want a surprise secret
 * rotation to lock the user out. Disable first, then re-enroll.
 */

const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

router.post('/enroll', authenticate, async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, mfaEnabled: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.mfaEnabled) {
        return res.status(409).json({ error: 'MFA is already enabled. Disable first to re-enroll.' });
    }

    const cipher = secretCipherFromEnv();
    const secret = generateTotpSecret();
    const ciphered = cipher.encrypt(secret, `mfa:${user.id}`);

    await prisma.user.update({
        where: { id: user.id },
        data: { mfaSecretCiphered: ciphered },
    });

    const otpauth = buildOtpauthUrl({ secret, accountName: user.email });
    return res.json({
        secret,
        otpauth,
    });
});

router.post('/verify-enroll', authenticate, async (req: AuthRequest, res: Response) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid code' });

    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, mfaEnabled: true, mfaSecretCiphered: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.mfaEnabled) return res.status(409).json({ error: 'MFA already enabled' });
    if (!user.mfaSecretCiphered) {
        return res.status(409).json({ error: 'No pending MFA enrollment — call /enroll first' });
    }

    const cipher = secretCipherFromEnv();
    const secret = cipher.decrypt(user.mfaSecretCiphered, `mfa:${user.id}`);
    if (!verifyTotp(secret, parsed.data.code)) {
        return res.status(400).json({ error: 'Invalid TOTP code' });
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
    });
    // Backup codes are only generated on the first enroll success.
    // The plaintext codes are returned in THIS response and never
    // again — the user is expected to print/save them. Any future
    // regeneration happens via POST /auth/mfa/backup-codes.
    const backupCodes = await issueBackupCodes(prisma, user.id);
    await safeAudit('mfa.enabled', req.user!.id, req.user!.tenantId, {
        method: 'totp',
        backupCodesGenerated: backupCodes.length,
    });
    return res.json({ mfaEnabled: true, backupCodes });
});

/**
 * POST /auth/mfa/backup-codes — regenerate the full set of 10 codes.
 *
 * Invalidates every prior unused code. Caller's password is required
 * so a stolen cookie can't silently rotate the user's recovery
 * material out from under them.
 */
const regenSchema = z.object({ password: z.string().min(1) });

router.post('/backup-codes', authenticate, async (req: AuthRequest, res: Response) => {
    const parsed = regenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Password required' });

    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, passwordHash: true, mfaEnabled: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfaEnabled) return res.status(409).json({ error: 'MFA is not enabled' });
    if (!user.passwordHash) {
        return res
            .status(409)
            .json({ error: 'Account has no password. Use /forgot-password to set one first.' });
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const backupCodes = await issueBackupCodes(prisma, user.id);
    return res.json({ backupCodes });
});

const disableSchema = z.object({
    password: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
});

router.post('/disable', authenticate, async (req: AuthRequest, res: Response) => {
    const parsed = disableSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
            id: true,
            passwordHash: true,
            mfaEnabled: true,
            mfaSecretCiphered: true,
        },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfaEnabled || !user.mfaSecretCiphered) {
        return res.status(409).json({ error: 'MFA is not enabled' });
    }
    if (!user.passwordHash) {
        return res
            .status(409)
            .json({ error: 'Account has no password. Use /forgot-password to set one first.' });
    }

    // Require BOTH password and a valid TOTP to disable — lets an
    // admin recover the account if their phone is stolen (they still
    // need the password), but prevents a stolen session cookie from
    // silently disabling MFA.
    const pwOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!pwOk) return res.status(401).json({ error: 'Invalid credentials' });

    const cipher = secretCipherFromEnv();
    const secret = cipher.decrypt(user.mfaSecretCiphered, `mfa:${user.id}`);
    if (!verifyTotp(secret, parsed.data.code)) {
        return res.status(401).json({ error: 'Invalid TOTP code' });
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecretCiphered: null },
    });
    await safeAudit('mfa.disabled', req.user!.id, req.user!.tenantId, {
        method: 'totp',
    });
    return res.json({ mfaEnabled: false });
});

export default router;
