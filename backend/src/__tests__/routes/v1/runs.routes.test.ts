import express from 'express';
import request from 'supertest';

// Mock the prisma re-export from server before importing the router
jest.mock('../../../server', () => ({
  prisma: {
    execution: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock the API key middleware so we can inject a fake apiContext
jest.mock('../../../middleware/api-key.middleware', () => ({
  requireApiKey: (_scope?: string) => (req: any, _res: any, next: any) => {
    req.apiContext = (global as any).__fakeApiContext ?? {
      keyId: 'k-1',
      tenantId: 'tenant-1',
      scopes: ['runs:read'],
    };
    next();
  },
}));

import runsRouter from '../../../routes/v1/runs.routes';
import { prisma as mockedPrisma } from '../../../server';

const findManyMock = (mockedPrisma as unknown as { execution: { findMany: jest.Mock } }).execution
  .findMany;
const findFirstMock = (mockedPrisma as unknown as { execution: { findFirst: jest.Mock } }).execution
  .findFirst;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/runs', runsRouter);
  return app;
};

const mkRun = (over: Record<string, unknown> = {}) => ({
  id: 'run-1',
  runbook: { id: 'wf-1', slug: 'deploy', name: 'Deploy' },
  status: 'SUCCESS',
  trigger: 'MANUAL',
  startedAt: new Date('2026-04-07T00:00:00Z'),
  completedAt: new Date('2026-04-07T00:01:00Z'),
  duration: 60000,
  error: null,
  ...over,
});

describe('GET /api/v1/runs (list)', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('returns recent runs scoped via runbook.tenantId', async () => {
    findManyMock.mockResolvedValue([mkRun()]);
    const res = await request(buildApp()).get('/api/v1/runs');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('run-1');
    expect(res.body.data[0].runbook.slug).toBe('deploy');
    expect(res.body.nextCursor).toBeNull();

    const args = findManyMock.mock.calls[0][0];
    expect(args.where.runbook.tenantId).toBe('tenant-1');
    // No status filter by default (returns all)
    expect(args.where.status).toBeUndefined();
  });

  it('?status=FAILED filters by FAILED', async () => {
    findManyMock.mockResolvedValue([]);
    await request(buildApp()).get('/api/v1/runs?status=FAILED');
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.status).toEqual({ in: ['FAILED'] });
  });

  it('?status=all is the same as omitting the filter', async () => {
    findManyMock.mockResolvedValue([]);
    await request(buildApp()).get('/api/v1/runs?status=all');
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.status).toBeUndefined();
  });

  it('rejects an unknown status with 400', async () => {
    const res = await request(buildApp()).get('/api/v1/runs?status=foo');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_status');
  });

  it('?runbook=<slug> filters via runbook.OR (id or slug)', async () => {
    findManyMock.mockResolvedValue([]);
    await request(buildApp()).get('/api/v1/runs?runbook=deploy');
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.runbook.OR).toEqual([{ id: 'deploy' }, { slug: 'deploy' }]);
  });

  it('returns nextCursor when more rows are available', async () => {
    findManyMock.mockResolvedValue([
      mkRun({ id: 'run-1' }),
      mkRun({ id: 'run-2' }),
      mkRun({ id: 'run-3' }),
    ]);
    const res = await request(buildApp()).get('/api/v1/runs?limit=2');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.nextCursor).toBe('run-2');
  });

  it('caps limit at 200', async () => {
    findManyMock.mockResolvedValue([]);
    await request(buildApp()).get('/api/v1/runs?limit=999');
    const args = findManyMock.mock.calls[0][0];
    expect(args.take).toBe(201);
  });

  it('does NOT include nodeLogs in the list response (use /runs/:id for that)', async () => {
    findManyMock.mockResolvedValue([mkRun()]);
    const res = await request(buildApp()).get('/api/v1/runs');
    expect(res.body.data[0].steps).toBeUndefined();
    expect(res.body.data[0].nodeLogs).toBeUndefined();
  });
});

describe('GET /api/v1/runs/:id (detail)', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it('returns the run with its node logs', async () => {
    findFirstMock.mockResolvedValue({
      ...mkRun(),
      nodeLogs: [
        {
          id: 'log-1',
          nodeId: 'step-1',
          nodeName: 'Deploy',
          nodeType: 'shell',
          status: 'SUCCESS',
          startedAt: new Date('2026-04-07T00:00:00Z'),
          completedAt: new Date('2026-04-07T00:00:30Z'),
          duration: 30000,
          output: { stdout: 'ok' },
          error: null,
        },
      ],
    });

    const res = await request(buildApp()).get('/api/v1/runs/run-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('run-1');
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.steps[0].name).toBe('Deploy');
    expect(res.body.steps[0].status).toBe('SUCCESS');
  });

  it('returns 404 when the run does not belong to the tenant', async () => {
    findFirstMock.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/v1/runs/ghost');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('run_not_found');
  });
});
