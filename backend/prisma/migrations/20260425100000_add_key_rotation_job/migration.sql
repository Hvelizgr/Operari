-- Key rotation orchestration (S3.4).
--
-- Background: rotating NANORUN_SECRET_KEY today is manual and risky —
-- the operator has to: (1) re-encrypt every ConnectedAccount.accessToken
-- / refreshToken, (2) re-encrypt every User.mfaSecretCiphered, (3) do
-- it without downtime, (4) leave a compliance trail showing when the
-- rotation finished. PENDIENTE.md flagged this as "antes de SOC 2";
-- without it the auditor finding is "no key rotation procedure".
--
-- This table is the state machine the background worker drives. One
-- row per rotation run:
--
--   startRotation(deadline) → INSERT row status=PENDING
--   worker picks it up → UPDATE status=RUNNING
--   worker processes batches → UPDATE rowsCompleted, nextCursor
--   last batch done → UPDATE status=COMPLETED, completedAt=NOW
--   failures exhaust → UPDATE status=FAILED, lastError
--
-- nextCursor is an opaque JSON blob (current table name + last row id)
-- so a crash mid-rotation resumes cleanly from the next row.
-- rowsTotal is populated on the first batch after scanning the
-- tables; stays NULL during the dry-run estimate.

CREATE TABLE "KeyRotationJob" (
    "id"              TEXT NOT NULL,
    "deadline"        TIMESTAMP(3) NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "dryRun"          BOOLEAN NOT NULL DEFAULT false,
    "rowsTotal"       INTEGER,
    "rowsCompleted"   INTEGER NOT NULL DEFAULT 0,
    "rowsFailed"      INTEGER NOT NULL DEFAULT 0,
    "nextCursor"      JSONB,
    "lastError"       TEXT,
    "startedAt"       TIMESTAMP(3),
    "completedAt"     TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyRotationJob_pkey" PRIMARY KEY ("id")
);

-- Worker's hot path: SELECT WHERE status IN ('PENDING','RUNNING')
-- ORDER BY createdAt LIMIT 1. Only one active job at a time is the
-- intended contract; if two admins race on startRotation, the second
-- call rejects at the service level.
CREATE INDEX "KeyRotationJob_status_createdAt_idx"
    ON "KeyRotationJob" ("status", "createdAt");

-- Operator FK — SetNull on user delete so a GDPR purge doesn't erase
-- the rotation history (compliance evidence that the key WAS rotated,
-- even if the person who triggered it is gone).
ALTER TABLE "KeyRotationJob"
  ADD CONSTRAINT "KeyRotationJob_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
