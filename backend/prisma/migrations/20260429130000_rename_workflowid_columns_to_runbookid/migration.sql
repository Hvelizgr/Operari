-- Phase A4 — physical column rename to finish the workflow → runbook rebrand.
--
-- The previous migration (20260416000000_rename_tables_to_runbook) explicitly
-- left the FK columns with their legacy `workflowId` names "to keep that
-- migration small and focused." This is the follow-up that closes the loop
-- so the schema reads consistently top to bottom.
--
-- Seven tables, seven RENAME COLUMNs, plus the matching constraint and
-- index renames Postgres does NOT do automatically when a column is
-- renamed.
--
-- Safe properties:
--   * RENAME COLUMN is metadata-only — no data rewrite, no table lock
--     beyond the brief access-exclusive needed to update catalog rows.
--   * The hash-chained AuditEvent table is untouched.
--   * Foreign-key referential integrity is preserved (the constraint
--     points at column OIDs, not names).

-- 1. RunbookStep
ALTER TABLE "RunbookStep" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "RunbookStep" RENAME CONSTRAINT "RunbookStep_workflowId_fkey" TO "RunbookStep_runbookId_fkey";
ALTER INDEX "RunbookStep_workflowId_idx" RENAME TO "RunbookStep_runbookId_idx";

-- 2. RunbookConnection
ALTER TABLE "RunbookConnection" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "RunbookConnection" RENAME CONSTRAINT "RunbookConnection_workflowId_fkey" TO "RunbookConnection_runbookId_fkey";
ALTER INDEX "RunbookConnection_workflowId_idx" RENAME TO "RunbookConnection_runbookId_idx";

-- 3. Execution
ALTER TABLE "Execution" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "Execution" RENAME CONSTRAINT "Execution_workflowId_fkey" TO "Execution_runbookId_fkey";
ALTER INDEX "Execution_workflowId_idx" RENAME TO "Execution_runbookId_idx";

-- 4. ScheduledJob (single-column unique → constraint + implicit index share the name)
ALTER TABLE "ScheduledJob" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "ScheduledJob" RENAME CONSTRAINT "ScheduledJob_workflowId_fkey" TO "ScheduledJob_runbookId_fkey";
ALTER INDEX "ScheduledJob_workflowId_key" RENAME TO "ScheduledJob_runbookId_key";

-- 5. Approval
ALTER TABLE "Approval" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "Approval" RENAME CONSTRAINT "Approval_workflowId_fkey" TO "Approval_runbookId_fkey";
ALTER INDEX "Approval_workflowId_idx" RENAME TO "Approval_runbookId_idx";

-- 6. Webhook
ALTER TABLE "Webhook" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "Webhook" RENAME CONSTRAINT "Webhook_workflowId_fkey" TO "Webhook_runbookId_fkey";
ALTER INDEX "Webhook_workflowId_idx" RENAME TO "Webhook_runbookId_idx";

-- 7. Monitor
ALTER TABLE "Monitor" RENAME COLUMN "workflowId" TO "runbookId";
ALTER TABLE "Monitor" RENAME CONSTRAINT "Monitor_workflowId_fkey" TO "Monitor_runbookId_fkey";
ALTER INDEX "Monitor_workflowId_idx" RENAME TO "Monitor_runbookId_idx";
