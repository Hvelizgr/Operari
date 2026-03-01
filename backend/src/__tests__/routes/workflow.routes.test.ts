import express from 'express';
import request from 'supertest';

// Mock dependencies BEFORE importing routes
jest.mock('../../server', () => ({
    prisma: {
        workflow: {
            findMany: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        scheduledJob: {
            create: jest.fn(),
            upsert: jest.fn(),
            deleteMany: jest.fn(),
        },
    },
}));

import workflowRouter from '../../routes/workflow.routes';
import { prisma } from '../../server';

describe('Workflow Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        // Mount router
        app.use('/workflows', workflowRouter);
    });

    // Mock data
    const mockUser = { id: 'anonymous', tenantId: 'default-tenant' };
    const mockWorkflow = {
        id: 'wf-1',
        name: 'Test Workflow',
        nodes: [],
        connections: [],
        userId: mockUser.id,
        tenantId: mockUser.tenantId,
        updatedAt: new Date(),
        user: { id: 'anonymous', name: 'Anonymous', email: 'anon@test' },
        _count: { executions: 5 },
    };

    describe('GET /workflows', () => {
        it('should return list of workflows', async () => {
            (prisma.workflow.findMany as jest.Mock).mockResolvedValue([mockWorkflow]);
            (prisma.workflow.count as jest.Mock).mockResolvedValue(1);

            const res = await request(app).get('/workflows');

            expect(res.status).toBe(200);
            expect(res.body.workflows).toHaveLength(1);
            expect(res.body.workflows[0].id).toBe('wf-1');
            expect(prisma.workflow.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ tenantId: 'default-tenant' }),
                take: 10,
                skip: 0
            }));
        });

        it('should support pagination', async () => {
            (prisma.workflow.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.workflow.count as jest.Mock).mockResolvedValue(0);

            await request(app).get('/workflows?page=2&limit=5');

            expect(prisma.workflow.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 5,
                take: 5
            }));
        });
    });

    describe('GET /workflows/:id', () => {
        it('should return workflow details', async () => {
            (prisma.workflow.findFirst as jest.Mock).mockResolvedValue(mockWorkflow);

            const res = await request(app).get('/workflows/wf-1');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('wf-1');
            expect(prisma.workflow.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'wf-1', tenantId: 'default-tenant' }
            }));
        });

        it('should return 404 if not found', async () => {
            (prisma.workflow.findFirst as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/workflows/wf-nonexistent');

            expect(res.status).toBe(404);
        });
    });

    describe('POST /workflows', () => {
        const newWorkflowData = {
            name: 'New Workflow',
            description: 'Desc',
            nodes: [],
            connections: [],
            isActive: false,
        };

        it('should create a new workflow', async () => {
            (prisma.workflow.create as jest.Mock).mockResolvedValue({
                ...mockWorkflow,
                ...newWorkflowData,
                id: 'new-wf',
            });

            const res = await request(app)
                .post('/workflows')
                .send(newWorkflowData);

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('new-wf');
            expect(prisma.workflow.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    name: 'New Workflow',
                    tenantId: 'default-tenant'
                })
            }));
        });

        it('should validate input', async () => {
            const res = await request(app)
                .post('/workflows')
                .send({ description: 'Missing name' }); // Missing required fields

            expect(res.status).toBe(400);
            // Zod error structure roughly
            expect(res.body.error).toBeDefined();
        });
    });

    describe('PUT /workflows/:id', () => {
        const updateData = {
            name: 'Updated Name',
            nodes: [], // Required by schema
            connections: [], // Required by schema
        };

        it('should update existing workflow', async () => {
            (prisma.workflow.findFirst as jest.Mock).mockResolvedValue(mockWorkflow);
            (prisma.workflow.update as jest.Mock).mockResolvedValue({
                ...mockWorkflow,
                name: 'Updated Name',
            });

            const res = await request(app)
                .put('/workflows/wf-1')
                .send(updateData);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Name');
            expect(prisma.workflow.update).toHaveBeenCalled();
        });

        it('should create scratchpad workflow if not exists', async () => {
            (prisma.workflow.findFirst as jest.Mock).mockResolvedValue(null); // Not found
            (prisma.workflow.create as jest.Mock).mockResolvedValue({
                ...mockWorkflow,
                id: 'current-workflow',
                name: 'Updated Name',
            });

            const res = await request(app)
                .put('/workflows/current-workflow')
                .send(updateData);

            expect(res.status).toBe(200);
            expect(prisma.workflow.create).toHaveBeenCalled();
        });
    });

    describe('DELETE /workflows/:id', () => {
        it('should delete workflow', async () => {
            (prisma.workflow.findFirst as jest.Mock).mockResolvedValue(mockWorkflow);

            const res = await request(app).delete('/workflows/wf-1');

            expect(res.status).toBe(204);
            expect(prisma.workflow.delete).toHaveBeenCalledWith({
                where: { id: 'wf-1' }
            });
        });
    });
});
