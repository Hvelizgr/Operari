-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NodeLogStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'API');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WEBHOOK', 'EMAIL', 'SLACK', 'TEAMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes" JSONB,
    "connections" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "config" JSONB,
    "inputs" JSONB,
    "outputs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowConnection" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "sourcePort" INTEGER,
    "targetNodeId" TEXT NOT NULL,
    "targetPort" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "TriggerType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "error" TEXT,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeLog" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "NodeLogStatus" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "NodeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionError" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeLogId" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "isRetryable" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 0,
    "context" JSONB,
    "stackTrace" TEXT,
    "cause" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutionError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorNotificationConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "webhookUrl" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minSeverity" "ErrorSeverity" NOT NULL DEFAULT 'HIGH',
    "errorCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorNotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeType" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "subtitle" JSONB,
    "inputs" JSONB DEFAULT '[]',
    "outputs" JSONB DEFAULT '[]',
    "properties" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Workflow_userId_idx" ON "Workflow"("userId");

-- CreateIndex
CREATE INDEX "Workflow_tenantId_idx" ON "Workflow"("tenantId");

-- CreateIndex
CREATE INDEX "Workflow_isActive_idx" ON "Workflow"("isActive");

-- CreateIndex
CREATE INDEX "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowNode_type_idx" ON "WorkflowNode"("type");

-- CreateIndex
CREATE INDEX "WorkflowConnection_workflowId_idx" ON "WorkflowConnection"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowConnection_sourceNodeId_idx" ON "WorkflowConnection"("sourceNodeId");

-- CreateIndex
CREATE INDEX "WorkflowConnection_targetNodeId_idx" ON "WorkflowConnection"("targetNodeId");

-- CreateIndex
CREATE INDEX "Execution_workflowId_idx" ON "Execution"("workflowId");

-- CreateIndex
CREATE INDEX "Execution_userId_idx" ON "Execution"("userId");

-- CreateIndex
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- CreateIndex
CREATE INDEX "Execution_startedAt_idx" ON "Execution"("startedAt");

-- CreateIndex
CREATE INDEX "NodeLog_executionId_idx" ON "NodeLog"("executionId");

-- CreateIndex
CREATE INDEX "NodeLog_nodeId_idx" ON "NodeLog"("nodeId");

-- CreateIndex
CREATE INDEX "NodeLog_status_idx" ON "NodeLog"("status");

-- CreateIndex
CREATE INDEX "ExecutionError_executionId_idx" ON "ExecutionError"("executionId");

-- CreateIndex
CREATE INDEX "ExecutionError_code_idx" ON "ExecutionError"("code");

-- CreateIndex
CREATE INDEX "ExecutionError_severity_idx" ON "ExecutionError"("severity");

-- CreateIndex
CREATE INDEX "ExecutionError_createdAt_idx" ON "ExecutionError"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorNotificationConfig_tenantId_idx" ON "ErrorNotificationConfig"("tenantId");

-- CreateIndex
CREATE INDEX "ErrorNotificationConfig_isActive_idx" ON "ErrorNotificationConfig"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_workflowId_key" ON "ScheduledJob"("workflowId");

-- CreateIndex
CREATE INDEX "ScheduledJob_isActive_idx" ON "ScheduledJob"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NodeType_type_key" ON "NodeType"("type");

-- CreateIndex
CREATE INDEX "NodeType_category_idx" ON "NodeType"("category");

-- CreateIndex
CREATE INDEX "NodeType_type_idx" ON "NodeType"("type");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeLog" ADD CONSTRAINT "NodeLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionError" ADD CONSTRAINT "ExecutionError_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
