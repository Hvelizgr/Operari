-- Adds the Runbook.inputs JSON column used to declare typed job
-- options (Rundeck-style). The Run dialog reads this list and renders
-- a form instead of the raw JSON textarea when it's non-empty.
--
-- Default '[]' so existing runbooks keep working without a data
-- backfill — an empty declaration list means "no form, fall back to
-- JSON input".

ALTER TABLE "Runbook"
ADD COLUMN "inputs" JSONB DEFAULT '[]'::jsonb;
