-- AuditEvent: append-only, hash-chained audit log.
--
-- The Prisma schema declares the columns. This migration adds the database
-- guarantees Prisma cannot express:
--   1. UPDATE and DELETE are blocked at the trigger level. Even a tenant
--      admin with direct connection cannot rewrite history without
--      dropping the trigger first (which is itself a logged DDL event).
--   2. TRUNCATE is blocked too — same trigger.
--
-- The application layer (AuditService) is responsible for computing the
-- hash chain. The trigger does not validate the hash because the chain
-- spans rows and the trigger sees one row at a time.

CREATE TABLE "AuditEvent" (
    "seq"       BIGSERIAL                NOT NULL,
    "id"        TEXT                     NOT NULL,
    "tenantId"  TEXT                     NOT NULL,
    "type"      TEXT                     NOT NULL,
    "actorId"   TEXT,
    "actorType" TEXT,
    "resource"  TEXT,
    "payload"   JSONB                    NOT NULL,
    "hash"      VARCHAR(64)              NOT NULL,
    "prevHash"  VARCHAR(64)              NOT NULL,
    "createdAt" TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_tenantId_seq_idx"       ON "AuditEvent" ("tenantId", "seq");
CREATE INDEX "AuditEvent_tenantId_type_idx"      ON "AuditEvent" ("tenantId", "type");
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent" ("tenantId", "createdAt");
CREATE INDEX "AuditEvent_resource_idx"           ON "AuditEvent" ("resource");

-- ---------------------------------------------------------------------------
-- Append-only enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nanorun_audit_event_immutable()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        'AuditEvent is append-only; % is not permitted (op=%, table=%)',
        TG_OP, TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_update
BEFORE UPDATE ON "AuditEvent"
FOR EACH ROW
EXECUTE FUNCTION nanorun_audit_event_immutable();

CREATE TRIGGER audit_event_no_delete
BEFORE DELETE ON "AuditEvent"
FOR EACH ROW
EXECUTE FUNCTION nanorun_audit_event_immutable();

CREATE TRIGGER audit_event_no_truncate
BEFORE TRUNCATE ON "AuditEvent"
FOR EACH STATEMENT
EXECUTE FUNCTION nanorun_audit_event_immutable();
