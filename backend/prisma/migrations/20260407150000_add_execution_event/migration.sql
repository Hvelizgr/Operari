-- Durable execution event log (P1 #7 foundation)
--
-- Append-only table the worker reads to reconstruct in-flight runs
-- after a backend restart. NOT hash-chained — durability rather than
-- tamper-evidence is the goal here, AuditEvent already covers tamper
-- detection at the tenant level.
--
-- The seq column is BIGSERIAL so each event gets a globally monotonic
-- id, but the indexed read path is `(executionId, seq)` so a single
-- run can be replayed in O(events) without touching unrelated rows.

CREATE TABLE "ExecutionEvent" (
    "seq"         BIGSERIAL    NOT NULL,
    "id"          TEXT         NOT NULL,
    "executionId" TEXT         NOT NULL,
    "tenantId"    TEXT         NOT NULL,
    "type"        TEXT         NOT NULL,
    "nodeId"      TEXT,
    "payload"     JSONB        NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutionEvent_executionId_seq_idx"
    ON "ExecutionEvent" ("executionId", "seq");
CREATE INDEX "ExecutionEvent_executionId_type_idx"
    ON "ExecutionEvent" ("executionId", "type");
CREATE INDEX "ExecutionEvent_tenantId_createdAt_idx"
    ON "ExecutionEvent" ("tenantId", "createdAt");
