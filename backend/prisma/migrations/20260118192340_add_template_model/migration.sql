-- CreateEnum
CREATE TYPE "CredentialEnvironment" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION', 'ALL');

-- CreateEnum
CREATE TYPE "SystemEventType" AS ENUM ('ALERT_TRIGGERED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED', 'WORKFLOW_STARTED', 'CREDENTIAL_EXPIRING', 'CUSTOM');

-- AlterEnum
ALTER TYPE "TriggerType" ADD VALUE 'SYSTEM_EVENT';

-- AlterTable
ALTER TABLE "Credential" ADD COLUMN     "allowedTags" TEXT[],
ADD COLUMN     "allowedWorkflows" TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "environment" "CredentialEnvironment" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "SystemEventListener" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "eventType" "SystemEventType" NOT NULL,
    "eventFilter" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemEventListener_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nodeId" TEXT,
    "workflowId" TEXT,
    "metricName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "SystemEventType" NOT NULL,
    "severity" "ErrorSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "nodes" JSONB,
    "connections" JSONB,
    "category" TEXT,
    "icon" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemEventListener_eventType_idx" ON "SystemEventListener"("eventType");

-- CreateIndex
CREATE INDEX "SystemEventListener_isActive_idx" ON "SystemEventListener"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SystemEventListener_workflowId_eventType_key" ON "SystemEventListener"("workflowId", "eventType");

-- CreateIndex
CREATE INDEX "Metric_timestamp_idx" ON "Metric"("timestamp");

-- CreateIndex
CREATE INDEX "Metric_metricName_idx" ON "Metric"("metricName");

-- CreateIndex
CREATE INDEX "Metric_workflowId_idx" ON "Metric"("workflowId");

-- CreateIndex
CREATE INDEX "Metric_nodeId_idx" ON "Metric"("nodeId");

-- CreateIndex
CREATE INDEX "Metric_tenantId_idx" ON "Metric"("tenantId");

-- CreateIndex
CREATE INDEX "AlertHistory_tenantId_idx" ON "AlertHistory"("tenantId");

-- CreateIndex
CREATE INDEX "AlertHistory_createdAt_idx" ON "AlertHistory"("createdAt");

-- CreateIndex
CREATE INDEX "AlertHistory_isRead_idx" ON "AlertHistory"("isRead");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_isPublic_idx" ON "Template"("isPublic");

-- CreateIndex
CREATE INDEX "Credential_environment_idx" ON "Credential"("environment");

-- AddForeignKey
ALTER TABLE "SystemEventListener" ADD CONSTRAINT "SystemEventListener_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
