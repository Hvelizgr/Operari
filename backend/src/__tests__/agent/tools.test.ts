import type { PrismaClient } from '@prisma/client';
import { buildOrchestratorTools } from '../../agent/tools';

// ---------------------------------------------------------------------------
// Fake Prisma
// ---------------------------------------------------------------------------

function fakePrisma(overrides: Record<string, any> = {}): PrismaClient {
    return {
        execution: {
            findMany: jest.fn(async (args: any) => overrides.executions ?? []),
            findFirst: jest.fn(async (args: any) => overrides.execution ?? null),
        },
        nodeLog: {
            findFirst: jest.fn(async (args: any) => overrides.nodeLog ?? null),
        },
        workflow: {
            findMany: jest.fn(async (args: any) => overrides.workflows ?? []),
        },
    } as unknown as PrismaClient;
}

const TENANT = 'tenant-1';

describe('buildOrchestratorTools', () => {
    it('exposes all five tools', () => {
        const tools = buildOrchestratorTools(fakePrisma(), TENANT);
        expect(Object.keys(tools).sort()).toEqual([
            'get_run_details',
            'get_step_logs',
            'list_recent_runs',
            'list_runbooks',
            'search_runs_by_error',
        ]);
    });

    // ---------------------------------------------------------------
    // list_recent_runs
    // ---------------------------------------------------------------
    describe('list_recent_runs', () => {
        it('returns runs scoped to the tenant', async () => {
            const prisma = fakePrisma({
                executions: [
                    {
                        id: 'run-1',
                        status: 'SUCCESS',
                        trigger: 'MANUAL',
                        startedAt: new Date('2026-04-01T10:00:00Z'),
                        duration: 1500,
                        error: null,
                        workflow: { slug: 'deploy', name: 'Deploy Frontend' },
                    },
                ],
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.list_recent_runs.execute({ status: 'ANY', limit: 10 });

            expect(result.runs).toHaveLength(1);
            expect(result.runs[0]).toEqual({
                id: 'run-1',
                runbook: 'Deploy Frontend',
                slug: 'deploy',
                status: 'SUCCESS',
                trigger: 'MANUAL',
                startedAt: '2026-04-01T10:00:00.000Z',
                durationMs: 1500,
                error: null,
            });
            // Verify tenant was passed to the query
            expect(prisma.execution.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workflow: { tenantId: TENANT },
                    }),
                }),
            );
        });

        it('filters by status when not ANY', async () => {
            const prisma = fakePrisma();
            const tools = buildOrchestratorTools(prisma, TENANT);
            await tools.list_recent_runs.execute({ status: 'FAILED', limit: 5 });

            expect(prisma.execution.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workflow: { tenantId: TENANT },
                        status: 'FAILED',
                    }),
                    take: 5,
                }),
            );
        });

        it('does not filter status when ANY', async () => {
            const prisma = fakePrisma();
            const tools = buildOrchestratorTools(prisma, TENANT);
            await tools.list_recent_runs.execute({ status: 'ANY', limit: 10 });

            const call = (prisma.execution.findMany as jest.Mock).mock.calls[0][0];
            expect(call.where).not.toHaveProperty('status');
        });
    });

    // ---------------------------------------------------------------
    // get_run_details
    // ---------------------------------------------------------------
    describe('get_run_details', () => {
        it('returns a tenant-scoped run with step logs', async () => {
            const prisma = fakePrisma({
                execution: {
                    id: 'run-1',
                    status: 'FAILED',
                    trigger: 'WEBHOOK',
                    startedAt: new Date('2026-04-01T10:00:00Z'),
                    completedAt: new Date('2026-04-01T10:01:00Z'),
                    duration: 60000,
                    error: 'Step migrate failed',
                    workflow: { slug: 'db-migrate', name: 'DB Migrate' },
                    nodeLogs: [
                        {
                            nodeId: 'step-1',
                            nodeName: 'checkout',
                            nodeType: 'shell',
                            status: 'SUCCESS',
                            duration: 500,
                            output: 'checked out',
                            error: null,
                        },
                        {
                            nodeId: 'step-2',
                            nodeName: 'migrate',
                            nodeType: 'nanorun.database',
                            status: 'FAILED',
                            duration: 59500,
                            output: null,
                            error: 'relation does not exist',
                        },
                    ],
                },
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.get_run_details.execute({ runId: 'run-1' });

            expect(result.id).toBe('run-1');
            expect(result.steps).toHaveLength(2);
            expect(result.steps[1].status).toBe('FAILED');
            expect(result.steps[1].error).toBe('relation does not exist');

            expect(prisma.execution.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: 'run-1',
                        workflow: { tenantId: TENANT },
                    },
                }),
            );
        });

        it('truncates long outputs to 2KB', async () => {
            const longOutput = 'x'.repeat(3000);
            const prisma = fakePrisma({
                execution: {
                    id: 'run-1',
                    status: 'SUCCESS',
                    trigger: 'MANUAL',
                    startedAt: new Date(),
                    completedAt: new Date(),
                    duration: 100,
                    error: null,
                    workflow: { slug: 's', name: 'S' },
                    nodeLogs: [{
                        nodeId: 'step-1',
                        nodeName: 'long',
                        nodeType: 'shell',
                        status: 'SUCCESS',
                        duration: 100,
                        output: longOutput,
                        error: null,
                    }],
                },
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.get_run_details.execute({ runId: 'run-1' });

            expect(result.steps[0].output.length).toBeLessThanOrEqual(2100);
            expect(result.steps[0].output).toContain('[truncated]');
        });

        it('returns run_not_found when the run is not in the tenant', async () => {
            const prisma = fakePrisma({ execution: null });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.get_run_details.execute({ runId: 'missing' });
            expect(result).toEqual({ error: 'run_not_found' });
        });
    });

    // ---------------------------------------------------------------
    // get_step_logs
    // ---------------------------------------------------------------
    describe('get_step_logs', () => {
        it('returns raw stdout for a step', async () => {
            const prisma = fakePrisma({
                nodeLog: {
                    nodeId: 'step-1',
                    nodeName: 'build',
                    nodeType: 'shell',
                    status: 'SUCCESS',
                    duration: 2500,
                    output: 'Building...\nDone.',
                    error: null,
                    startedAt: new Date('2026-04-01T10:00:00Z'),
                    completedAt: new Date('2026-04-01T10:00:02Z'),
                },
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.get_step_logs.execute({
                runId: 'run-1',
                stepId: 'step-1',
            });

            expect(result.stdout).toBe('Building...\nDone.');
            expect(result.name).toBe('build');
            expect(result.status).toBe('SUCCESS');
        });

        it('truncates stdout at 8KB', async () => {
            const big = 'a'.repeat(10000);
            const prisma = fakePrisma({
                nodeLog: {
                    nodeId: 'step-1',
                    nodeName: 'big',
                    nodeType: 'shell',
                    status: 'SUCCESS',
                    duration: 1000,
                    output: big,
                    error: null,
                    startedAt: new Date(),
                    completedAt: new Date(),
                },
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.get_step_logs.execute({
                runId: 'run-1',
                stepId: 'step-1',
            });

            expect(result.stdout.length).toBeLessThanOrEqual(8100);
            expect(result.stdout).toContain('[truncated at 8KB]');
        });

        it('enforces tenant isolation in the query', async () => {
            const prisma = fakePrisma();
            const tools = buildOrchestratorTools(prisma, TENANT);
            await tools.get_step_logs.execute({ runId: 'r', stepId: 's' });

            expect(prisma.nodeLog.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        execution: { workflow: { tenantId: TENANT } },
                    }),
                }),
            );
        });

        it('serializes non-string output as JSON', async () => {
            const prisma = fakePrisma({
                nodeLog: {
                    nodeId: 'step-1',
                    nodeName: 'http',
                    nodeType: 'nanorun.httpRequest',
                    status: 'SUCCESS',
                    duration: 300,
                    output: { status: 200, body: { ok: true } },
                    error: null,
                    startedAt: new Date(),
                    completedAt: new Date(),
                },
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.get_step_logs.execute({ runId: 'r', stepId: 'step-1' });

            expect(result.stdout).toContain('"status":200');
            expect(result.stdout).toContain('"ok":true');
        });

        it('returns step_not_found on miss', async () => {
            const tools = buildOrchestratorTools(fakePrisma({ nodeLog: null }), TENANT);
            const result = await tools.get_step_logs.execute({ runId: 'r', stepId: 's' });
            expect(result).toEqual({ error: 'step_not_found' });
        });
    });

    // ---------------------------------------------------------------
    // search_runs_by_error
    // ---------------------------------------------------------------
    describe('search_runs_by_error', () => {
        it('searches runs by error pattern case-insensitively', async () => {
            const prisma = fakePrisma({
                executions: [
                    {
                        id: 'run-1',
                        status: 'FAILED',
                        startedAt: new Date('2026-04-01T10:00:00Z'),
                        error: 'ECONNREFUSED at db:5432',
                        workflow: { slug: 'db', name: 'DB Check' },
                    },
                    {
                        id: 'run-2',
                        status: 'FAILED',
                        startedAt: new Date('2026-04-02T10:00:00Z'),
                        error: 'ECONNREFUSED at db:5432',
                        workflow: { slug: 'db', name: 'DB Check' },
                    },
                ],
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.search_runs_by_error.execute({
                pattern: 'ECONNREFUSED',
                limit: 10,
            });

            expect(result.matchCount).toBe(2);
            expect(result.runs[0].id).toBe('run-1');
            expect(prisma.execution.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workflow: { tenantId: TENANT },
                        error: { contains: 'ECONNREFUSED', mode: 'insensitive' },
                    }),
                }),
            );
        });

        it('truncates long error messages to 500 chars', async () => {
            const longErr = 'stacktrace: ' + 'x'.repeat(800);
            const prisma = fakePrisma({
                executions: [{
                    id: 'run-1',
                    status: 'FAILED',
                    startedAt: new Date(),
                    error: longErr,
                    workflow: { slug: 'x', name: 'X' },
                }],
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.search_runs_by_error.execute({
                pattern: 'stacktrace',
                limit: 5,
            });

            expect(result.runs[0].error.length).toBeLessThanOrEqual(502);
            expect(result.runs[0].error.endsWith('…')).toBe(true);
        });

        it('returns empty on no matches', async () => {
            const tools = buildOrchestratorTools(fakePrisma({ executions: [] }), TENANT);
            const result = await tools.search_runs_by_error.execute({
                pattern: 'nothing',
                limit: 10,
            });
            expect(result.matchCount).toBe(0);
            expect(result.runs).toEqual([]);
        });
    });

    // ---------------------------------------------------------------
    // list_runbooks
    // ---------------------------------------------------------------
    describe('list_runbooks', () => {
        it('lists runbooks for the tenant', async () => {
            const prisma = fakePrisma({
                workflows: [
                    {
                        id: 'wf-1',
                        slug: 'deploy',
                        name: 'Deploy',
                        description: 'Deploy to prod',
                        category: 'deploy',
                        isActive: true,
                        updatedAt: new Date('2026-04-01T00:00:00Z'),
                    },
                ],
            });
            const tools = buildOrchestratorTools(prisma, TENANT);
            const result = await tools.list_runbooks.execute({ limit: 20 });

            expect(result.runbooks).toHaveLength(1);
            expect(result.runbooks[0].slug).toBe('deploy');
            expect(prisma.workflow.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ tenantId: TENANT }),
                }),
            );
        });

        it('filters by category when provided', async () => {
            const prisma = fakePrisma();
            const tools = buildOrchestratorTools(prisma, TENANT);
            await tools.list_runbooks.execute({ category: 'incident', limit: 10 });

            expect(prisma.workflow.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tenantId: TENANT,
                        category: 'incident',
                    }),
                }),
            );
        });
    });

    // ---------------------------------------------------------------
    // Tenant isolation — bound at construction time
    // ---------------------------------------------------------------
    describe('tenant isolation', () => {
        it('binds tenantId at construction so tools cannot leak cross-tenant', async () => {
            const prisma = fakePrisma();
            const toolsA = buildOrchestratorTools(prisma, 'tenant-a');
            const toolsB = buildOrchestratorTools(prisma, 'tenant-b');

            await toolsA.list_recent_runs.execute({ status: 'ANY', limit: 10 });
            await toolsB.list_recent_runs.execute({ status: 'ANY', limit: 10 });

            const calls = (prisma.execution.findMany as jest.Mock).mock.calls;
            expect(calls[0][0].where.workflow.tenantId).toBe('tenant-a');
            expect(calls[1][0].where.workflow.tenantId).toBe('tenant-b');
        });
    });
});
