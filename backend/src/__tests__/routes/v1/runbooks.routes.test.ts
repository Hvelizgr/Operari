import express from 'express';
import request from 'supertest';

type Runbook = {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  userId: string;
  inputs: unknown;
};

const runbooks: Runbook[] = [];
const executeMock = jest.fn();

jest.mock('../../../server', () => ({
  prisma: {
    runbook: {
      findMany: jest.fn(),
      findFirst: jest.fn(
        async (args: { where: { tenantId: string; slug?: string; id?: string } }) => {
          return (
            runbooks.find(
              r =>
                r.tenantId === args.where.tenantId &&
                (args.where.slug === undefined || r.slug === args.where.slug) &&
                (args.where.id === undefined || r.id === args.where.id)
            ) ?? null
          );
        }
      ),
    },
  },
}));

jest.mock('../../../middleware/api-key.middleware', () => ({
  requireApiKey: (_scope?: string) => (req: any, _res: any, next: any) => {
    req.apiContext = { keyId: 'k-1', tenantId: 'tenant-1', scopes: ['runbooks:trigger'] };
    next();
  },
}));

jest.mock('../../../editor/execution/execution.service', () => ({
  ExecutionService: jest.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
}));

import runbooksRouter from '../../../routes/v1/runbooks.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/runbooks', runbooksRouter);
  return app;
}

function seedRunbook(over: Partial<Runbook> = {}): Runbook {
  const r: Runbook = {
    id: 'rb-1',
    tenantId: 'tenant-1',
    slug: 'deploy',
    name: 'Deploy',
    userId: 'u-1',
    inputs: [],
    ...over,
  };
  runbooks.push(r);
  return r;
}

describe('POST /api/v1/runbooks/:slug/trigger — input validation', () => {
  beforeEach(() => {
    runbooks.length = 0;
    executeMock.mockReset();
    executeMock.mockResolvedValue({
      id: 'run-1',
      status: 'RUNNING',
      startedAt: new Date('2026-04-24T00:00:00Z'),
    });
  });

  it('passes a payload through untouched when the runbook declares no inputs', async () => {
    seedRunbook({ inputs: [] });
    const res = await request(buildApp())
      .post('/api/v1/runbooks/deploy/trigger')
      .send({ variables: { env: 'prod', note: 'manual' } });

    expect(res.status).toBe(202);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].input).toEqual({ env: 'prod', note: 'manual' });
  });

  it('coerces typed inputs and passes the normalized values to the engine', async () => {
    seedRunbook({
      inputs: [
        { name: 'env', type: 'select', options: ['dev', 'prod'], required: true },
        { name: 'retries', type: 'number', default: 3 },
      ],
    });
    const res = await request(buildApp())
      .post('/api/v1/runbooks/deploy/trigger')
      .send({ variables: { env: 'prod', retries: '5' } });

    expect(res.status).toBe(202);
    const passed = executeMock.mock.calls[0][0].input;
    expect(passed).toEqual({ env: 'prod', retries: 5 });
  });

  it('rejects missing required input with 400 + invalid_run_inputs', async () => {
    seedRunbook({
      inputs: [{ name: 'env', type: 'text', required: true }],
    });
    const res = await request(buildApp())
      .post('/api/v1/runbooks/deploy/trigger')
      .send({ variables: {} });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_run_inputs');
    expect(res.body.issues).toEqual([{ field: 'env', message: 'env is required' }]);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects a select value outside the allowed options', async () => {
    seedRunbook({
      inputs: [{ name: 'env', type: 'select', options: ['dev', 'prod'] }],
    });
    const res = await request(buildApp())
      .post('/api/v1/runbooks/deploy/trigger')
      .send({ variables: { env: 'staging' } });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual([{ field: 'env', message: 'env must be one of: dev, prod' }]);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('applies defaults when the SDK omits an optional typed input', async () => {
    seedRunbook({
      inputs: [{ name: 'retries', type: 'number', default: 3 }],
    });
    const res = await request(buildApp())
      .post('/api/v1/runbooks/deploy/trigger')
      .send({ variables: {} });

    expect(res.status).toBe(202);
    expect(executeMock.mock.calls[0][0].input).toEqual({ retries: 3 });
  });

  it('rejects an unknown key as a typo', async () => {
    seedRunbook({ inputs: [{ name: 'env', type: 'text' }] });
    const res = await request(buildApp())
      .post('/api/v1/runbooks/deploy/trigger')
      .send({ variables: { env: 'prod', enivronment: 'stg' } });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual([
      { field: 'enivronment', message: 'unknown input "enivronment"' },
    ]);
  });
});
