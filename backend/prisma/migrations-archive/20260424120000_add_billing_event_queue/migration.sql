-- Billing event queue.
--
-- Before this migration, ExecutionService.recordRunStart / .recordRunEnd
-- called StripeBillingMeter.record() fire-and-forget. A Stripe outage
-- or network blip silently lost the meter event and the customer got
-- under-billed. The run itself was committed to Postgres but the
-- billable fact never reached Stripe.
--
-- After: the runtime writes a BillingEvent row synchronously, and a
-- separate worker ships the row to Stripe asynchronously with retry +
-- exponential backoff. A Stripe outage lengthens nextAttemptAt on the
-- row; nothing is lost.
--
-- idempotencyKey is UNIQUE so a re-submit from the runtime (say,
-- run.completed fired twice by a retry) collapses to one row, and a
-- re-ship from the worker (already-sent event) collapses on Stripe's
-- side via the same key. Two layers of dedup against double-billing.

CREATE TABLE "BillingEvent" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT,
    "type"            TEXT NOT NULL,
    "customerId"      TEXT,
    "value"           DOUBLE PRECISION NOT NULL,
    "idempotencyKey"  TEXT NOT NULL,
    "metadata"        JSONB,
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "attempts"        INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"          TIMESTAMP(3),

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- Runtime-side dedup: the same (type, runId, stepId) always produces
-- the same idempotencyKey. Two records() with matching keys collapse
-- to ONE row via P2002 unique_violation.
CREATE UNIQUE INDEX "BillingEvent_idempotencyKey_key"
    ON "BillingEvent" ("idempotencyKey");

-- Dispatch worker's hot path: SELECT WHERE status='PENDING' AND
-- nextAttemptAt <= NOW() ORDER BY nextAttemptAt. Composite index
-- lets Postgres pick a tight range without a full-table scan.
CREATE INDEX "BillingEvent_status_nextAttemptAt_idx"
    ON "BillingEvent" ("status", "nextAttemptAt");

-- Per-tenant audit views ("what did we bill for tenant X last month?").
CREATE INDEX "BillingEvent_tenantId_createdAt_idx"
    ON "BillingEvent" ("tenantId", "createdAt");

-- Cascade on tenant delete so GDPR erasure doesn't leave orphan
-- billing rows around. The worker's SELECT WHERE status='PENDING' will
-- simply no longer see them.
ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
