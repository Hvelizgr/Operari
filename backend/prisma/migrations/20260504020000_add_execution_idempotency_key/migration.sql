-- Idempotency keys (trigger.dev parity).
--
-- A trigger that includes an idempotencyKey is "the same call" as
-- any earlier trigger with the same key on the same runbook within
-- the dedup window. Repeating a webhook from a flaky upstream, or
-- replaying the same SDK call after a network blip, no longer
-- spawns a duplicate Execution — the original row is returned.
--
-- Scope: (tenantId, runbookId, idempotencyKey). Multiple tenants
-- can pick the same key independently; same tenant calling the
-- same runbook with the same key dedupes.
--
-- The unique index is partial over `idempotencyKey IS NOT NULL` so
-- legacy rows (no key) do not collide. Existing rows untouched.

ALTER TABLE "Execution" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Execution_tenant_runbook_idempotency_key"
  ON "Execution" ("tenantId", "runbookId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
