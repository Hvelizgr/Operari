-- Run TTL (trigger.dev parity).
--
-- The trigger that created this Execution attached a TTL: if the
-- engine has not picked the run up by `expiresAt`, the run is
-- abandoned (status = FAILED with code TTL_EXCEEDED) instead of
-- running with stale input. Useful for webhooks where the work is
-- "do this only if it's still relevant in 30 seconds".
--
-- Stored as a DateTime (absolute target) rather than a duration so
-- the engine can decide expiry by a single comparison without
-- having to recompute "started + ttlSeconds" each time it
-- dequeues. Null means "no TTL — run whenever it surfaces", which
-- is the default for all existing rows.

ALTER TABLE "Execution" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Partial index on still-pending runs with a TTL set: the engine's
-- watchdog scans for `expiresAt < now() AND status = 'PENDING'`
-- once per minute, so the index covers exactly that hot path while
-- staying compact (terminated runs and TTL-less runs are excluded).
CREATE INDEX "Execution_expiresAt_pending_idx"
  ON "Execution" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL AND "status" = 'PENDING';
