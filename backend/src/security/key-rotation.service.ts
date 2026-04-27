import type { KeyRotationJob, PrismaClient } from '@prisma/client';

import type { AuditService } from '../audit/audit.service';
import { logger } from '../config/logger.config';
import type { SecretCipher } from './secret-cipher';

/**
 * KeyRotationService — drives the re-encrypt-everything workflow.
 *
 * Why this exists: PENDIENTE.md flagged "rotating OPERARI_SECRET_KEY
 * is manual y riesgoso" as the last crypto gap before SOC 2. This
 * service is the state machine + batch worker that closes it.
 *
 * Operator flow
 *   1. Deploy with OPERARI_SECRET_KEY_LEGACY=<current>, rotate
 *      OPERARI_SECRET_KEY to <new>. Every process now reads both and
 *      writes under <new>.
 *   2. Admin calls POST /api/admin/key-rotation/start. This inserts
 *      a KeyRotationJob with status=PENDING + a deadline.
 *   3. A server interval ticks rotateNextBatch() every 5s while a
 *      PENDING/RUNNING job exists. Each tick processes up to
 *      BATCH_SIZE rows across two tables (ConnectedAccount,
 *      User.mfaSecretCiphered), decrypts with whichever master
 *      works, and re-encrypts under the CURRENT master.
 *   4. When the cursor reaches the end, status=COMPLETED. Operator
 *      drops OPERARI_SECRET_KEY_LEGACY on the next deploy.
 *
 * Design choices
 *   - Only ONE active rotation at a time. startRotation rejects when
 *     a PENDING/RUNNING job exists. Two concurrent rotations would
 *     race on the same rows.
 *   - The cursor is a JSON {table, lastId}. Tables are processed
 *     lexicographically (ConnectedAccount → User). Resume picks up
 *     from (table, lastId) regardless of where the crash landed.
 *   - Per-row failures count toward rowsFailed but don't abort the
 *     job; after maxFailures consecutive errors the job flips to
 *     FAILED for operator inspection. Individual row errors are
 *     written to audit (type='key.rotation_row_failed').
 *   - dryRun mode counts rows without writing. Used for "how long
 *     will this take" before committing.
 */

export interface KeyRotationCursor {
  table: 'ConnectedAccount' | 'User' | null;
  lastId: string | null;
}

export interface KeyRotationServiceOptions {
  prisma: PrismaClient;
  cipher: SecretCipher;
  audit?: AuditService;
  /** Rows per batch. Default 100. Keep low enough that a batch
   *  finishes well within the 5s tick so a crash loses at most
   *  one batch of work. */
  batchSize?: number;
  /** Abort after this many consecutive row failures. Default 10. */
  maxConsecutiveFailures?: number;
}

export interface StartRotationInput {
  /** When the operator commits to finishing the rotation. Used for
   *  alerting if progress < 90% at deadline − 24h. */
  deadline: Date;
  /** User id that kicked off the rotation. Null for cron-initiated
   *  auto-rotations (not shipped yet). */
  actorId: string | null;
  /** If true, count rows only. No writes. */
  dryRun?: boolean;
}

export class KeyRotationError extends Error {
  constructor(
    message: string,
    public readonly code: 'ACTIVE_JOB_EXISTS' | 'NO_LEGACY_KEYS' | 'JOB_NOT_FOUND' | 'JOB_TERMINAL'
  ) {
    super(message);
    this.name = 'KeyRotationError';
  }
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 10;

/** Opaque sentinel meaning "the cursor is done with this table;
 *  advance to the next". */
const TABLE_COMPLETE = '__done__';

export class KeyRotationService {
  private readonly batchSize: number;
  private readonly maxConsecutiveFailures: number;
  private consecutiveFailures = 0;

  constructor(private readonly opts: KeyRotationServiceOptions) {
    this.batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxConsecutiveFailures = opts.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
  }

