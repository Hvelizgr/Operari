import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

// Mock dependencies BEFORE importing routes
jest.mock('../../server', () => ({
    prisma: {
        runbook: {
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

import runbookRouter from '../../routes/runbook.routes';
import { prisma } from '../../server';

describe('Runbook routes', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        // Inject a no-op pino-compatible logger so the route handlers
        // that call `req.log.error(...)` from their catch blocks don't
        // explode in tests. The production pinoHttp middleware adds
        // this for real, but tests mount the router on a bare express
        // app and skip middleware setup.
        app.use((req, _res, next) => {
            (req as any).log = {
                error: () => { /* noop */ },
                warn: () => { /* noop */ },
                info: () => { /* noop */ },
                debug: () => { /* noop */ },
                child: () => (req as any).log,
            };
            next();
        });
        // Mount router on the legacy path so the existing fixtures keep working.
        app.use('/workflows', runbookRouter);
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
            (prisma.runbook.findMany as jest.Mock).mockResolvedValue([mockWorkflow]);
            (prisma.runbook.count as jest.Mock).mockResolvedValue(1);

            const res = await request(app).get('/workflows');

            expect(res.status).toBe(200);
            expect(res.body.workflows).toHaveLength(1);
            expect(res.body.workflows[0].id).toBe('wf-1');
            expect(prisma.runbook.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ tenantId: 'default-tenant' }),
                take: 10,
                skip: 0
            }));
        });

        it('should support pagination', async () => {
            (prisma.runbook.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.runbook.count as jest.Mock).mockResolvedValue(0);

            await request(app).get('/workflows?page=2&limit=5');

            expect(prisma.runbook.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 5,
                take: 5
            }));
        });
    });

    describe('GET /workflows/:id', () => {
        it('should return workflow details', async () => {
            (prisma.runbook.findFirst as jest.Mock).mockResolvedValue(mockWorkflow);

            const res = await request(app).get('/workflows/wf-1');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('wf-1');
            expect(prisma.runbook.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'wf-1', tenantId: 'default-tenant' }
            }));
        });

        it('should return 404 if not found', async () => {
            (prisma.runbook.findFirst as jest.Mock).mockResolvedValue(null);

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
            (prisma.runbook.create as jest.Mock).mockResolvedValue({
                ...mockWorkflow,
                ...newWorkflowData,
                id: 'new-wf',
            });

            const res = await request(app)
                .post('/workflows')
                .send(newWorkflowData);

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('new-wf');
            expect(prisma.runbook.create).toHaveBeenCalledWith(expect.objectContaining({
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
            (prisma.runbook.findFirst as jest.Mock).mockResolvedValue(mockWorkflow);
            (prisma.runbook.update as jest.Mock).mockResolvedValue({
                ...mockWorkflow,
                name: 'Updated Name',
            });

            const res = await request(app)
                .put('/workflows/wf-1')
                .send(updateData);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Name');
            expect(prisma.runbook.update).toHaveBeenCalled();
        });

        it('should create scratchpad workflow if not exists', async () => {
            (prisma.runbook.findFirst as jest.Mock).mockResolvedValue(null); // Not found
            (prisma.runbook.create as jest.Mock).mockResolvedValue({
                ...mockWorkflow,
                id: 'current-workflow',
                name: 'Updated Name',
            });

            const res = await request(app)
                .put('/workflows/current-workflow')
                .send(updateData);

            expect(res.status).toBe(200);
            expect(prisma.runbook.create).toHaveBeenCalled();
        });
    });

    describe('DELETE /workflows/:id', () => {
        it('should delete workflow', async () => {
            (prisma.runbook.findFirst as jest.Mock).mockResolvedValue(mockWorkflow);

            const res = await request(app).delete('/workflows/wf-1');

            expect(res.status).toBe(204);
            expect(prisma.runbook.delete).toHaveBeenCalledWith({
                where: { id: 'wf-1' }
            });
        });
    });
});
