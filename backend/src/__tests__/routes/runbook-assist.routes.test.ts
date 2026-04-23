import express, { Express } from 'express';
import request from 'supertest';

// Stub the orchestrator BEFORE importing the route so the route uses
// our fake stream and never tries to reach Anthropic/OpenAI in CI.
jest.mock('../../agent/orchestrator', () => ({
  streamOrchestratorReply: jest.fn(() => ({
    textStream: (async function* () {
      yield 'diagnosis: ';
      yield 'check the env var';
    })(),
  })),
}));

// Server module exports `prisma` — give the route a stub it can call.
jest.mock('../../server', () => ({
  prisma: {
    execution: { findFirst: jest.fn() },
  },
}));

import { streamOrchestratorReply } from '../../agent/orchestrator';
import runbookAssistRoutes from '../../routes/runbook-assist.routes';
import { prisma as mockedPrisma } from '../../server';

const findFirstMock = (
  mockedPrisma as unknown as {
    execution: { findFirst: jest.Mock };
  }
).execution.findFirst;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/runbook-assist', runbookAssistRoutes);
  return app;
}

describe('POST /api/runbook-assist/diagnose', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findFirstMock.mockReset();
  });

  it('rejects request with no failure context', async () => {
    const res = await request(buildApp())
      .post('/api/runbook-assist/diagnose')
      .send({ stepName: 'Build', stepType: 'shell' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('no_context');
  });

  it('streams a diagnosis when manual context is supplied', async () => {
    const res = await request(buildApp()).post('/api/runbook-assist/diagnose').send({
      stepName: 'Build',
      stepType: 'shell',
      errorMessage: 'exit 127: command not found',
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('0:"diagnosis: "');
    expect(res.text).toContain('0:"check the env var"');
    expect(res.text).toContain('"finishReason":"stop"');
    expect(streamOrchestratorReply).toHaveBeenCalledTimes(1);
  });

  it('pulls run logs when runId+stepId are provided', async () => {
    findFirstMock.mockResolvedValueOnce({
      id: 'run-1',
      workflow: { id: 'wf-1', name: 'Deploy' },
      nodeLogs: [
        {
          id: 'log-1',
          nodeId: 'step-build',
          nodeName: 'Build',
          nodeType: 'shell',
          status: 'FAILED',
          error: 'exit 1',
          output: { stdout: 'building...', stderr: 'segfault' },
          startedAt: new Date(),
        },
      ],
    });

    const res = await request(buildApp())
      .post('/api/runbook-assist/diagnose')
      .send({ runId: 'run-1', stepId: 'step-build' });

    expect(res.status).toBe(200);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(res.text).toContain('"finishReason":"stop"');
  });

  it('falls back to manual fields if the run is not found', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const res = await request(buildApp()).post('/api/runbook-assist/diagnose').send({
      runId: 'missing',
      stepId: 'missing',
      errorMessage: 'fallback error',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('"finishReason":"stop"');
  });
});
