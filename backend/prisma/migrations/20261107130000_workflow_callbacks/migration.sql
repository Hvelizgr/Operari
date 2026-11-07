CREATE TABLE "WorkflowCallback" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowCallback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowCallback_tokenHash_key" ON "WorkflowCallback"("tokenHash");
CREATE INDEX "WorkflowCallback_status_expiresAt_idx" ON "WorkflowCallback"("status", "expiresAt");
CREATE INDEX "WorkflowCallback_executionId_idx" ON "WorkflowCallback"("executionId");

ALTER TABLE "WorkflowCallback" ADD CONSTRAINT "WorkflowCallback_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
