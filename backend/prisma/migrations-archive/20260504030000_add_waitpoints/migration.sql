-- Waitpoint tokens (trigger.dev parity).
--
-- A step inside a run creates a Waitpoint with a timeout + tags;
-- the run pauses until something external completes the token
-- (or the timeout fires). Decouples "I need to pause" from the
-- specific protocol that resumes — the same token can be
-- completed by a Slack callback, a webhook, an SDK call, or a
-- separate runbook.
--
-- A token's `id` doubles as its public address (the URL that
-- completes it is /api/waitpoints/<id>/complete). We don't expose
-- the executionId publicly — only the holder of the token id
-- knows which run resumes when they complete it, and the route
-- guard re-derives the tenant from the token row.

CREATE TYPE "WaitpointStatus" AS ENUM ('PENDING', 'COMPLETED', 'TIMED_OUT', 'CANCELLED');

CREATE TABLE "Waitpoint" (
  "id"             TEXT PRIMARY KEY,
  "tenantId"       TEXT NOT NULL,
  "executionId"    TEXT,
  "status"         "WaitpointStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt"      TIMESTAMP(3),
  "tags"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "completedValue" JSONB,
  "completedBy"    TEXT,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Waitpoint_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "Waitpoint_execution_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE SET NULL
);

-- Hot path: the watchdog scans for tokens with `expiresAt < now()
-- AND status = 'PENDING'` once per minute. Partial index keeps the
-- scan compact (terminated tokens and tokens without an expiry
-- never contribute pages).
CREATE INDEX "Waitpoint_expiresAt_pending_idx"
  ON "Waitpoint" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL AND "status" = 'PENDING';

-- Tag lookup via GIN — same shape as Execution.tags so the runs
-- list and the waitpoints list use one filter dialect.
CREATE INDEX "Waitpoint_tags_idx" ON "Waitpoint" USING GIN ("tags");

-- Multi-tenancy: every list endpoint is `where tenantId = X`.
CREATE INDEX "Waitpoint_tenant_status_idx" ON "Waitpoint" ("tenantId", "status");
