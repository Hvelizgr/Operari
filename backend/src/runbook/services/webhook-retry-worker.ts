import type { PrismaClient, WebhookReceipt } from '@prisma/client';

import { logger } from '../../config/logger.config';
import type { ExecutionService } from '../../editor/execution/execution.service';
import type { WebhookService } from './webhook.service';

/**
 * WebhookRetryWorker — retries inbound webhook deliveries whose
 * `execute()` call failed on the live path.
 *
 * Context: the live webhook route still returns 500 on engine failure
 * so the sender's own retry (GitHub/Stripe) stays live. This worker
 * is the LOCAL safety net for when the sender gave up first — a
 * typical sender retries 3–5 times in ~30 min; outages longer than
 * that would lose the delivery entirely before this PR.
 *
 * Shape mirrors BillingDispatchWorker from A5:
 *   - poll status='error' rows whose nextRetryAt is due
 *   - re-run execute() with the stored body
 *   - SUCCESS → flip status to 'replayed_success'
 *   - FAILURE → attempts++, reschedule nextRetryAt with exponential
 *               backoff. After maxAttempts → 'error_exhausted'
 *               (terminal, operator-only).
 *
 * Dedup safety: A4's WebhookEvent UNIQUE index on (source, eventId)
 * means a local retry that overlaps a sender retry collapses on the
 * first one that lands — the other returns duplicate:true and skips
 * the engine call.
 */

export interface WebhookRetryWorkerOptions {
  prisma: PrismaClient;
  webhookService: WebhookService;
  executionService: ExecutionService;
  /** Rows per tick. Default 20 — webhooks are lower-volume than the
   *  billing outbox. */
  batchSize?: number;
  /** Cap on retries before flipping to error_exhausted. Default 3
   *  matches the typical sender's retry budget. */
  maxAttempts?: number;
  /** Base delay ms for backoff. Default 60s. */
  baseDelayMs?: number;
  /** Cap for backoff. Default 30min — beyond that the sender will
   *  have timed out anyway; no value in waiting longer. */
  maxDelayMs?: number;
  /** Test hook. */
  now?: () => Date;
}

export interface WebhookRetryReport {
  scanned: number;
  replayed: number;
  retried: number;
  exhausted: number;
  durationMs: number;
}

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 60_000;
const DEFAULT_MAX_DELAY_MS = 30 * 60_000;

export class WebhookRetryWorker {
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly now: () => Date;

  constructor(private readonly opts: WebhookRetryWorkerOptions) {
    this.batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.now = opts.now ?? (() => new Date());
  }

  async runOnce(): Promise<WebhookRetryReport> {
    const startedAt = Date.now();
    const nowDate = this.now();
    const report: WebhookRetryReport = {
      scanned: 0,
      replayed: 0,
      retried: 0,
      exhausted: 0,
      durationMs: 0,
    };

    const pending = await this.opts.prisma.webhookReceipt.findMany({
      where: {
        status: 'error',
        nextRetryAt: { lte: nowDate, not: null },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: this.batchSize,
      include: { webhook: { include: { runbook: { select: { userId: true } } } } },
    });

    for (const row of pending) {
      report.scanned++;
      await this.retryRow(row, report);
    }

    report.durationMs = Date.now() - startedAt;
    return report;
  }

  private async retryRow(
    row: WebhookReceipt & {
      webhook: {
        id: string;
        runbookId: string;
        tenantId: string;
        source: string;
        runbook: { userId: string };
      };
    },
    report: WebhookRetryReport
  ): Promise<void> {
    const variables = this.opts.webhookService.mapPayloadToVariables(
      row.webhook.source,
      undefined,
      (row.body as Record<string, unknown>) ?? {}
    );

    try {
      const execution = await this.opts.executionService.execute({
        runbookId: row.webhook.runbookId,
        userId: row.webhook.runbook.userId,
        trigger: 'WEBHOOK',
        input: variables,
        tenantId: row.webhook.tenantId,
      });

      await this.opts.prisma.webhookReceipt.update({
        where: { id: row.id },
        data: {
          status: 'replayed_success',
          statusCode: 202,
          retryAttempts: row.retryAttempts + 1,
          nextRetryAt: null,
          executionId: execution.id,
          reason: `retried_after_${row.retryAttempts + 1}_attempts`,
        },
      });
      report.replayed++;
      return;
    } catch (err) {
      const nextAttempts = row.retryAttempts + 1;
      const message = err instanceof Error ? err.message : String(err);

      if (nextAttempts >= this.maxAttempts) {
        await this.opts.prisma.webhookReceipt.update({
          where: { id: row.id },
          data: {
            status: 'error_exhausted',
            retryAttempts: nextAttempts,
            nextRetryAt: null,
            reason: `exhausted_after_${nextAttempts}_attempts: ${message.slice(0, 200)}`,
          },
        });
        report.exhausted++;
        logger.error(
          { receiptId: row.id, webhookId: row.webhookId, attempts: nextAttempts, error: message },
          'WebhookRetryWorker: exhausted retries'
        );
        return;
      }

      const backoff = this.computeBackoff(nextAttempts);
      await this.opts.prisma.webhookReceipt.update({
        where: { id: row.id },
        data: {
          retryAttempts: nextAttempts,
          nextRetryAt: new Date(this.now().getTime() + backoff),
          reason: `retry_${nextAttempts}_failed: ${message.slice(0, 200)}`,
        },
      });
      report.retried++;
    }
  }

  private computeBackoff(attempt: number): number {
    const raw = Math.pow(2, attempt - 1) * this.baseDelayMs;
    return Math.min(raw, this.maxDelayMs);
  }
}
