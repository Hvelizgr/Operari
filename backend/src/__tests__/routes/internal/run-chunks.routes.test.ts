import crypto from 'crypto';

import express from 'express';
import request from 'supertest';

jest.mock('../../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { createRunChunksRouter } from '../../../routes/internal/run-chunks.routes';
import { RunChunkBuffer } from '../../../runbook/runners/run-chunk-buffer';

const SECRET = 'shared-test-secret';

function buildApp(opts: { secret?: string } = {}): {
  app: express.Express;
  buffer: RunChunkBuffer;
} {
  const buffer = new RunChunkBuffer();
  const app = express();
  // Mirror the production wiring: capture the raw body so HMAC
  // verification sees the exact bytes the sender signed.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(
    '/api/internal/run-chunks',
    createRunChunksRouter({ buffer, secret: opts.secret ?? SECRET })
  );
  return { app, buffer };
}

function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('POST /api/internal/run-chunks', () => {
  it('appends a valid chunk to the buffer and returns 204', async () => {
    const { app, buffer } = buildApp();
    const body = JSON.stringify({ machineId: 'm-1', stream: 'stdout', text: 'hello\n' });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', sign(SECRET, body))
      .send(body);
    expect(res.status).toBe(204);
    expect(buffer.drain('m-1')).toEqual({ stdout: 'hello\n', stderr: '' });
  });

  it('accepts the GitHub-style sha256= prefix on the signature header', async () => {
    const { app } = buildApp();
    const body = JSON.stringify({ machineId: 'm-1', stream: 'stderr', text: 'oops' });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', `sha256=${sign(SECRET, body)}`)
      .send(body);
    expect(res.status).toBe(204);
  });

  it('rejects a request with no signature header', async () => {
    const { app, buffer } = buildApp();
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .send({ machineId: 'm-1', stream: 'stdout', text: 'a' });
    expect(res.status).toBe(401);
    expect(buffer.size).toBe(0);
  });

  it('rejects a request signed with the wrong secret', async () => {
    const { app, buffer } = buildApp();
    const body = JSON.stringify({ machineId: 'm-1', stream: 'stdout', text: 'a' });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', sign('wrong-secret', body))
      .send(body);
    expect(res.status).toBe(401);
    expect(buffer.size).toBe(0);
  });

  it('returns 400 for an unknown stream value', async () => {
    const { app } = buildApp();
    const body = JSON.stringify({ machineId: 'm-1', stream: 'bogus', text: 'a' });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', sign(SECRET, body))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when machineId is missing', async () => {
    const { app } = buildApp();
    const body = JSON.stringify({ stream: 'stdout', text: 'a' });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', sign(SECRET, body))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when text is not a string', async () => {
    const { app } = buildApp();
    const body = JSON.stringify({ machineId: 'm-1', stream: 'stdout', text: 42 });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', sign(SECRET, body))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 503 when no shared secret is configured (sidecar disabled)', async () => {
    const { app } = buildApp({ secret: '' });
    const res = await request(app)
      .post('/api/internal/run-chunks/')
      .set('Content-Type', 'application/json')
      .set('X-Operari-Sig', 'whatever')
      .send({ machineId: 'm-1', stream: 'stdout', text: 'a' });
    expect(res.status).toBe(503);
  });
});