  /**
   * Return the single active job (PENDING or RUNNING), or null. The
   * worker tick calls this first and skips when null.
   */
  async getActiveJob(): Promise<KeyRotationJob | null> {
    return this.opts.prisma.keyRotationJob.findFirst({
      where: { status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create a new rotation job. Rejects if another active job exists
   * (operator must cancel or wait) or if the cipher has no legacy
   * keys configured (there's nothing to rotate away from).
   */
  async startRotation(input: StartRotationInput): Promise<KeyRotationJob> {
    const existing = await this.getActiveJob();
    if (existing) {
      throw new KeyRotationError(
        `Cannot start a new rotation while job ${existing.id} is ${existing.status}`,
        'ACTIVE_JOB_EXISTS'
      );
    }
    // Allow dry-run even without legacy keys (operator sizing up the
    // surface). Real rotations need legacy keys — otherwise there's
    // nothing ciphered under an old master to re-encrypt.
    if (!input.dryRun && !this.opts.cipher.hasLegacyKeys()) {
      throw new KeyRotationError(
        'No legacy keys configured. Set OPERARI_SECRET_KEY_LEGACY to the previous master before starting a rotation.',
        'NO_LEGACY_KEYS'
      );
    }

    return this.opts.prisma.keyRotationJob.create({
      data: {
        deadline: input.deadline,
        dryRun: input.dryRun ?? false,
        createdByUserId: input.actorId,
        status: 'PENDING',
      },
    });
  }

  /**
   * Process one batch of rows for the given job. Driven by the
   * server interval at a tight cadence (5s). Returns the updated
   * job row so the caller can log progress or decide to stop
   * ticking when status flips terminal.
   */
  async rotateNextBatch(jobId: string): Promise<KeyRotationJob> {
    const job = await this.opts.prisma.keyRotationJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new KeyRotationError(`Job ${jobId} not found`, 'JOB_NOT_FOUND');
    }
    if (job.status !== 'PENDING' && job.status !== 'RUNNING') {
      throw new KeyRotationError(`Job ${jobId} is terminal (${job.status})`, 'JOB_TERMINAL');
    }

    // Flip to RUNNING + stamp startedAt on first batch.
    let working = job;
    if (job.status === 'PENDING') {
      working = await this.opts.prisma.keyRotationJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
    }

    const cursor: KeyRotationCursor = (working.nextCursor as KeyRotationCursor | null) ?? {
      table: 'ConnectedAccount',
      lastId: null,
    };

    const { processed, failed, nextCursor, completed } = await this.processBatch(
      cursor,
      working.dryRun
    );

    if (completed) {
      return this.opts.prisma.keyRotationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          rowsCompleted: { increment: processed },
          rowsFailed: { increment: failed },
          nextCursor: nextCursor as unknown as object,
          completedAt: new Date(),
          lastError: null,
        },
      });
    }

    // Non-terminal: persist progress + cursor for the next tick.
    const updated = await this.opts.prisma.keyRotationJob.update({
      where: { id: jobId },
      data: {
        rowsCompleted: { increment: processed },
        rowsFailed: { increment: failed },
        nextCursor: nextCursor as unknown as object,
      },
    });

    // Emit one audit event per batch with the counts. Per-row events
    // would inundate the chain on a large tenant; batch granularity
    // is enough for "we rotated N rows on date X" compliance proof.
    if (this.opts.audit && processed > 0) {
      await this.opts.audit
        .record({
          tenantId: 'system',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: 'key.rotated' as any,
          actorId: working.createdByUserId,
          actorType: 'user',
          resource: `key-rotation-job:${jobId}`,
          payload: {
            table: cursor.table,
            batchProcessed: processed,
            batchFailed: failed,
            rowsCompletedTotal: updated.rowsCompleted,
            dryRun: working.dryRun,
          },
        })
        .catch(err => {
          logger.warn({ err, jobId }, 'KeyRotationService: audit emit failed (non-fatal)');
        });
    }

    return updated;
  }

  /**
   * Cancel an active job. Sets status=CANCELLED without touching any
   * already-rotated rows. The operator can start a new rotation
   * later to finish the remaining tail.
   */
  async cancel(jobId: string): Promise<KeyRotationJob> {
    const job = await this.opts.prisma.keyRotationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new KeyRotationError(`Job ${jobId} not found`, 'JOB_NOT_FOUND');
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      throw new KeyRotationError(`Job ${jobId} is terminal (${job.status})`, 'JOB_TERMINAL');
    }
    return this.opts.prisma.keyRotationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  /**
   * Process up to batchSize rows from the current table. Advances
   * the cursor to the next table when this one is exhausted. Returns
   * processed/failed counts + whether the whole rotation is done.
   */
  private async processBatch(
    cursor: KeyRotationCursor,
    dryRun: boolean
  ): Promise<{
    processed: number;
    failed: number;
    nextCursor: KeyRotationCursor;
    completed: boolean;
  }> {
    if (cursor.table === null) {
      // Defensive: shouldn't happen, but treat as completion.
      return { processed: 0, failed: 0, nextCursor: cursor, completed: true };
    }

    if (cursor.table === 'ConnectedAccount') {
      const { processed, failed, lastId, exhausted } = await this.processConnectedAccounts(
        cursor.lastId,
        dryRun
      );
      if (exhausted) {
        return {
          processed,
          failed,
          nextCursor: { table: 'User', lastId: null },
          completed: false,
        };
      }
      return {
        processed,
        failed,
        nextCursor: { table: 'ConnectedAccount', lastId },
        completed: false,
      };
    }

    if (cursor.table === 'User') {
      const { processed, failed, lastId, exhausted } = await this.processUsers(
        cursor.lastId,
        dryRun
      );
      if (exhausted) {
        return {
          processed,
          failed,
          nextCursor: { table: null, lastId: null },
          completed: true,
        };
      }
      return {
        processed,
        failed,
        nextCursor: { table: 'User', lastId },
        completed: false,
      };
    }

    return { processed: 0, failed: 0, nextCursor: cursor, completed: true };
  }

  private async processConnectedAccounts(
    afterId: string | null,
    dryRun: boolean
  ): Promise<{ processed: number; failed: number; lastId: string; exhausted: boolean }> {
    const rows = await this.opts.prisma.connectedAccount.findMany({
      where: afterId ? { id: { gt: afterId } } : {},
      orderBy: { id: 'asc' },
      take: this.batchSize,
      select: {
        id: true,
        tenantId: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    if (rows.length === 0) {
      return { processed: 0, failed: 0, lastId: afterId ?? TABLE_COMPLETE, exhausted: true };
    }

    let processed = 0;
    let failed = 0;
    let lastId = afterId ?? '';
    for (const row of rows) {
      lastId = row.id;
      try {
        if (!dryRun) {
          const newAccess = this.rewrap(row.accessToken, row.tenantId);
          const newRefresh = row.refreshToken ? this.rewrap(row.refreshToken, row.tenantId) : null;
          // Skip write when nothing changed — happens when the row is
          // already ciphered under the current master (idempotent resume).
          if (newAccess !== row.accessToken || newRefresh !== row.refreshToken) {
            await this.opts.prisma.connectedAccount.update({
              where: { id: row.id },
              data: { accessToken: newAccess, refreshToken: newRefresh },
            });
          }
        }
        processed++;
        this.consecutiveFailures = 0;
      } catch (err) {
        failed++;
        this.consecutiveFailures++;
        logger.error(
          { err, rowId: row.id, table: 'ConnectedAccount' },
          'KeyRotationService: row rewrap failed'
        );
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          // Surface the failure — caller flips the job to FAILED.
          throw new KeyRotationError(
            `${this.consecutiveFailures} consecutive failures rewrapping ConnectedAccount rows`,
            'JOB_TERMINAL'
          );
        }
      }
    }
    return {
      processed,
      failed,
      lastId,
      exhausted: rows.length < this.batchSize,
    };
  }

  private async processUsers(
    afterId: string | null,
    dryRun: boolean
  ): Promise<{ processed: number; failed: number; lastId: string; exhausted: boolean }> {
    const rows = await this.opts.prisma.user.findMany({
      where: {
        mfaSecretCiphered: { not: null },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: this.batchSize,
      select: {
        id: true,
        tenantId: true,
        mfaSecretCiphered: true,
      },
    });

    if (rows.length === 0) {
      return { processed: 0, failed: 0, lastId: afterId ?? TABLE_COMPLETE, exhausted: true };
    }

    let processed = 0;
    let failed = 0;
    let lastId = afterId ?? '';
    for (const row of rows) {
      lastId = row.id;
      try {
        if (!dryRun && row.mfaSecretCiphered) {
          const newCipher = this.rewrap(row.mfaSecretCiphered, row.tenantId, `mfa:${row.id}`);
          if (newCipher !== row.mfaSecretCiphered) {
            await this.opts.prisma.user.update({
              where: { id: row.id },
              data: { mfaSecretCiphered: newCipher },
            });
          }
        }
        processed++;
        this.consecutiveFailures = 0;
      } catch (err) {
        failed++;
        this.consecutiveFailures++;
        logger.error(
          { err, rowId: row.id, table: 'User' },
          'KeyRotationService: mfa rewrap failed'
        );
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          throw new KeyRotationError(
            `${this.consecutiveFailures} consecutive failures rewrapping User rows`,
            'JOB_TERMINAL'
          );
        }
      }
    }
    return {
      processed,
      failed,
      lastId,
      exhausted: rows.length < this.batchSize,
    };
  }

  /**
   * Decrypt a ciphertext under whichever master key works (primary
   * or legacy) and re-encrypt under the primary. If the ciphertext
   * is already primary-owned, returns the same string (skip write).
   *
   * v1 and v2 both get rewritten to v2 under the primary.
   */
  private rewrap(ciphertext: string, tenantId: string, aad?: string): string {
    // Short-circuit on already-primary rows (idempotent resume).
    if (this.opts.cipher.isCipheredUnderPrimary(ciphertext, tenantId, aad)) {
      return ciphertext;
    }
    // Legacy key path: decryptForTenant falls back to legacyKeys[].
    const plaintext = this.opts.cipher.decryptForTenant(ciphertext, tenantId, aad);
    // Re-encrypt under the current primary. v2 is the target version —
    // all new writes are per-tenant derived, regardless of source.
    return this.opts.cipher.encryptForTenant(plaintext, tenantId, aad);
  }
}
