import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { SchedulerService } from '../services/scheduler.service';
import {
    workflowDefinitionSchema,
    workflowNodeSchema,
    workflowConnectionSchema,
    WorkflowNode,
    WorkflowConnection,
    WorkflowDefinition,
} from '../types/workflow.types';
import { WorkflowValidatorService, ValidationSeverity } from '../services/workflow-validator.service';
import { AuditService, AuditEventType } from '../audit/audit.service';
import {
    toSpec,
    fromSpec,
    specToYaml,
    yamlToSpec,
    RunbookSerializerError,
} from '../runbook/yaml/runbook-serializer';

const router = Router();

// Lazy singleton — same pattern as v1/audit.routes.ts and v1/approvals.routes.ts
let auditService: AuditService | null = null;
function getAudit(): AuditService {
    if (!auditService) auditService = new AuditService(prisma);
    return auditService;
}

/**
 * Fire-and-forget audit hook for workflow CRUD. Failures are swallowed
 * so a broken audit chain never blocks workflow management.
 */
async function safeAuditWorkflow(
    type: 'runbook.created' | 'runbook.updated' | 'runbook.deleted',
    params: {
        tenantId: string;
        actorId: string;
        workflowId: string;
        payload: Record<string, unknown>;
    },
): Promise<void> {
    try {
        await getAudit().record({
            tenantId: params.tenantId,
            type: type as AuditEventType,
            actorId: params.actorId,
            actorType: 'user',
            resource: params.workflowId,
            payload: params.payload,
        });
    } catch {
        // never block the response
    }
}

// Authentication disabled for free usage per n8n policies
// router.use(authenticate);

// Set default anonymous user for public API access
router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
            role: 'USER',
            tenantId: 'default-tenant',
        };
    }
    next();
});

/**
 * @swagger
 * /workflows:
 *   get:
 *     summary: List workflows
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workflow'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 *             example:
 *               workflows:
 *                 - id: "wf-123"
 *                   name: "New Order Processing"
 *                   description: "Handles Shopify orders"
 *                   isActive: true
 *                   updatedAt: "2024-03-21T15:30:00Z"
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 total: 1
 *                 pages: 1
 */
router.get('/', async (req: AuthRequest, res) => {
    try {
        const { page = '1', limit = '10', search = '' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where = {
            tenantId: req.user!.tenantId,
            ...(search && {
                OR: [
                    { name: { contains: search as string, mode: 'insensitive' as const } },
                    { description: { contains: search as string, mode: 'insensitive' as const } },
                ],
            }),
        };

        const [workflows, total] = await Promise.all([
            prisma.workflow.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                orderBy: { updatedAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    _count: { select: { executions: true } },
                },
            }),
            prisma.workflow.count({ where }),
        ]);

        res.json({
            workflows,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        req.log.error({ error }, 'Get workflows error');
        res.status(500).json({ error: 'Failed to get workflows' });
    }
});

/**
 * @swagger
 * /workflows/{id}:
 *   get:
 *     summary: Get a workflow by ID
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow details
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-123"
 *               name: "Daily Report"
 *               nodes:
 *                 - id: "node-1"
 *                   type: "Schedule"
 *                   position: { x: 0, y: 0 }
 *                   config: { cron: "0 0 * * *" }
 *               connections:
 *                 - id: "c-1"
 *                   source: "node-1"
 *                   target: "node-2"
 *               isActive: true
 *       404:
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Workflow not found"
 */
router.get('/:id', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.id as string;
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                executions: {
                    take: 10,
                    orderBy: { startedAt: 'desc' },
                },
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        res.json(workflow);
    } catch (error) {
        req.log.error({ error }, 'Get workflow error');
        res.status(500).json({ error: 'Failed to get workflow' });
    }
});

/**
 * @swagger
 * /workflows/{id}/metadata:
 *   get:
 *     summary: Get workflow metadata (updatedAt)
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 lastModified: { type: integer }
 *       404:
 *         description: Workflow not found
 */
router.get('/:id/metadata', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.id as string;
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
            select: {
                id: true,
                updatedAt: true,
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        res.json({
            id: workflow.id,
            lastModified: workflow.updatedAt.getTime(),
        });
    } catch (error) {
        req.log.error({ error }, 'Get workflow metadata error');
        res.status(500).json({ error: 'Failed to get workflow metadata' });
    }
});

