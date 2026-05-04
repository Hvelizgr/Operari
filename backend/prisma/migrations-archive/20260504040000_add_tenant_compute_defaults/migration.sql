-- Workspace-wide compute defaults (trigger.dev parity for the
-- "set sane workspace defaults so triggers don't have to spell out
-- machine/ttl/retries every time" use case).
--
-- JSONB instead of separate columns because:
--   1. The schema will grow (queue concurrency, default tags, default
--      idempotency policy) and we don't want a migration per knob.
--   2. The service layer parses it through a zod schema on every
--      read; storing the raw shape keeps the contract explicit.
--
-- Null = use the engine fallbacks (small-1x machine, no TTL, 0
-- retries, dry-run off). Migration is additive — no backfill.

ALTER TABLE "Tenant"
  ADD COLUMN "computeDefaults" JSONB;
