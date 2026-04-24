-- Tenant-wide alert channel defaults.
--
-- A previous PR (feat(backend): wire monitor alerts to slack + email)
-- shipped per-monitor Monitor.alertWebhookUrl + .alertEmail columns.
-- Typical deployment pattern: the operator wants ONE slack channel
-- for every monitor in the tenant (#alerts-prod), not per-monitor
-- configuration. Forcing them to copy-paste the webhook URL onto
-- every row is bad UX.
--
-- TenantAlertChannel is the fallback: if the fired Monitor has no
-- per-row alertWebhookUrl / alertEmail, the resolver looks up the
-- tenant's active channel row and uses those values.
--
-- Multiple rows per tenant are allowed so an admin can stage a
-- replacement webhook (isActive=false) before flipping it live, but
-- the resolver only uses the first isActive=true row. Cascade on
-- tenant delete.

CREATE TABLE "TenantAlertChannel" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "webhookUrl"  TEXT,
    "email"       TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAlertChannel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TenantAlertChannel"
  ADD CONSTRAINT "TenantAlertChannel_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Resolver's hot path: SELECT WHERE tenantId=:x AND isActive=true
-- ORDER BY createdAt LIMIT 1. Composite index on (tenantId, isActive)
-- serves this without a scan.
CREATE INDEX "TenantAlertChannel_tenantId_isActive_idx"
    ON "TenantAlertChannel" ("tenantId", "isActive");
