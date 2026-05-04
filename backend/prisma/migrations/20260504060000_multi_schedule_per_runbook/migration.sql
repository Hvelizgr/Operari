-- Multi-schedule per runbook (trigger.dev schedules-in-code parity).
--
-- Drops the @unique on runbookId so a runbook can have N independent
-- schedules. Each row may carry an optional name + per-schedule
-- typed inputs that get merged into the run's variables at fire
-- time — same runbook can fire on different cadences with different
-- params (e.g. environment: 'staging' hourly, environment:
-- 'production' daily).
--
-- The new (non-unique) index on runbookId keeps the scheduler's
-- per-runbook lookups cheap. The old unique index is dropped in
-- the same statement so the table never sees both at once.
--
-- Backfill: existing rows keep working — name + inputs are NULL
-- for every legacy row, and the runtime treats NULL inputs the
-- same as `{}` (no overrides). No data migration required.

ALTER TABLE "ScheduledJob"
  DROP CONSTRAINT IF EXISTS "ScheduledJob_runbookId_key";

ALTER TABLE "ScheduledJob"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "inputs" JSONB;

CREATE INDEX "ScheduledJob_runbookId_idx" ON "ScheduledJob"("runbookId");
