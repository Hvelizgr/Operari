import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../config/logger.config';
import type { BillableEvent, BillingMeter } from './billing-meter.types';

/**
 * QueuedBillingMeter — durable outbox in front of the real meter.
 *
 * Replaces the previous fire-and-forget StripeBillingMeter at the
 * ExecutionService call site. Every `record()` writes a row into
 * `BillingEvent` synchronously (a single Postgres INSERT, no HTTP)
 * and returns. A separate `BillingDispatchWorker` picks PENDING rows
 * up asynchronously and ships them to Stripe.
 *
 * Why this exists: the old code called `fetch(stripe)` inline from
 * the runtime, caught any error with `return false`, and moved on. A
 * Stripe outage (or even a network blip) silently dropped the meter
 * event — the run was committed to Postgres but the billable fact
 * never reached Stripe, so the customer got under-billed.
 *
 * Dedup contract: `idempotencyKey` is UNIQUE on the table. A runtime
 * retry that fires `record()` twice with the same key collapses to
 * one row (P2002 -> treated as success). The same key rides through
 * to Stripe, so a worker re-ship of an already-sent row also
 * collapses server-side.
 *
 * Events without an idempotencyKey are rejected (returns false). The
 * outbox only makes sense when each event has a stable identity —
 * without one the worker can't tell "this is the first attempt" from
 * "this is a retry of a previous attempt".
 */

const PRISMA_UNIQUE_VIOLATION = 'P2002';

export interface QueuedBillingMeterOptions {
  prisma: PrismaClient;
}

export class QueuedBillingMeter implements BillingMeter {
  readonly name = 'queued';

  constructor(private readonly opts: QueuedBillingMeterOptions) {}

  async record(event: BillableEvent): Promise<boolean> {
    if (!event.idempotencyKey) {
      // A queued meter without idempotency cannot dedup retries, which
      // defeats the whole point of the outbox. Fail closed — the
      // caller is supposed to supply `${type}:${runId}:${stepId?}`.
      logger.warn(
        { eventType: event.type, customerId: event.customerId },
        'QueuedBillingMeter: record() skipped — no idempotencyKey'
      );
      return false;
    }

    try {
      await this.opts.prisma.billingEvent.create({
        data: {
          tenantId: extractTenantId(event.metadata),
          type: event.type,
          customerId: event.customerId ?? null,
          value: event.value,
          idempotencyKey: event.idempotencyKey,
          metadata: (event.metadata ?? {}) as unknown as Prisma.InputJsonValue,
          // status + attempts + nextAttemptAt default on the DB side.
        },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === PRISMA_UNIQUE_VIOLATION
      ) {
        // Idempotent re-submit. The existing row already holds the
        // event; a worker will ship it (or has already).
        logger.info(
          { idempotencyKey: event.idempotencyKey, eventType: event.type },
          'QueuedBillingMeter: duplicate idempotencyKey — collapsed to existing row'
        );
        return true;
      }
      // Anything else — DB down, permission error — is a real failure.
      // We keep the meter contract of "best-effort, never throw" by
      // swallowing and logging loudly so ops sees it. The run itself
      // is NOT held up.
      logger.error({ err, eventType: event.type }, 'QueuedBillingMeter: enqueue failed');
      return false;
    }
  }
}

/**
 * Metadata is typed as Record<string, string> at the BillableEvent
 * level. The runtime sets `metadata.tenantId` when it records — we
 * extract it so the BillingEvent row can tie back to Tenant for
 * cascade-on-delete. Any string-ish value here is legal; callers that
 * don't set it get a null tenantId column.
 */
function extractTenantId(metadata: Record<string, string> | undefined): string | null {
  if (!metadata) return null;
  const raw = metadata.tenantId;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return raw;
}
