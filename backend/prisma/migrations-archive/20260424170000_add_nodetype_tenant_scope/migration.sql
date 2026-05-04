-- Tenant-scoped custom node types.
--
-- Before: NodeType rows were globally visible to every tenant. Plugin
-- authors had no way to ship a custom node type ONLY to their own
-- runbooks — installing a step meant baking it into the core seed
-- data, which is a tenant-isolation violation on a multi-tenant
-- deployment.
--
-- After: NodeType.tenantId is nullable.
--   NULL       → core global type (the existing seed rows)
--   non-NULL   → tenant-owned custom type, visible only to that
--                tenant's editor
--
-- The endpoint filters to (tenantId IS NULL OR tenantId = :caller)
-- when authenticated, so existing globals keep rendering everywhere
-- and new per-tenant rows show up only where they belong.
-- Cascade on tenant delete so a tenant purge doesn't leave orphan
-- node-type rows around.

ALTER TABLE "NodeType" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "NodeType"
  ADD CONSTRAINT "NodeType_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-tenant listing queries: WHERE tenantId IS NULL OR tenantId = :x.
-- The composite index on (tenantId, type) lets Postgres serve that
-- union cheaply; the existing unique constraint on `type` alone stays
-- the global identity (core types must not collide).
CREATE INDEX "NodeType_tenantId_idx" ON "NodeType" ("tenantId");
