-- Make NodeType.type tenant-scoped: drop the global single-column
-- unique constraint and replace it with a composite (type, tenantId)
-- so two tenants can independently install a plugin that claims the
-- same step type without colliding.
--
-- Postgres treats NULL as distinct in unique indexes by default, so
-- existing globals (tenantId IS NULL) are not protected from
-- duplicate inserts purely by the composite. We belt-and-braces
-- enforce "at most one global per type" via a partial unique index
-- below — that constraint can't be expressed in the Prisma schema
-- DSL, so we add it as a hand-rolled SQL statement.

-- Drop the legacy single-column unique constraint.
DROP INDEX IF EXISTS "NodeType_type_key";

-- Composite unique covering both global rows (tenantId IS NULL) and
-- tenant-owned rows. Postgres treats NULLs as distinct here, so the
-- partial index below catches the global-duplicate case.
CREATE UNIQUE INDEX "NodeType_type_tenantId_key" ON "NodeType"("type", "tenantId");

-- Belt-and-braces: at most one global row per type. Without this,
-- two seed runs could insert duplicate globals because Postgres
-- considers NULL != NULL inside the composite above.
CREATE UNIQUE INDEX "NodeType_type_global_unique" ON "NodeType"("type") WHERE "tenantId" IS NULL;
