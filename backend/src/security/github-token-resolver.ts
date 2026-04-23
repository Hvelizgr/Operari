import type { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { logger } from '../config/logger.config';
import { SecretCipher } from './secret-cipher';
import { SecretReader } from './secret-reader';

/**
 * Decrypt a ConnectedAccount.accessToken ciphertext into a plaintext
 * GitHub token. Returns null on any failure (missing key, bad ciphertext,
 * audit write error) — callers treat "no token" and "decryption failed"
 * the same way: skip the GitHub side-effect.
 *
 * Every call emits a `secret.accessed` audit event via SecretReader, so
 * an operator can tell later who pulled which token for which operation.
 */
export type TokenDecryptor = (
  ciphertext: string,
  accountId: string,
  tenantId: string,
  reason: string
) => Promise<string | null>;

/**
 * Production-grade decryptor. Wires SecretCipher + AuditService +
 * SecretReader from the env's ENCRYPTION_KEY.
 *
 * The earlier GitHub services read `account.accessToken` directly and
 * passed it to the GitHub API — that path only works in tests where a
 * fake Prisma returns plaintext. In production the column is always
 * ciphertext (ConnectedAccountService.create/update encrypt on write),
 * so those services were silently broken for any tenant that had
 * actually connected a GitHub account.
 */
export function createDefaultGitHubTokenDecryptor(prisma: PrismaClient): TokenDecryptor {
  // Lazy-require so test suites that inject their own decryptor and
  // never trigger the production path don't pay the env.config
  // side-effects (zod validation of the whole env at import time).
  const key = process.env.ENCRYPTION_KEY ?? '0'.repeat(64);
  const cipher = new SecretCipher(key);
  const audit = new AuditService(prisma);
  const reader = new SecretReader(cipher, audit);
  return async (ciphertext, accountId, tenantId, reason) => {
    try {
      return await reader.read({
        ciphertext,
        aad: accountId,
        tenantId,
        actorId: 'system',
        actorType: 'system',
        resource: `connected-account:${accountId}`,
        reason,
      });
    } catch (err) {
      logger.error({ err, tenantId, accountId, reason }, 'Failed to decrypt GitHub access token');
      return null;
    }
  };
}

/**
 * Identity decryptor for tests. Treats the "ciphertext" field as
 * already-plaintext — mirrors the old broken behavior so existing unit
 * tests that use fake Prisma don't need to wire a real cipher.
 */
export const identityGitHubTokenDecryptor: TokenDecryptor = async ciphertext => ciphertext;
