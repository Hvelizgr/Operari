# Schema Migration - Code Examples

This document provides complete code examples for updating your services to use the normalized workflow structure.

## Table of Contents

1. [Creating Workflows](#creating-workflows)
2. [Reading Workflows](#reading-workflows)
3. [Updating Workflows](#updating-workflows)
4. [Deleting Workflows](#deleting-workflows)
5. [Querying Workflows](#querying-workflows)
6. [Execution Service Updates](#execution-service-updates)

---

## Creating Workflows

### Before (JSON)

```typescript
// workflow.routes.ts - CREATE endpoint
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    const data = workflowDefinitionSchema.parse(req.body);
    
    const workflow = await prisma.workflow.create({
        data: {
            name: data.name,
            description: data.description,
            nodes: data.nodes as unknown as Prisma.InputJsonValue,
            connections: data.connections as unknown as Prisma.InputJsonValue,
            isActive: data.isActive ?? false,
            schedule: data.schedule,
            userId: req.user!.id,
            tenantId: req.user!.tenantId,
        },
    });
    
    res.json(workflow);
});
```

### After (Normalized)

```typescript
// workflow.routes.ts - CREATE endpoint
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    const data = workflowDefinitionSchema.parse(req.body);
    
    // Create workflow with nodes in a transaction
    const workflow = await prisma.$transaction(async (tx) => {
        // 1. Create the workflow
        const newWorkflow = await tx.workflow.create({
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? false,
                schedule: data.schedule,
                userId: req.user!.id,
                tenantId: req.user!.tenantId,
            },
        });

        // 2. Create nodes and build ID mapping
        const nodeIdMap = new Map<string, string>();
        
        for (const node of data.nodes) {
            const createdNode = await tx.workflowNode.create({
                data: {
                    workflowId: newWorkflow.id,
                    type: node.type,
                    title: node.title,
                    positionX: node.position.x,
                    positionY: node.position.y,
                    config: node.config || null,
                    inputs: node.inputs || null,
                    outputs: node.outputs || null,
                },
            });
            
            // Map original ID to new database ID
            nodeIdMap.set(node.id, createdNode.id);
        }

        // 3. Create connections using the ID mapping
        for (const conn of data.connections) {
            const sourceNodeId = nodeIdMap.get(conn.source);
            const targetNodeId = nodeIdMap.get(conn.target);
            
            if (!sourceNodeId || !targetNodeId) {
                throw new Error(`Invalid connection: source or target node not found`);
            }
            
            await tx.workflowConnection.create({
                data: {
                    workflowId: newWorkflow.id,
                    sourceNodeId,
                    targetNodeId,
                    sourcePort: conn.sourcePort ?? null,
                    targetPort: conn.targetPort ?? null,
                },
            });
        }

        // 4. Return workflow with all relations
        return tx.workflow.findUnique({
            where: { id: newWorkflow.id },
            include: {
                workflowNodes: {
                    orderBy: { createdAt: 'asc' },
                },
                workflowConnections: {
                    include: {
                        sourceNode: true,
                        targetNode: true,
                    },
                },
            },
        });
    });
    
    // Transform to match old format for backward compatibility
    const response = {
        ...workflow,
        nodes: workflow!.workflowNodes.map(node => ({
            id: node.id,
            type: node.type,
            title: node.title,
            position: {
                x: node.positionX,
                y: node.positionY,
            },
            config: node.config,
            inputs: node.inputs,
            outputs: node.outputs,
        })),
        connections: workflow!.workflowConnections.map(conn => ({
            id: conn.id,
            source: conn.sourceNodeId,
            target: conn.targetNodeId,
            sourcePort: conn.sourcePort,
            targetPort: conn.targetPort,
        })),
    };
    
    res.json(response);
});
```

---

## Reading Workflows

### Before (JSON)

```typescript
// workflow.routes.ts - GET by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    const workflow = await prisma.workflow.findUnique({
        where: { id: req.params.id },
    });
    
    if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json(workflow);
});
```

### After (Normalized)

```typescript
// workflow.routes.ts - GET by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    const workflow = await prisma.workflow.findUnique({
        where: { id: req.params.id },
        include: {
            workflowNodes: {
                orderBy: { createdAt: 'asc' },
            },
            workflowConnections: {
                include: {
                    sourceNode: { select: { id: true, title: true } },
                    targetNode: { select: { id: true, title: true } },
                },
            },
        },
    });
    
    if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Transform to match old format
    const response = {
        ...workflow,
        nodes: workflow.workflowNodes.map(node => ({
            id: node.id,
            type: node.type,
            title: node.title,
            position: {
                x: node.positionX,
                y: node.positionY,
            },
            config: node.config,
            inputs: node.inputs,
            outputs: node.outputs,
        })),
        connections: workflow.workflowConnections.map(conn => ({
            id: conn.id,
            source: conn.sourceNodeId,
            target: conn.targetNodeId,
            sourcePort: conn.sourcePort,
            targetPort: conn.targetPort,
        })),
    };
    
    res.json(response);
});
```

---

## Updating Workflows

### Before (JSON)

```typescript
// workflow.routes.ts - UPDATE
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    const data = workflowDefinitionSchema.parse(req.body);
    
    const workflow = await prisma.workflow.update({
        where: { id: req.params.id },
        data: {
            name: data.name,
            description: data.description,
            nodes: data.nodes as unknown as Prisma.InputJsonValue,
            connections: data.connections as unknown as Prisma.InputJsonValue,
            isActive: data.isActive,
            schedule: data.schedule,
        },
    });
    
    res.json(workflow);
});
```

### After (Normalized)

```typescript
// workflow.routes.ts - UPDATE
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    const data = workflowDefinitionSchema.parse(req.body);
    
    const workflow = await prisma.$transaction(async (tx) => {
        // 1. Update workflow metadata
        const updated = await tx.workflow.update({
            where: { id: req.params.id },
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive,
                schedule: data.schedule,
            },
        });

        // 2. Delete existing nodes and connections (cascade will handle connections)
        await tx.workflowNode.deleteMany({
            where: { workflowId: req.params.id },
        });

        // 3. Create new nodes
        const nodeIdMap = new Map<string, string>();
        
        for (const node of data.nodes) {
            const createdNode = await tx.workflowNode.create({
                data: {
                    workflowId: updated.id,
                    type: node.type,
                    title: node.title,
                    positionX: node.position.x,
                    positionY: node.position.y,
                    config: node.config || null,
                    inputs: node.inputs || null,
                    outputs: node.outputs || null,
                },
            });
            
            nodeIdMap.set(node.id, createdNode.id);
        }

        // 4. Create new connections
        for (const conn of data.connections) {
            const sourceNodeId = nodeIdMap.get(conn.source);
            const targetNodeId = nodeIdMap.get(conn.target);
            
            if (!sourceNodeId || !targetNodeId) {
                throw new Error(`Invalid connection: source or target node not found`);
            }
            
            await tx.workflowConnection.create({
                data: {
                    workflowId: updated.id,
                    sourceNodeId,
                    targetNodeId,
                    sourcePort: conn.sourcePort ?? null,
                    targetPort: conn.targetPort ?? null,
                },
            });
        }

        // 5. Return updated workflow
        return tx.workflow.findUnique({
            where: { id: updated.id },
            include: {
                workflowNodes: true,
                workflowConnections: true,
            },
        });
    });
    
    res.json(workflow);
});
```

---

## Deleting Workflows

### Before (JSON)

```typescript
// workflow.routes.ts - DELETE
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    await prisma.workflow.delete({
        where: { id: req.params.id },
    });
    
    res.json({ message: 'Workflow deleted' });
});
```

### After (Normalized)

```typescript
// workflow.routes.ts - DELETE
// No changes needed! CASCADE delete handles nodes and connections automatically
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    await prisma.workflow.delete({
        where: { id: req.params.id },
    });
    
    // Nodes and connections are automatically deleted due to CASCADE
    res.json({ message: 'Workflow deleted' });
});
```

---

## Querying Workflows

### New Capabilities

```typescript
// Find workflows by node type
router.get('/by-node-type/:type', authenticate, async (req: AuthRequest, res: Response) => {
    const workflows = await prisma.workflow.findMany({
        where: {
            tenantId: req.user!.tenantId,
            workflowNodes: {
                some: {
                    type: req.params.type,
                },
            },
        },
        include: {
            workflowNodes: true,
            _count: {
                select: {
                    workflowNodes: true,
                    workflowConnections: true,
                },
            },
        },
    });
    
    res.json(workflows);
});

// Find workflows with specific node count
router.get('/by-complexity', authenticate, async (req: AuthRequest, res: Response) => {
    const { minNodes, maxNodes } = req.query;
    
    const workflows = await prisma.workflow.findMany({
        where: {
            tenantId: req.user!.tenantId,
            workflowNodes: {
                // This is a bit tricky with Prisma, might need raw SQL
            },
        },
        include: {
            _count: {
                select: {
                    workflowNodes: true,
                },
            },
        },
    });
    
    // Filter in memory (or use raw SQL for better performance)
    const filtered = workflows.filter(w => {
        const count = w._count.workflowNodes;
        return count >= Number(minNodes) && count <= Number(maxNodes);
    });
    
    res.json(filtered);
});

// Find orphaned nodes (nodes with no connections)
router.get('/:id/orphaned-nodes', authenticate, async (req: AuthRequest, res: Response) => {
    const orphanedNodes = await prisma.workflowNode.findMany({
        where: {
            workflowId: req.params.id,
            AND: [
                { sourceConnections: { none: {} } },
                { targetConnections: { none: {} } },
            ],
        },
    });
    
    res.json(orphanedNodes);
});

// Get workflow statistics
router.get('/:id/stats', authenticate, async (req: AuthRequest, res: Response) => {
    const stats = await prisma.workflow.findUnique({
        where: { id: req.params.id },
        include: {
            _count: {
                select: {
                    workflowNodes: true,
                    workflowConnections: true,
                    executions: true,
                },
            },
            workflowNodes: {
                select: {
                    type: true,
                },
            },
        },
    });
    
    if (!stats) {
        return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Count nodes by type
    const nodesByType = stats.workflowNodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    res.json({
        totalNodes: stats._count.workflowNodes,
        totalConnections: stats._count.workflowConnections,
        totalExecutions: stats._count.executions,
        nodesByType,
    });
});
```

---

## Execution Service Updates

### Before (JSON)

```typescript
// execution.service.ts
async executeWorkflow(workflowId: string, input: ExecutionInput) {
    const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
    });
    
    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const connections = workflow.connections as unknown as WorkflowConnection[];
    
    // Execute workflow...
}
```

### After (Normalized)

```typescript
// execution.service.ts
async executeWorkflow(workflowId: string, input: ExecutionInput) {
    const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
            workflowNodes: {
                orderBy: { createdAt: 'asc' },
            },
            workflowConnections: {
                include: {
                    sourceNode: true,
                    targetNode: true,
                },
            },
        },
    });
    
    if (!workflow) {
        throw new Error('Workflow not found');
    }
    
    // Transform to old format for execution (temporary compatibility)
    const nodes: WorkflowNode[] = workflow.workflowNodes.map(node => ({
        id: node.id,
        type: node.type as WorkflowNodeType,
        title: node.title,
        position: {
            x: node.positionX,
            y: node.positionY,
        },
        config: node.config as NodeConfig,
        inputs: node.inputs as NodePort[],
        outputs: node.outputs as NodePort[],
    }));
    
    const connections: WorkflowConnection[] = workflow.workflowConnections.map(conn => ({
        id: conn.id,
        source: conn.sourceNodeId,
        target: conn.targetNodeId,
        sourcePort: conn.sourcePort ?? undefined,
        targetPort: conn.targetPort ?? undefined,
    }));
    
    // Execute workflow with transformed data
    return this.executeWorkflowInternal(workflow.id, nodes, connections, input);
}
```

---

## Helper Functions

Create reusable transformation functions:

```typescript
// utils/workflow-transform.ts

import { WorkflowNode as PrismaWorkflowNode, WorkflowConnection as PrismaWorkflowConnection } from '@prisma/client';
import { WorkflowNode, WorkflowConnection, NodePort, NodeConfig, WorkflowNodeType } from '../types/workflow.types';

export function transformNodeFromDB(dbNode: PrismaWorkflowNode): WorkflowNode {
    return {
        id: dbNode.id,
        type: dbNode.type as WorkflowNodeType,
        title: dbNode.title,
        position: {
            x: dbNode.positionX,
            y: dbNode.positionY,
        },
        config: dbNode.config as NodeConfig,
        inputs: dbNode.inputs as NodePort[] | undefined,
        outputs: dbNode.outputs as NodePort[] | undefined,
    };
}

export function transformConnectionFromDB(dbConn: PrismaWorkflowConnection): WorkflowConnection {
    return {
        id: dbConn.id,
        source: dbConn.sourceNodeId,
        target: dbConn.targetNodeId,
        sourcePort: dbConn.sourcePort ?? undefined,
        targetPort: dbConn.targetPort ?? undefined,
    };
}

export function transformNodeToDB(node: WorkflowNode) {
    return {
        type: node.type,
        title: node.title,
        positionX: node.position.x,
        positionY: node.position.y,
        config: node.config || null,
        inputs: node.inputs || null,
        outputs: node.outputs || null,
    };
}
```

Usage:

```typescript
import { transformNodeFromDB, transformConnectionFromDB } from '../utils/workflow-transform';

const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
        workflowNodes: true,
        workflowConnections: true,
    },
});

const nodes = workflow.workflowNodes.map(transformNodeFromDB);
const connections = workflow.workflowConnections.map(transformConnectionFromDB);
```

---

## Testing

### Unit Tests

```typescript
// workflow.service.test.ts
describe('WorkflowService', () => {
    it('should create workflow with normalized structure', async () => {
        const data = {
            name: 'Test Workflow',
            nodes: [
                {
                    id: 'node-1',
                    type: 'HTTP',
                    title: 'Fetch Data',
                    position: { x: 100, y: 100 },
                    config: { url: 'https://api.example.com' },
                },
                {
                    id: 'node-2',
                    type: 'Transform',
                    title: 'Process Data',
                    position: { x: 300, y: 100 },
                },
            ],
            connections: [
                {
                    id: 'conn-1',
                    source: 'node-1',
                    target: 'node-2',
                },
            ],
        };
        
        const workflow = await workflowService.create(data, userId, tenantId);
        
        expect(workflow.workflowNodes).toHaveLength(2);
        expect(workflow.workflowConnections).toHaveLength(1);
        expect(workflow.workflowNodes[0].type).toBe('HTTP');
    });
    
    it('should maintain referential integrity', async () => {
        // Create workflow
        const workflow = await workflowService.create(testData, userId, tenantId);
        
        // Delete workflow
        await workflowService.delete(workflow.id);
        
        // Verify nodes and connections are deleted (CASCADE)
        const nodes = await prisma.workflowNode.findMany({
            where: { workflowId: workflow.id },
        });
        
        const connections = await prisma.workflowConnection.findMany({
            where: { workflowId: workflow.id },
        });
        
        expect(nodes).toHaveLength(0);
        expect(connections).toHaveLength(0);
    });
});
```

---

## Performance Optimization

### Add Composite Indexes

```prisma
// schema.prisma
model WorkflowNode {
  // ... fields
  
  @@index([workflowId, type])  // For filtering by workflow and type
  @@index([type, createdAt])   // For analytics
}

model WorkflowConnection {
  // ... fields
  
  @@index([workflowId, sourceNodeId])  // For traversal queries
  @@index([workflowId, targetNodeId])  // For reverse traversal
}
```

### Use Select to Limit Data

```typescript
// Only fetch what you need
const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: {
        id: true,
        name: true,
        workflowNodes: {
            select: {
                id: true,
                type: true,
                title: true,
                // Don't fetch config if not needed
            },
        },
    },
});
```

---

## Summary

The normalized structure provides:

✅ **Better type safety** - Prisma validates relationships  
✅ **Easier queries** - Filter by node type, find connections  
✅ **Better performance** - Indexed queries vs JSON parsing  
✅ **Data integrity** - Foreign keys prevent orphaned data  
✅ **Scalability** - Efficient joins and aggregations  

All while maintaining backward compatibility during the transition!
