-- Monitor alert channels.
--
-- Before this migration, MonitorService.evaluateAll() would flip a
-- monitor to FIRING and write a MonitorEvent row — but nothing
-- notified a human. The operator had to be actively watching the
-- dashboard to notice. The P1 audit called out "monitors fire but
-- cannot notify" as a MEDIUM-severity observability gap.
--
-- Minimum viable surface for this PR: two nullable columns on the
-- existing Monitor row. A richer multi-channel notification config
-- (tenant-level default channels, per-severity routing) can come
-- later without touching this shape — Monitor.alertEmail / .alert
-- WebhookUrl can stay as per-monitor overrides.

ALTER TABLE "Monitor"
  ADD COLUMN "alertWebhookUrl" TEXT,
  ADD COLUMN "alertEmail" TEXT;
