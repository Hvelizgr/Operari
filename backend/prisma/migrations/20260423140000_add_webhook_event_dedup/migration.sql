-- Webhook event deduplication table.
--
-- Stripe (and every other well-behaved webhook source) retries failed
-- deliveries. Before this table, a replayed checkout.session.completed
-- flipped Tenant.planStatus twice — same event applied twice. The
-- runbook webhook surface had the same class of bug: an attacker who
-- intercepted a signed payload could re-POST it indefinitely.
--
-- Contract: (source, eventId) UNIQUE. Handlers try INSERT first; if
-- Postgres throws 23505 (unique_violation) we know the event was
-- already processed and skip the handler. tenantId is optional — most
-- provider events are tenant-agnostic at the wire level and we derive
-- the tenant from the payload. Keep the column for future per-tenant
-- dedup policies and for cascade-on-tenant-delete.

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tenantId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- The dedup contract. (source, eventId) is the natural identity of a
-- webhook delivery — Stripe's evt_..., GitHub's X-GitHub-Delivery,
-- Datadog's id, etc. — so the unique index is what actually enforces
-- exactly-once handling.
CREATE UNIQUE INDEX "WebhookEvent_source_eventId_key"
    ON "WebhookEvent" ("source", "eventId");

-- Retention sweeps and "recent deliveries" debug views scan by time.
CREATE INDEX "WebhookEvent_receivedAt_idx"
    ON "WebhookEvent" ("receivedAt");

-- Per-tenant lookups when tenantId is set (cascades on delete).
ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT "WebhookEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WebhookEvent_tenantId_receivedAt_idx"
    ON "WebhookEvent" ("tenantId", "receivedAt");
