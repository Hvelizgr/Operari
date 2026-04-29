import { Prisma, PrismaClient } from '@prisma/client';

import { NULL_METRICS, type RunMetrics } from '../../observability/metrics';

/**
 * Retention cap. Keep 50 receipts per webhook — enough to debug a
 * misbehaving sender (the "I sent it 20 times and it didn't work"
 * scenario) without letting a runaway source grow the table
 * unbounded. Enforced on every insert; the delete is scoped to the
 * webhook so we don't accidentally touch neighbors.
 */
const RETENTION_PER_WEBHOOK = 50;

/**
 * Headers we strip before persistence. These either leak secrets
 * (Authorization, Cookie) or are pure transport noise (connection,
 * transfer-encoding) that adds no debug value.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
]);

export type ReceiptStatus = 'accepted' | 'rejected_inactive' | 'rejected_signature' | 'error';

export interface RecordReceiptParams {
  webhookId: string;
  tenantId: string;
  status: ReceiptStatus;
  statusCode: number;
  reason?: string;
  headers: Record<string, unknown>;
  body: unknown;
  sourceIp?: string | null;
  executionId?: string | null;
  /**
   * When set on a status='error' receipt, WebhookRetryWorker will
   * pick the row up at this time and call execute() again. Leave
   * undefined (the default) for receipts that should never retry —
   * rejected_signature, rejected_inactive, or accepted.
   */
  nextRetryAt?: Date | null;
  /**
   * Trigger source — sentry / datadog / github / custom. Threaded
   * through so the Prometheus counter operari_webhook_received_total
   * can be labelled by source without forcing the receipt row schema
   * to learn about it.
   */
  source?: string;
}

/**
 * Persists one webhook call and trims the per-webhook history back
 * to the retention cap. Fail-safe: every error is swallowed so a
 * storage glitch never takes down the webhook receiver — the
 * receipt is pure observability, losing one is a lower cost than
 * dropping the trigger.
 */
export class WebhookReceiptService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly metrics: RunMetrics = NULL_METRICS
  ) {}

  async record(params: RecordReceiptParams): Promise<string | null> {
    try {
      const created = await this.prisma.webhookReceipt.create({
        data: {
          webhookId: params.webhookId,
          tenantId: params.tenantId,
          status: params.status,
          statusCode: params.statusCode,
          reason: params.reason ?? null,
          headers: scrubHeaders(params.headers) as Prisma.InputJsonValue,
          body: normalizeBody(params.body) as Prisma.InputJsonValue,
          sourceIp: params.sourceIp ?? null,
          executionId: params.executionId ?? null,
          nextRetryAt: params.nextRetryAt ?? null,
        },
        select: { id: true },
      });
      // Emit the metric AFTER the row commits so a DB failure does
      // not skew the counter higher than the persisted truth. The
      // source falls back to 'unknown' for the rare "webhook
      // findByToken returned the record but the route already lost
      // the source field" edge case.
      this.metrics.recordWebhookReceived({
        tenantId: params.tenantId,
        source: params.source ?? 'unknown',
        status: params.status,
      });
      void this.trim(params.webhookId);
      return created.id;
    } catch {
      return null;
    }
  }

  /**
   * Drop any receipt past the RETENTION_PER_WEBHOOK cap for this
   * webhook. Uses a subquery via findMany + deleteMany because
   * Postgres doesn't support ORDER BY + LIMIT inside DELETE
   * directly through Prisma.
   */
  private async trim(webhookId: string): Promise<void> {
    try {
      const keep = await this.prisma.webhookReceipt.findMany({
        where: { webhookId },
        orderBy: { receivedAt: 'desc' },
        take: RETENTION_PER_WEBHOOK,
        select: { id: true },
      });
      if (keep.length < RETENTION_PER_WEBHOOK) return;
      await this.prisma.webhookReceipt.deleteMany({
        where: {
          webhookId,
          id: { notIn: keep.map(r => r.id) },
        },
      });
    } catch {
      // Best-effort. Next write retries the trim.
    }
  }
}

/**
 * Strip sensitive transport headers and coerce the remaining
 * entries into a plain JSON-compatible shape. Express stores some
 * headers as arrays (e.g. X-Forwarded-For); we keep them as-is.
 */
function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (SENSITIVE_HEADERS.has(key)) {
      out[key] = '<redacted>';
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Normalize the request body so the receipt is always a valid
 * JSON value. Non-JSON payloads (rare but possible when a sender
 * posts application/x-www-form-urlencoded or a raw string) are
 * wrapped so the column stays JSON-typed.
 */
function normalizeBody(body: unknown): unknown {
  if (body == null) return {};
  if (typeof body === 'string') return { _raw: body };
  if (typeof body === 'object') return body;
  return { _value: body };
}

export { RETENTION_PER_WEBHOOK };
