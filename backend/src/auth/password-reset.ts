import { createHash, randomBytes } from 'crypto';

/**
 * Password reset token helpers.
 *
 * We generate a URL-safe random token and store only its SHA-256 in
 * the DB. The user receives the raw string over email and submits it
 * to /reset-password. The server hashes the submission and looks it
 * up — a database leak cannot produce a usable reset link.
 *
 * SHA-256 is fine here (unlike for passwords) because the raw token
 * is already high-entropy (192 bits). The hash defends against
 * exfiltrated DB dumps, not against brute force.
 */

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
