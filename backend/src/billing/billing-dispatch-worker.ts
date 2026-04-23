import type { BillingEvent, PrismaClient } from '@prisma/client';

import { logger } from '../config/logger.config';
import type { BillableEventType, BillingMeter } from './billing-meter.types';

/**
 * BillingDispatchWorker — background shipper for the BillingEvent
 * outbox.
 *
 * Lifecycle: a server.ts interval ticks `runOnce()` on a short
 * cadence (15s default). Each tick pulls a page of PENDING rows whose
 * `nextAttemptAt` has arrived, forwards them to the underlying
 * BillingMeter (typically Stripe), and updates the row:
 *
 *   SUCCESS → status='SENT', sentAt=now
 *   FAILURE → attempts++, nextAttemptAt = now + backoff(attempts),
 *             lastError stored. After MAX_ATTEMPTS the row is flipped
 *             to 'FAILED' (terminal, requires operator).
 *
 * The worker is deliberately simple:
 *   - No distributed lock. Two pods dispatching the same row both
 *     send it to Stripe, but Stripe's idempotencyKey collapses the
 *     duplicate. Worst case: one of the two writes an UPDATE the
 *     other overwrites; since both arrive at status='SENT' the end
 *     state is consistent.
 *   - No in-memory queue. A restart loses no work — every PENDING
 *     row is still on disk and the next tick picks them up.
 *   - No retry budget across restarts. Attempts are on the row; a
 *     row with attempts=2 at crash time still has 4 tries left.
 */

export interface BillingDispatchWorkerOptions {
  prisma: PrismaClient;
  /** The provider that actually ships to Stripe / Orb / noop. */
  meter: BillingMeter;
  /** Rows per tick. Keep tight so a Stripe outage doesn't stall the
   *  backlog behind one slow fetch. Default 50. */
  batchSize?: number;
  /** Cap on per-row retry attempts before giving up (FAILED status).
   *  Default 6 ≈ 2^6 * 30s = 32 min of retry runway. */
  maxAttempts?: number;
  /** Base delay in ms; each failure doubles the delay up to a cap.
   *  Default 30s base, 2h cap. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Test hook — overrides Date.now() so retry scheduling is
   *  deterministic. */
  now?: () => Date;
}

export interface BillingDispatchReport {
  scanned: number;
  sent: number;
  retried: number;
  failed: number;
  durationMs: number;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_BASE_DELAY_MS = 30_000;
const DEFAULT_MAX_DELAY_MS = 2 * 60 * 60 * 1000;

const VALID_TYPES = new Set<BillableEventType>([
  'run.started',
  'run.completed',
  'runner.minute',
  'storage.gb_hour',
]);

export class BillingDispatchWorker {
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly now: () => Date;

  constructor(private readonly opts: BillingDispatchWorkerOptions) {
    this.batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.now = opts.now ?? (() => new Date());
  }

  async runOnce(): Promise<BillingDispatchReport> {
    const startedAt = Date.now();
    const nowDate = this.now();
    const report: BillingDispatchReport = {
      scanned: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      durationMs: 0,
    };

    const pending = await this.opts.prisma.billingEvent.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: nowDate },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: this.batchSize,
    });

    for (const row of pending) {
      report.scanned++;
      await this.dispatchRow(row, report);
    }

    report.durationMs = Date.now() - startedAt;
    return report;
  }

  private async dispatchRow(row: BillingEvent, report: BillingDispatchReport): Promise<void> {
    if (!VALID_TYPES.has(row.type as BillableEventType)) {
      // Unknown type. Mark as FAILED so the worker stops scanning it;
      // an operator can decide what to do. This usually means the
      // runtime wrote an event type the deploy doesn't understand —
      // a forward-compat mismatch after a bad rollback.
      await this.markFailed(row, `unknown event type: ${row.type}`);
      report.failed++;
      return;
    }

    let delivered = false;
    let errorMessage: string | undefined;
    try {
      delivered = await this.opts.meter.record({
        type: row.type as BillableEventType,
        customerId: row.customerId ?? undefined,
        value: row.value,
        idempotencyKey: row.idempotencyKey,
        metadata: coerceMetadata(row.metadata),
      });
    } catch (err) {
      // The BillingMeter contract says record() shouldn't throw, but
      // the Stripe HTTP client has been known to leak network errors
      // through. Treat as a failed attempt.
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    if (delivered) {
      await this.opts.prisma.billingEvent.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: this.now(), lastError: null },
      });
      report.sent++;
      return;
    }

    // record() returned false → no-op delivery (missing customerId /
    // provider config). Treat as terminal so the row stops churning.
    // If the operator fixes the customer mapping, they'll re-trigger
    // the runtime write with a fresh idempotencyKey.
    if (!errorMessage) {
      await this.opts.prisma.billingEvent.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          attempts: row.attempts + 1,
          lastError: 'meter returned false (missing customer id or provider config)',
        },
      });
      report.failed++;
      return;
    }

    // Genuine failure → retry with backoff, or give up after max.
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= this.maxAttempts) {
      await this.markFailed(
        row,
        `gave up after ${nextAttempts} attempts; last error: ${errorMessage}`
      );
      report.failed++;
      logger.error(
        { rowId: row.id, attempts: nextAttempts, lastError: errorMessage },
        'BillingDispatchWorker: exhausted retries'
      );
      return;
    }

    const backoff = this.computeBackoff(nextAttempts);
    await this.opts.prisma.billingEvent.update({
      where: { id: row.id },
      data: {
        status: 'PENDING',
        attempts: nextAttempts,
        nextAttemptAt: new Date(this.now().getTime() + backoff),
        lastError: errorMessage,
      },
    });
    report.retried++;
  }

  private computeBackoff(attempt: number): number {
    // 2^(attempt-1) * base, capped. attempt=1 → base; attempt=2 → 2*base; etc.
    const raw = Math.pow(2, attempt - 1) * this.baseDelayMs;
    return Math.min(raw, this.maxDelayMs);
  }

  private async markFailed(row: BillingEvent, reason: string): Promise<void> {
    await this.opts.prisma.billingEvent.update({
      where: { id: row.id },
      data: {
        status: 'FAILED',
        attempts: row.attempts + 1,
        lastError: reason,
      },
    });
  }
}

function coerceMetadata(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
