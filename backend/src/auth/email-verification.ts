import type { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { logger } from '../config/logger.config';
import { sendEmail } from '../services/email.service';
import { renderVerificationEmail } from '../services/email-templates';

export const VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a fresh verification token + its SHA-256 for storage.
 * Same pattern as the password reset helper — the raw token leaves
 * the backend exactly once (the email body) and a DB read cannot
 * reconstruct it.
 */
export function generateVerificationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashVerificationToken(token) };
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a new verification token and fire the email. Safe to call
 * multiple times — the row-level invariant is single-use, not
 * single-row, so we just invalidate previous unclaimed tokens to
 * keep only the latest link working.
 *
 * Returns silently on both success and known failure modes (user
 * already verified, email send failure) because the caller is
 * typically the register handler or a rate-limited resend endpoint,
 * and neither cares about the reason.
 */
export async function issueVerificationEmail(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return;
  if (user.emailVerified) return;

  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  await prisma.emailVerificationToken.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  // The verify endpoint lives on the backend API. Next.js rewrites
  // `/api/*` to the backend, so this URL works both for browser
  // clicks (proxied) and for direct API calls. The handler redirects
  // back to the frontend on success/failure.
  const verifyUrl = `${frontendUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const tpl = renderVerificationEmail({ verifyUrl, userEmail: user.email });

  try {
    await sendEmail({
      to: user.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  } catch (err) {
    logger.warn({
      err: err instanceof Error ? err.message : String(err),
      userId: user.id,
      msg: 'email_verification: send failed',
    });
  }
}
