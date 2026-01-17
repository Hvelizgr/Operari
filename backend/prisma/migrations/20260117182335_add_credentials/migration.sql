-- AlterEnum
ALTER TYPE "ExecutionStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "resumeState" JSONB;

-- AlterTable
ALTER TABLE "WorkflowNode" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "StorageBucket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageBucket_tenantId_idx" ON "StorageBucket"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageBucket_tenantId_name_key" ON "StorageBucket"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Credential_userId_idx" ON "Credential"("userId");

-- CreateIndex
CREATE INDEX "Credential_type_idx" ON "Credential"("type");

-- AddForeignKey
ALTER TABLE "StorageBucket" ADD CONSTRAINT "StorageBucket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
