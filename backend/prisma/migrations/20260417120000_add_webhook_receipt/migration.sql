-- Adds the WebhookReceipt debug trail. Every POST to a webhook
-- endpoint writes one row — accepted triggers AND rejected calls —
-- so an on-call SRE can see what the external service actually sent
-- when a trigger misfires. Retention is enforced at write-time (last
-- 50 per webhook) by the handler, not by a scheduled job, because
-- the cardinality stays bounded naturally.

CREATE TABLE "WebhookReceipt" (
    "id"          TEXT        PRIMARY KEY,
    "webhookId"   TEXT        NOT NULL,
    "tenantId"    TEXT        NOT NULL,
    "status"      TEXT        NOT NULL,
    "statusCode"  INTEGER     NOT NULL,
    "reason"      TEXT,
    "headers"     JSONB       NOT NULL,
    "body"        JSONB       NOT NULL,
    "sourceIp"    TEXT,
    "executionId" TEXT,
    "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookReceipt_webhookId_fkey"
        FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WebhookReceipt_webhookId_receivedAt_idx"
    ON "WebhookReceipt" ("webhookId", "receivedAt" DESC);

CREATE INDEX "WebhookReceipt_tenantId_idx"
    ON "WebhookReceipt" ("tenantId");
