import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../config/logger.config';

/**
 * Webhook event deduplication helper.
 *
 * Every inbound webhook handler calls recordWebhookEvent() BEFORE it
 * mutates state. If the row already exists (P2002 unique_violation on
 * WebhookEvent.(source, eventId)), we return { duplicate: true } and
 * the handler short-circuits with a 200 OK — the provider already got
 * its ack on the first delivery, the retry is idempotent.
 *
 * First-writer-wins via the UNIQUE constraint. We do NOT do
 * "findFirst + create" because that race-conditions under concurrent
 * deliveries (Stripe can fan out retries in parallel; two workers can
 * race on the same event.id). The INSERT-and-catch-duplicate pattern
 * is the only lock-free, correct approach.
 *
 * Callers must pass a stable `eventId` that the provider itself
 * generates and will resend unchanged on retry — Stripe's evt_...,
 * GitHub's X-GitHub-Delivery, Datadog's event id. Fabricating one on
 * the server defeats the purpose: you'd dedup "the second copy of a
 * request we accepted" instead of "the second copy of the provider's
 * event".
 */

export interface RecordWebhookEventInput {
  source: string;
  eventId: string;
  tenantId?: string | null;
}

export interface RecordWebhookEventResult {
  duplicate: boolean;
}

const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Reject a webhook if its declared timestamp sits outside an
 * acceptance window. Defends against an attacker re-POSTing a
 * previously-signed payload indefinitely — the HMAC stays valid but
 * the stale timestamp gives it away.
 *
 * Returns `null` if the header is acceptable (either within tolerance
 * or — deliberately — absent, so providers that do not send one still
 * work). Returns a human-readable reason when the request should be
 * rejected.
 *
 * Unix seconds is the de-facto convention (Stripe's signed `t=...`,
 * GitHub's `X-Hub-Timestamp` proposal, generic self-serve senders).
 * We accept an optional millisecond override for sources that insist
 * on ms — none exist today but the surface is cheap to keep.
 */
export interface TimestampCheckInput {
  header: string | undefined;
  /** Window tolerance in seconds. Defaults to 300 (five minutes). */
  toleranceSeconds?: number;
  /** If the header encodes milliseconds instead of seconds. */
  millis?: boolean;
  /** Overridable reference time (tests). */
  now?: () => number;
}

export function verifyWebhookTimestamp(input: TimestampCheckInput): null | string {
  const { header } = input;
  if (header === undefined || header === null || header === '') {
    // No header present — caller may choose to require it (by
    // checking `header` themselves); this function treats absence
    // as "not applicable" so providers without timestamp headers
    // are not broken.
    return null;
  }
  const tolerance = Math.max(1, input.toleranceSeconds ?? 300);
  const nowSec = Math.floor((input.now ? input.now() : Date.now()) / 1000);

  const parsed = Number.parseInt(header.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 'timestamp_unparseable';
  }
  const headerSec = input.millis ? Math.floor(parsed / 1000) : parsed;
  const drift = Math.abs(nowSec - headerSec);
  if (drift > tolerance) {
    return `timestamp_drift=${drift}s>tolerance=${tolerance}s`;
  }
  return null;
}

export async function recordWebhookEvent(
  prisma: PrismaClient,
  input: RecordWebhookEventInput
): Promise<RecordWebhookEventResult> {
  try {
    await prisma.webhookEvent.create({
      data: {
        source: input.source,
        eventId: input.eventId,
        tenantId: input.tenantId ?? null,
      },
    });
    return { duplicate: false };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === PRISMA_UNIQUE_VIOLATION
    ) {
      logger.info(
        { source: input.source, eventId: input.eventId },
        'webhook.dedup: duplicate event skipped'
      );
      return { duplicate: true };
    }
    // Any other error — DB down, connection reset — re-throw so the
    // route handler returns 5xx and the provider retries. Failing
    // closed is safer than silently processing the event twice later.
    throw err;
  }
}
