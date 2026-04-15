-- Rename legacy NanoFlow `n8n-nodes-base.*` node type strings to the
-- new NanoRun `nanorun.*` prefix. This migration is data-only — the
-- columns themselves are already TEXT and the application code in
-- this same commit references the new strings exclusively.
--
-- Affected rows:
--   - NodeType.type        — the catalog of available step types
--   - WorkflowNode.type    — every step instance inside an existing runbook
--
-- Idempotent: rerunning is safe because the WHERE clause filters on the
-- legacy prefix and we strip it cleanly.
--
-- The legacy `editor/nodes/*.executor.ts` dispatcher already accepts
-- the new strings via the runbook executor registry; no executor-level
-- changes are required for runtime compatibility.

UPDATE "NodeType"
SET "type" = REPLACE("type", 'n8n-nodes-base.', 'nanorun.')
WHERE "type" LIKE 'n8n-nodes-base.%';

UPDATE "WorkflowNode"
SET "type" = REPLACE("type", 'n8n-nodes-base.', 'nanorun.')
WHERE "type" LIKE 'n8n-nodes-base.%';
