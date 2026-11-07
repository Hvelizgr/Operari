ALTER TABLE "Approval"
  ADD COLUMN "approvers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "escalateAt" TIMESTAMP(3),
  ADD COLUMN "escalateTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "notifyTargets" TEXT;

CREATE INDEX "Approval_status_expiresAt_idx" ON "Approval"("status", "expiresAt");
CREATE INDEX "Approval_status_escalateAt_idx" ON "Approval"("status", "escalateAt");
