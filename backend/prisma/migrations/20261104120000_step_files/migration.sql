CREATE TABLE "StepFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executionId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StepFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StepFile_tenantId_idx" ON "StepFile"("tenantId");
CREATE INDEX "StepFile_expiresAt_idx" ON "StepFile"("expiresAt");
ALTER TABLE "StepFile" ADD CONSTRAINT "StepFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
