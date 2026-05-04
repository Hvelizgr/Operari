-- Add free-form `tags` to Execution (trigger.dev parity).
--
-- Operators tag a run at runtime with arbitrary slugs ("env:prod",
-- "user:42", "incident:INC-217") so the runs list can be sliced by
-- arbitrary axes that do not fit the closed `status` / `runbook`
-- enums. Default empty array — existing rows untouched.
--
-- A GIN index on the array column lets `tags && ARRAY['env:prod']`
-- queries hit an index scan instead of seq-scanning the table.
-- Cheap to maintain because tag arrays are tiny in the common case
-- (we cap to 16 per run at the API layer).

ALTER TABLE "Execution" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Execution_tags_idx" ON "Execution" USING GIN ("tags");