/**
 * @swagger
 * /workflows:
 *   post:
 *     summary: Create a new workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, nodes, connections]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               schedule: { type: string }
 *               nodes: { type: array, items: { type: object } }
 *               connections: { type: array, items: { type: object } }
 *           example:
 *             name: "New Automation"
 *             description: "Created via API"
 *             nodes: []
 *             connections: []
 *             isActive: false
 *     responses:
 *       201:
 *         description: Workflow created
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-new-789"
 *               name: "New Automation"
 *               createdAt: "2024-03-22T09:00:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: "Name is required"
 */
router.post('/', async (req: AuthRequest, res) => {
    try {
        const data = workflowDefinitionSchema.parse(req.body);

        // Validate logic
        const validator = new WorkflowValidatorService();
        const validation = validator.validate(data as WorkflowDefinition);

        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Workflow validation failed',
                issues: validation.issues,
            });
        }

        const workflow = await prisma.workflow.create({
            data: {
                name: data.name,
                description: data.description,
                nodes: data.nodes as unknown as Prisma.InputJsonValue,
                connections: data.connections as unknown as Prisma.InputJsonValue,
                isActive: data.isActive || false,
                schedule: data.schedule,
                userId: req.user!.id,
                tenantId: req.user!.tenantId,
            },
        });

        if (data.schedule && data.isActive) {
            await prisma.scheduledJob.create({
                data: {
                    workflowId: workflow.id,
                    cronExpr: data.schedule,
                    isActive: true,
                },
            });
        }

        await safeAuditWorkflow('runbook.created', {
            tenantId: req.user!.tenantId,
            actorId: req.user!.id,
            workflowId: workflow.id,
            payload: {
                workflowId: workflow.id,
                name: workflow.name,
                isActive: workflow.isActive,
                schedule: workflow.schedule ?? null,
                nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
                connectionCount: Array.isArray(data.connections) ? data.connections.length : 0,
            },
        });

        res.status(201).json(workflow);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Create workflow error');
        res.status(500).json({ error: 'Failed to create workflow' });
    }
});

/**
 * @swagger
 * /workflows/{id}:
 *   put:
 *     summary: Update a workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               schedule: { type: string }
 *               nodes: { type: array, items: { type: object } }
 *               connections: { type: array, items: { type: object } }
 *           example:
 *             isActive: true
 *             schedule: "0 * * * *"
 *     responses:
 *       200:
 *         description: Workflow updated
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-123"
 *               isActive: true
 *               schedule: "0 * * * *"
 *       404:
 *         description: Workflow not found
 */
/**
 * GET /workflows/:id/yaml
 *
 * Return the runbook in canonical YAML form. Used by the YAML view in
 * the editor and by the CLI/Git workflows that prefer text-based
 * runbook authoring.
 */
router.get('/:id/yaml', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.id as string;
        const workflow = await prisma.workflow.findFirst({
            where: { id: workflowId, tenantId: req.user!.tenantId },
            include: {
                workflowNodes: true,
                workflowConnections: true,
            },
        });
        if (!workflow) return res.status(404).json({ error: 'Runbook not found' });

        const spec = toSpec(
            {
                id: workflow.id,
                slug: workflow.slug,
                name: workflow.name,
                description: workflow.description,
                category: workflow.category,
                schedule: workflow.schedule,
            },
            workflow.workflowNodes.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                positionX: n.positionX,
                positionY: n.positionY,
                enabled: n.enabled,
                config: n.config,
            })),
            workflow.workflowConnections.map((c) => ({
                sourceNodeId: c.sourceNodeId,
                sourcePort: c.sourcePort,
                targetNodeId: c.targetNodeId,
                targetPort: c.targetPort,
            })),
        );

        const yamlText = specToYaml(spec);
        res.setHeader('Content-Type', 'application/x-yaml');
        res.send(yamlText);
    } catch (error) {
        req.log.error({ error }, 'Get runbook YAML error');
        res.status(500).json({ error: 'Failed to get runbook YAML' });
    }
});

/**
 * PUT /workflows/:id/yaml
 *
 * Replace the runbook contents with a new YAML body. Performs a full
 * replace of nodes + connections within a transaction. Header fields
 * (name, slug, description, category, schedule) are also updated.
 *
 * This is intentionally a destructive replace, not a merge — the YAML
 * IS the source of truth when this endpoint is used. The visual editor
 * uses PUT /:id which preserves the row-level diff.
 */
