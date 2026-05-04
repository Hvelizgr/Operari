-- Denormalize tenantId onto Execution / NodeLog / ExecutionError.
--
-- Before this migration, tenant scoping on these three tables lived
-- only in Runbook — every tenant-safe query had to traverse
-- Execution -> workflow -> tenantId. A route handler that forgot the
-- join leaked data across tenants, and there was nothing in Postgres
-- to stop it.
--
-- After: each row carries its tenantId directly, guarded by a FK to
-- Tenant with ON DELETE CASCADE so the existing "tenant delete
-- cascades all children" contract is preserved. Composite indexes on
-- the new column let the hot-path dashboards (monitor sweeps, run
-- lists) filter by tenant without a join.
--
-- Strategy: single migration, pre-production row counts. If this ever
-- needs to run on a table with millions of rows, split into:
--   (1) ADD nullable + backfill, (2) SET NOT NULL + FK + indexes.

-- ─── Step 1: add nullable columns ─────────────────────────────────
ALTER TABLE "Execution" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "NodeLog" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ExecutionError" ADD COLUMN "tenantId" TEXT;

-- ─── Step 2: backfill from the existing join paths ────────────────
UPDATE "Execution" e
   SET "tenantId" = r."tenantId"
  FROM "Runbook" r
 WHERE e."workflowId" = r."id";

UPDATE "NodeLog" nl
   SET "tenantId" = e."tenantId"
  FROM "Execution" e
 WHERE nl."executionId" = e."id";

UPDATE "ExecutionError" ee
   SET "tenantId" = e."tenantId"
  FROM "Execution" e
 WHERE ee."executionId" = e."id";

-- ─── Step 3: enforce NOT NULL. Any row still NULL after the
-- backfill is an orphan (FK should have prevented it, but we fail
-- loudly rather than silently drop the constraint). ───────────────
ALTER TABLE "Execution" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "NodeLog" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ExecutionError" ALTER COLUMN "tenantId" SET NOT NULL;

-- ─── Step 4: FK to Tenant ─────────────────────────────────────────
ALTER TABLE "Execution"
  ADD CONSTRAINT "Execution_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NodeLog"
  ADD CONSTRAINT "NodeLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutionError"
  ADD CONSTRAINT "ExecutionError_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Step 5: composite indexes for hot-path queries ───────────────
-- Execution: the dashboard, monitor sweeps, and run lists all filter
-- by tenant + status + time. Leading column tenantId means Postgres
-- can serve tenant-scoped queries from a single index.
CREATE INDEX "Execution_tenantId_status_startedAt_idx"
  ON "Execution" ("tenantId", "status", "startedAt" DESC);

-- NodeLog: per-tenant step log lookups (run details pages, agent
-- tools that scan step logs) stop joining through Execution.
CREATE INDEX "NodeLog_tenantId_executionId_idx"
  ON "NodeLog" ("tenantId", "executionId");

-- ExecutionError: error dashboards filter by tenant + severity +
-- time. The existing single-column indexes on severity/createdAt
-- stay for cross-tenant ops views (admin-only) but per-tenant
-- queries hit the composite first.
CREATE INDEX "ExecutionError_tenantId_severity_createdAt_idx"
  ON "ExecutionError" ("tenantId", "severity", "createdAt" DESC);
