-- Rename TriggerType enum value WORKFLOW → RUNBOOK.
--
-- Post-pivot rebrand cleanup: the value still meant "spawned by another
-- runbook step inside an active execution"; the WORKFLOW name was a
-- legacy from when runbooks were called workflows. Code calls this
-- "RUNBOOK trigger" everywhere else, so the enum needed to follow.
--
-- ALTER TYPE ... RENAME VALUE preserves every existing row that used
-- the old label without the multi-step add/update/drop dance. Available
-- since PostgreSQL 10; Operari requires PG 14+.

ALTER TYPE "TriggerType" RENAME VALUE 'WORKFLOW' TO 'RUNBOOK';
