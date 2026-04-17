import { createHash, randomBytes } from 'crypto';

/**
 * Tenant invite token helpers.
 *
 * Same hash-at-rest pattern as password reset and email verification.
 * Inviter-side: generate + store the SHA-256. Invitee-side: the raw
 * token travels only in the email link and is compared by re-hashing
 * during `/auth/accept-invite`.
 */

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): { token: string; tokenHash: string } {
    const token = randomBytes(24).toString('base64url');
    return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}
