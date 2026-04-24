-- Webhook-receipt-based retry queue.
--
-- Before: when an inbound webhook reached the runbook engine and the
-- engine threw (transient DB error, downstream runner hiccup), the
-- route returned 500 and relied on GitHub/Stripe/Datadog to retry.
-- most senders retry ~3 times across ~30 min then give up — if we
-- were down longer the delivery was lost. no local trace of "how
-- many webhooks failed today".
--
-- After: WebhookReceipt gains retryAttempts + nextRetryAt. The route
-- still returns 500 so the sender's own retry path stays live (belt),
-- AND a background worker retries locally with exponential backoff
-- (braces). A4's WebhookEvent unique index de-dupes any overlap
-- between local retry and sender retry.
--
-- Both new columns are nullable/zero-default so existing error
-- receipts stay valid; the worker ignores them until the next
-- failing webhook writes a nextRetryAt.

ALTER TABLE "WebhookReceipt"
  ADD COLUMN "retryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt"   TIMESTAMP(3);

-- Worker's hot path: SELECT WHERE status='error' AND nextRetryAt<=NOW()
-- ORDER BY nextRetryAt. Composite serves it without a table scan.
CREATE INDEX "WebhookReceipt_status_nextRetryAt_idx"
    ON "WebhookReceipt" ("status", "nextRetryAt");