router.put('/:id/yaml', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.id as string;
        const yamlText = typeof req.body === 'string' ? req.body : (req.body?.yaml as string);
        if (!yamlText || typeof yamlText !== 'string') {
            return res.status(400).json({ error: 'Body must contain YAML text', code: 'missing_yaml' });
        }

        const existing = await prisma.workflow.findFirst({
            where: { id: workflowId, tenantId: req.user!.tenantId },
        });
        if (!existing) return res.status(404).json({ error: 'Runbook not found' });

        let parsed;
        try {
            const spec = yamlToSpec(yamlText);
            parsed = fromSpec(spec);
        } catch (err) {
            if (err instanceof RunbookSerializerError) {
                return res.status(400).json({ error: err.message, code: err.code });
            }
            throw err;
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.workflowConnection.deleteMany({ where: { workflowId } });
            await tx.workflowNode.deleteMany({ where: { workflowId } });

            await tx.workflow.update({
                where: { id: workflowId },
                data: {
                    name: parsed.header.name,
                    slug: parsed.header.slug,
                    description: parsed.header.description,
                    category: parsed.header.category,
                    schedule: parsed.header.schedule,
                },
            });

            for (const node of parsed.nodes) {
                await tx.workflowNode.create({
                    data: {
                        id: node.id,
                        workflowId,
                        type: node.type,
                        title: node.title,
                        positionX: node.positionX,
                        positionY: node.positionY,
                        enabled: node.enabled,
                        config: (node.config as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                    },
                });
            }
            for (const conn of parsed.connections) {
                await tx.workflowConnection.create({
                    data: {
                        workflowId,
                        sourceNodeId: conn.sourceNodeId,
                        sourcePort: conn.sourcePort,
                        targetNodeId: conn.targetNodeId,
                        targetPort: conn.targetPort,
                    },
                });
            }

            return tx.workflow.findFirst({
                where: { id: workflowId },
                include: { workflowNodes: true, workflowConnections: true },
            });
        });

        res.json({
            id: updated!.id,
            name: updated!.name,
            slug: updated!.slug,
            updatedAt: updated!.updatedAt,
            stepCount: updated!.workflowNodes.length,
        });
    } catch (error) {
        req.log.error({ error }, 'Put runbook YAML error');
        res.status(500).json({ error: 'Failed to update runbook YAML' });
    }
});

