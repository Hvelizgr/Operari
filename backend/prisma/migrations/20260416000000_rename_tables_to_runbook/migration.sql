-- Fase 2b — physical DB rename to match the model names introduced in
-- the cairn rebrand. The prisma models Runbook / RunbookStep /
-- RunbookConnection have been using @@map to keep the legacy table
-- names; this migration drops the @@map and renames tables + indexes +
-- constraints to match. Columns are NOT renamed here (Execution.workflowId
-- and its peers stay as-is) to keep the migration small and focused.
--
-- Safe properties:
--   * Table RENAME carries every FK, index, trigger, and sequence
--     automatically. Foreign keys from other tables (Execution,
--     Webhook, Approval, ScheduledJob, Monitor, EventAgent) continue
--     to reference these tables by OID, not by name.
--   * The hash-chained audit log (AuditEvent) is untouched — its
--     immutability trigger is preserved.
--
-- Downtime: a fraction of a second of ACCESS EXCLUSIVE lock per
-- ALTER TABLE on postgres. Run during a maintenance window if the
-- tenant has an active runbook mid-flight.

-- 1. Tables
ALTER TABLE "Workflow" RENAME TO "Runbook";
ALTER TABLE "WorkflowNode" RENAME TO "RunbookStep";
ALTER TABLE "WorkflowConnection" RENAME TO "RunbookConnection";

-- 2. Primary-key and unique constraints
ALTER TABLE "Runbook"           RENAME CONSTRAINT "Workflow_pkey"                    TO "Runbook_pkey";
ALTER TABLE "Runbook"           RENAME CONSTRAINT "Workflow_tenantId_slug_key"       TO "Runbook_tenantId_slug_key";
ALTER TABLE "RunbookStep"       RENAME CONSTRAINT "WorkflowNode_pkey"                TO "RunbookStep_pkey";
ALTER TABLE "RunbookConnection" RENAME CONSTRAINT "WorkflowConnection_pkey"          TO "RunbookConnection_pkey";

-- 3. Foreign-key constraints owned by these tables
ALTER TABLE "Runbook"           RENAME CONSTRAINT "Workflow_userId_fkey"             TO "Runbook_userId_fkey";
ALTER TABLE "Runbook"           RENAME CONSTRAINT "Workflow_tenantId_fkey"           TO "Runbook_tenantId_fkey";
ALTER TABLE "RunbookStep"       RENAME CONSTRAINT "WorkflowNode_workflowId_fkey"     TO "RunbookStep_workflowId_fkey";
ALTER TABLE "RunbookConnection" RENAME CONSTRAINT "WorkflowConnection_workflowId_fkey"   TO "RunbookConnection_workflowId_fkey";
ALTER TABLE "RunbookConnection" RENAME CONSTRAINT "WorkflowConnection_sourceNodeId_fkey" TO "RunbookConnection_sourceNodeId_fkey";
ALTER TABLE "RunbookConnection" RENAME CONSTRAINT "WorkflowConnection_targetNodeId_fkey" TO "RunbookConnection_targetNodeId_fkey";

-- 4. Indexes
ALTER INDEX "Workflow_userId_idx"              RENAME TO "Runbook_userId_idx";
ALTER INDEX "Workflow_tenantId_idx"            RENAME TO "Runbook_tenantId_idx";
ALTER INDEX "Workflow_isActive_idx"            RENAME TO "Runbook_isActive_idx";

ALTER INDEX "WorkflowNode_workflowId_idx"      RENAME TO "RunbookStep_workflowId_idx";
ALTER INDEX "WorkflowNode_type_idx"            RENAME TO "RunbookStep_type_idx";

ALTER INDEX "WorkflowConnection_workflowId_idx"    RENAME TO "RunbookConnection_workflowId_idx";
ALTER INDEX "WorkflowConnection_sourceNodeId_idx"  RENAME TO "RunbookConnection_sourceNodeId_idx";
ALTER INDEX "WorkflowConnection_targetNodeId_idx"  RENAME TO "RunbookConnection_targetNodeId_idx";
