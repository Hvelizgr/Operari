-- Per-runbook concurrency cap (trigger.dev queue.concurrencyLimit
-- parity). The trigger entry points consult this before starting a
-- new RUNNING execution and refuse with 429 / CONCURRENCY_LIMIT
-- when the current in-flight count (status IN ('RUNNING','PAUSED'))
-- meets or exceeds the cap.
--
-- Null = unlimited (the historical behaviour). Migration is
-- additive — no backfill, no behaviour change for existing rows.
--
-- The COUNT(*) at trigger time uses the existing
-- (tenantId, status, startedAt DESC) composite index — fast even
-- with thousands of historical rows because terminated runs sit
-- outside the index range we scan.

ALTER TABLE "Runbook"
  ADD COLUMN "concurrencyLimit" INTEGER;
