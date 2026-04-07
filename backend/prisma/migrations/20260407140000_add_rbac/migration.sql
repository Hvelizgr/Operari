-- RBAC: per-tenant CustomRole + RoleAssignment
--
-- Backwards compatible: the existing `Role` enum on User is preserved.
-- A user with zero RoleAssignments falls back to the legacy enum via
-- PermissionService.
--
-- The model is named `CustomRole` (not `Role`) to avoid a name clash
-- with the existing User.role enum.

CREATE TABLE "CustomRole" (
    "id"          TEXT         NOT NULL,
    "tenantId"    TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem"    BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomRole_tenantId_name_key" ON "CustomRole"("tenantId", "name");
CREATE INDEX "CustomRole_tenantId_idx" ON "CustomRole"("tenantId");

ALTER TABLE "CustomRole"
    ADD CONSTRAINT "CustomRole_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RoleAssignment" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "roleId"    TEXT         NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleAssignment_userId_roleId_key" ON "RoleAssignment"("userId", "roleId");
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");
CREATE INDEX "RoleAssignment_roleId_idx" ON "RoleAssignment"("roleId");

ALTER TABLE "RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment"
    ADD CONSTRAINT "RoleAssignment_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "CustomRole"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
