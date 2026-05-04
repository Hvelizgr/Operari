// env.config validates JWT_SECRET at import time.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import express from 'express';
import request from 'supertest';

jest.mock('../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const findManyMock = jest.fn().mockResolvedValue([]);
jest.mock('../../server', () => ({
  prisma: { runbook: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

const generateObjectMock = jest.fn();
jest.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

jest.mock('../../agent/models', () => ({
  resolveAiModel: () => ({ id: 'fake-model' }),
}));

import runsAiFilterRoutes from '../../routes/runs-ai-filter.routes';

function buildApp(opts?: { authed?: boolean }) {
  const app = express();
  app.use(express.json());
  if (opts?.authed) {
    app.use((req: express.Request & { user?: unknown }, _res, next) => {
      (req as unknown as { user: unknown }).user = {
        id: 'u1',
        email: 'u@e',
        role: 'USER',
        tenantId: 't1',
      };
      next();
    });
  }
  app.use((req: express.Request & { log?: unknown }, _res, next) => {
    (req as unknown as { log: { error: () => void } }).log = { error: () => undefined };
    next();
  });
  app.use('/api/runs/ai-filter', runsAiFilterRoutes);
  return app;
}

describe('POST /api/runs/ai-filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the structured filters when the LLM resolves the prompt', async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { status: 'FAILED', runbook: 'deploy', from: null, to: null },
    });

    const res = await request(buildApp({ authed: true }))
      .post('/api/runs/ai-filter')
      .send({ text: 'failed runs of deploy yesterday' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.filters.status).toBe('FAILED');
    expect(res.body.filters.runbook).toBe('deploy');
  });

  it('rejects an empty prompt with 400', async () => {
    const res = await request(buildApp({ authed: true }))
      .post('/api/runs/ai-filter')
      .send({ text: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it('rejects a prompt over 500 chars', async () => {
    const long = 'a'.repeat(600);
    const res = await request(buildApp({ authed: true }))
      .post('/api/runs/ai-filter')
      .send({ text: long });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns success:false with suggestions when generateObject throws', async () => {
    generateObjectMock.mockRejectedValueOnce(new Error('rate limited'));

    const res = await request(buildApp({ authed: true }))
      .post('/api/runs/ai-filter')
      .send({ text: 'tasks failed yesterday' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('rate limited');
    expect(res.body.suggestions).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('returns success:false when the model emits a malformed object', async () => {
    generateObjectMock.mockResolvedValueOnce({
      // status is not in the enum; the safeParse rejects it.
      object: { status: 'BANANA', runbook: null, from: null, to: null },
    });

    const res = await request(buildApp({ authed: true }))
      .post('/api/runs/ai-filter')
      .send({ text: 'banana runs' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/malformed/i);
  });

  it('requires authentication', async () => {
    const res = await request(buildApp({ authed: false }))
      .post('/api/runs/ai-filter')
      .send({ text: 'whatever' });
    expect(res.status).toBe(401);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });
});