router.put('/:id', async (req: AuthRequest, res) => {
    try {
        // Use partial schema for updates - only nodes and connections are required
        const updateSchema = z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            nodes: z.array(workflowNodeSchema),
            connections: z.array(workflowConnectionSchema),
            isActive: z.boolean().optional(),
            schedule: z.string().optional(),
            version: z.string().optional(), // Allow version field from frontend
            lastModified: z.number().optional(), // Allow lastModified field from frontend
        });

        const data = updateSchema.parse(req.body);
        const workflowId = req.params.id as string;

        const existing = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        if (!existing) {
            // Special handling for the default 'current-workflow' (scratchpad)
            // If it doesn't exist, we create it instead of returning 404
            if (workflowId === 'current-workflow') {
                const newWorkflow = await prisma.workflow.create({
                    data: {
                        id: 'current-workflow',
                        name: data.name || 'Untitled Workflow',
                        description: data.description,
                        nodes: data.nodes as unknown as Prisma.InputJsonValue,
                        connections: data.connections as unknown as Prisma.InputJsonValue,
                        isActive: data.isActive || false,
                        schedule: data.schedule,
                        userId: req.user!.id,
                        tenantId: req.user!.tenantId,
                    },
                });

                if (data.schedule && data.isActive) {
                    await prisma.scheduledJob.create({
                        data: {
                            workflowId: newWorkflow.id,
                            cronExpr: data.schedule,
                            isActive: true,
                        },
                    });
                }

                await safeAuditWorkflow('runbook.created', {
                    tenantId: req.user!.tenantId,
                    actorId: req.user!.id,
                    workflowId: newWorkflow.id,
                    payload: {
                        workflowId: newWorkflow.id,
                        name: newWorkflow.name,
                        isActive: newWorkflow.isActive,
                        schedule: newWorkflow.schedule ?? null,
                        scratchpad: true,
                    },
                });

                return res.json({
                    ...newWorkflow,
                    timestamp: newWorkflow.updatedAt.getTime(),
                });
            }

            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Build update data object, only including fields that were provided
        const updateData: any = {
            nodes: data.nodes as unknown as Prisma.InputJsonValue,
            connections: data.connections as unknown as Prisma.InputJsonValue,
        };

        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.schedule !== undefined) updateData.schedule = data.schedule;

        // Construct full workflow object for validation
        const fullWorkflowForValidation: WorkflowDefinition = {
            name: updateData.name || existing.name,
            description: updateData.description || existing.description,
            nodes: (updateData.nodes || existing.nodes) as WorkflowNode[],
            connections: (updateData.connections || existing.connections) as WorkflowConnection[],
            isActive: updateData.isActive ?? existing.isActive,
            schedule: updateData.schedule ?? existing.schedule,
        };

        const validator = new WorkflowValidatorService();
        const validation = validator.validate(fullWorkflowForValidation);

        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Workflow validation failed',
                issues: validation.issues,
            });
        }

        const workflow = await prisma.workflow.update({
            where: { id: workflowId },
            data: updateData,
        });

        await safeAuditWorkflow('runbook.updated', {
            tenantId: req.user!.tenantId,
            actorId: req.user!.id,
            workflowId: workflow.id,
            payload: {
                workflowId: workflow.id,
                name: workflow.name,
                isActive: workflow.isActive,
                schedule: workflow.schedule ?? null,
                changedFields: Object.keys(updateData),
                nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
                connectionCount: Array.isArray(data.connections) ? data.connections.length : 0,
            },
        });

        if (data.schedule) {
            await prisma.scheduledJob.upsert({
                where: { workflowId: workflow.id },
                create: {
                    workflowId: workflow.id,
                    cronExpr: data.schedule,
                    isActive: data.isActive || false,
                },
                update: {
                    cronExpr: data.schedule,
                    isActive: data.isActive || false,
                },
            });
        }

        res.json({
            ...workflow,
            timestamp: workflow.updatedAt.getTime(),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            req.log.error({ error: error.errors }, 'Validation error');
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Update workflow error');
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

/**
 * @swagger
 * /workflows/{id}:
 *   delete:
 *     summary: Delete a workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Workflow deleted
 *       404:
 *         description: Workflow not found
 */
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.id as string;
        const existing = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        if (!existing) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        await prisma.scheduledJob.deleteMany({
            where: { workflowId },
        });

        await prisma.workflow.delete({
            where: { id: workflowId },
        });

        await safeAuditWorkflow('runbook.deleted', {
            tenantId: req.user!.tenantId,
            actorId: req.user!.id,
            workflowId,
            payload: {
                workflowId,
                name: existing.name,
            },
        });

        res.status(204).send();
    } catch (error) {
        req.log.error({ error }, 'Delete workflow error');
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

/**
 * @swagger
 * /workflows/{id}/duplicate:
 *   post:
 *     summary: Duplicate a workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Workflow duplicated
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-copy-456"
 *               name: "Original Name (Copy)"
 *               nodes: []
 *       404:
 *         description: Workflow not found
 */
router.post('/:id/duplicate', async (req: AuthRequest, res) => {
    try {
        const workflowId = req.params.id as string;
        const existing = await prisma.workflow.findFirst({
            where: {
                id: workflowId,
                tenantId: req.user!.tenantId,
            },
        });

        if (!existing) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Cast Prisma JSON fields for the duplicate
        const workflow = await prisma.workflow.create({
            data: {
                name: `${existing.name} (Copy)`,
                description: existing.description,
                nodes: existing.nodes as Prisma.InputJsonValue,
                connections: existing.connections as Prisma.InputJsonValue,
                isActive: false,
                userId: req.user!.id,
                tenantId: req.user!.tenantId,
            },
        });

        await safeAuditWorkflow('runbook.created', {
            tenantId: req.user!.tenantId,
            actorId: req.user!.id,
            workflowId: workflow.id,
            payload: {
                workflowId: workflow.id,
                name: workflow.name,
                duplicatedFrom: existing.id,
            },
        });

        res.status(201).json(workflow);
    } catch (error) {
        req.log.error({ error }, 'Duplicate workflow error');
        res.status(500).json({ error: 'Failed to duplicate workflow' });
    }
});

export default router;
