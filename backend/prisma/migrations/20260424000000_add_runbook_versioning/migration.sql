-- Runbook versioning.
--
-- Before this migration, Runbook.nodes + Runbook.connections were
-- mutable JSON blobs. Every save overwrote them in place, which meant:
--   - Re-running a historical Execution could not reproduce what the
--     engine actually saw at the time the run started.
--   - A user who edited a runbook mid-flight could silently change the
--     DAG its in-progress children walked.
--   - Audit could not answer "what version was version X at T?".
--
-- After: every save produces a fresh RunbookVersion row (monotonic
-- integer per runbook) whose `snapshot` JSON freezes the full
-- definition. Executions link to the version they started from, so
-- replay is deterministic and audit can trace "run -> version ->
-- exact bytes at commit time".
--
-- This migration:
--   1. Creates the RunbookVersion table.
--   2. Backfills version 1 for every existing runbook, snapshotting
--      whatever nodes/connections/inputs they hold right now.
--   3. Adds Execution.runbookVersionId as a nullable FK (historical
--      rows stay NULL — we cannot truthfully claim which version they
--      saw, and inventing one would corrupt the audit story).

-- ─── Step 1: RunbookVersion table ─────────────────────────────────

CREATE TABLE "RunbookVersion" (
    "id"              TEXT NOT NULL,
    "runbookId"       TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "version"         INTEGER NOT NULL,
    "snapshot"        JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunbookVersion_pkey" PRIMARY KEY ("id")
);

-- Natural identity. RunbookVersionService uses this index to pick the
-- next version number atomically (MAX(version)+1) and to fetch a
-- specific version when an Execution replays.
CREATE UNIQUE INDEX "RunbookVersion_runbookId_version_key"
    ON "RunbookVersion" ("runbookId", "version");

-- Per-tenant "recent versions" scan (admin + audit views).
CREATE INDEX "RunbookVersion_tenantId_createdAt_idx"
    ON "RunbookVersion" ("tenantId", "createdAt");

ALTER TABLE "RunbookVersion"
  ADD CONSTRAINT "RunbookVersion_runbookId_fkey"
  FOREIGN KEY ("runbookId") REFERENCES "Runbook"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RunbookVersion"
  ADD CONSTRAINT "RunbookVersion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- User FK is SetNull: a GDPR user-purge must not take historical
-- version rows with it. The row still has tenantId + snapshot.
ALTER TABLE "RunbookVersion"
  ADD CONSTRAINT "RunbookVersion_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Step 2: backfill version 1 for every runbook ────────────────
-- One row per existing Runbook, snapshotting its current nodes /
-- connections / inputs / metadata. The snapshot shape mirrors the
-- payload RunbookVersionService.createVersion writes going forward.
INSERT INTO "RunbookVersion" ("id", "runbookId", "tenantId", "version", "snapshot", "createdByUserId", "createdAt")
SELECT
    gen_random_uuid()::text,
    r."id",
    r."tenantId",
    1,
    jsonb_build_object(
        'name',             r."name",
        'description',      r."description",
        'category',         r."category",
        'nodes',            COALESCE(r."nodes", '[]'::jsonb),
        'connections',      COALESCE(r."connections", '[]'::jsonb),
        'inputs',           COALESCE(r."inputs", '[]'::jsonb),
        'onErrorRunbookId', r."onErrorRunbookId"
    ),
    r."userId",
    r."updatedAt"
FROM "Runbook" r;

-- ─── Step 3: Execution.runbookVersionId ───────────────────────────
ALTER TABLE "Execution" ADD COLUMN "runbookVersionId" TEXT;

-- SetNull so a cascade Delete Version (which shouldn't happen but
-- could during aggressive cleanup) does not take Execution rows
-- with it. An Execution with runbookVersionId NULL falls back to
-- reading the current Runbook row, matching pre-migration behavior
-- for historical runs.
ALTER TABLE "Execution"
  ADD CONSTRAINT "Execution_runbookVersionId_fkey"
  FOREIGN KEY ("runbookVersionId") REFERENCES "RunbookVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Execution_runbookVersionId_idx"
    ON "Execution" ("runbookVersionId");
