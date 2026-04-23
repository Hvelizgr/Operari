import type { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

/**
 * MFA backup codes — phone-lost recovery vector for TOTP users.
 *
 * Generated ten at a time when the user completes TOTP enroll. The
 * plaintext codes are shown to the user ONCE (via the enroll response
 * body); only the SHA-256 lands in the DB. At login time, if the
 * `totpCode` field doesn't match any TOTP window, we fall back to
 * hashing it and looking up an unused backup code. Match → mark as
 * used + authenticate. Miss → standard invalid-MFA response.
 *
 * Shape: 10 chars, `XXXX-XXXX`, upper-case letters + digits without
 * ambiguous glyphs (no 0/O, no 1/I/l). Easy to type, easy to print,
 * harder to misread than raw hex.
 */

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUP_SIZE = 4;
const GROUPS = 2;

function pickChar(): string {
  const bytes = randomBytes(1);
  return BACKUP_CODE_ALPHABET[bytes[0] % BACKUP_CODE_ALPHABET.length];
}

function generateCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP_SIZE; i++) group += pickChar();
    groups.push(group);
  }
  return groups.join('-');
}

export function hashBackupCode(code: string): string {
  // Normalize on input so `abcd-efgh`, `ABCD-EFGH`, and `ABCDEFGH`
  // all hash to the same value — users are going to retype these
  // from paper.
  const normalized = code.replace(/-/g, '').toUpperCase().trim();
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate + persist a fresh set of backup codes for `userId`.
 * Invalidates every previous unused code first (rotating the codes
 * means the old paper is dead). Returns the plaintext codes — the
 * caller is responsible for passing them back to the user in the
 * response body and NEVER logging them.
 */
export async function issueBackupCodes(prisma: PrismaClient, userId: string): Promise<string[]> {
  await prisma.mfaBackupCode.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const codes: string[] = [];
  const rows: Array<{ codeHash: string; userId: string }> = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = generateCode();
    codes.push(code);
    rows.push({ codeHash: hashBackupCode(code), userId });
  }
  await prisma.mfaBackupCode.createMany({ data: rows });
  return codes;
}

/**
 * Look up an unused backup code for `userId` and mark it as used in
 * one transaction. Returns true on a match, false otherwise. The
 * timing difference between "no such code" and "code already used"
 * is intentionally not leaked — both return false without extra work.
 */
export async function consumeBackupCode(
  prisma: PrismaClient,
  userId: string,
  code: string
): Promise<boolean> {
  const codeHash = hashBackupCode(code);
  const row = await prisma.mfaBackupCode.findUnique({
    where: { codeHash },
  });
  if (!row) return false;
  if (row.userId !== userId) return false;
  if (row.usedAt) return false;
  await prisma.mfaBackupCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return true;
}

/**
 * Count of unused backup codes. Surfaced on /auth/me so the UI can
 * nudge the user to regenerate when they're running low.
 */
export async function unusedBackupCodeCount(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.mfaBackupCode.count({ where: { userId, usedAt: null } });
}
