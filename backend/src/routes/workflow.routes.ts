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

const router = Router();

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
        let workflow = await prisma.workflow.findFirst({
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

        // Special handling for 'current-workflow' scratchpad
        if (!workflow && workflowId === 'current-workflow') {
             workflow = await prisma.workflow.create({
                data: {
                    id: 'current-workflow',
                    name: 'Borrador (Scratchpad)',
                    description: 'Tu espacio de trabajo temporal',
                    nodes: [],
                    connections: [],
                    isActive: false,
                    userId: req.user!.id,
                    tenantId: req.user!.tenantId,
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    executions: true,
                },
            });
        }

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

        res.status(201).json(workflow);
    } catch (error) {
        req.log.error({ error }, 'Duplicate workflow error');
        res.status(500).json({ error: 'Failed to duplicate workflow' });
    }
});

export default router;
