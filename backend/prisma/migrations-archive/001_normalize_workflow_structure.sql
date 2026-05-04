-- CreateTable: WorkflowNode
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

-- CreateTable: WorkflowConnection
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

-- CreateIndex
CREATE INDEX "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");
CREATE INDEX "WorkflowNode_type_idx" ON "WorkflowNode"("type");

CREATE INDEX "WorkflowConnection_workflowId_idx" ON "WorkflowConnection"("workflowId");
CREATE INDEX "WorkflowConnection_sourceNodeId_idx" ON "WorkflowConnection"("sourceNodeId");
CREATE INDEX "WorkflowConnection_targetNodeId_idx" ON "WorkflowConnection"("targetNodeId");

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" 
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_workflowId_fkey" 
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_sourceNodeId_fkey" 
    FOREIGN KEY ("sourceNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowConnection" ADD CONSTRAINT "WorkflowConnection_targetNodeId_fkey" 
    FOREIGN KEY ("targetNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Make nodes and connections nullable for backward compatibility
ALTER TABLE "Workflow" ALTER COLUMN "nodes" DROP NOT NULL;
ALTER TABLE "Workflow" ALTER COLUMN "connections" DROP NOT NULL;
