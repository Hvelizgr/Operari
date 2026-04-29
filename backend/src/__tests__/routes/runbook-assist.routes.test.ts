import express, { Express } from 'express';
import request from 'supertest';

// Stub the orchestrator BEFORE importing the route so the route uses
// our fake stream and never tries to reach Anthropic/OpenAI in CI.
//
// The route iterates `fullStream` (Vercel AI SDK v6) which yields
// typed events: text-delta / tool-call / tool-result / finish / etc.
// The fixture below covers the diagnosis-by-text path; tests that
// assert tool-call rendering install their own fixture.
jest.mock('../../agent/orchestrator', () => ({
  streamOrchestratorReply: jest.fn(() => ({
    fullStream: (async function* () {
      yield { type: 'text-delta', id: 't1', text: 'diagnosis: ' };
      yield { type: 'text-delta', id: 't1', text: 'check the env var' };
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
      runbook: { id: 'wf-1', name: 'Deploy' },
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

  it('emits tool-call (9:) and tool-result (a:) frames when the orchestrator calls a tool', async () => {
    // Override the default fixture for this one test: simulate the
    // orchestrator deciding to call list_recent_runs mid-stream.
    (streamOrchestratorReply as jest.Mock).mockImplementationOnce(() => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', id: 't1', text: 'Let me check…' };
        yield {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'list_recent_runs',
          input: { status: 'FAILED', limit: 5 },
        };
        yield {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'list_recent_runs',
          input: { status: 'FAILED', limit: 5 },
          output: { runs: [{ id: 'run-7', error: 'boom' }] },
        };
        yield { type: 'text-delta', id: 't2', text: 'I see one failure: boom.' };
      })(),
    }));

    const res = await request(buildApp()).post('/api/runbook-assist/diagnose').send({
      stepName: 'Build',
      stepType: 'shell',
      errorMessage: 'exit 1',
    });

    expect(res.status).toBe(200);
    // text deltas survive
    expect(res.text).toContain('0:"Let me check…"');
    expect(res.text).toContain('0:"I see one failure: boom."');
    // tool-call frame: tag 9, includes name + args
    expect(res.text).toContain('9:{"toolCallId":"call-1","toolName":"list_recent_runs"');
    expect(res.text).toContain('"status":"FAILED"');
    // tool-result frame: tag a, paired by toolCallId
    expect(res.text).toContain('a:{"toolCallId":"call-1"');
    expect(res.text).toContain('"id":"run-7"');
    // finish frame still terminates the stream
    expect(res.text).toContain('"finishReason":"stop"');
  });

  it('translates tool-error events into a result envelope so the panel can render them', async () => {
    (streamOrchestratorReply as jest.Mock).mockImplementationOnce(() => ({
      fullStream: (async function* () {
        yield {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'get_step_logs',
          input: { runId: 'r', stepId: 's' },
        };
        yield {
          type: 'tool-error',
          toolCallId: 'call-2',
          toolName: 'get_step_logs',
          input: { runId: 'r', stepId: 's' },
          error: new Error('step not found'),
        };
      })(),
    }));

    const res = await request(buildApp())
      .post('/api/runbook-assist/diagnose')
      .send({ stepName: 'X', stepType: 'shell', errorMessage: 'e' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('a:{"toolCallId":"call-2","result":{"ok":false,"error":');
    expect(res.text).toContain('step not found');
  });
});
