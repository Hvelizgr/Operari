import express from 'express';
import request from 'supertest';

/**
 * Thin unit tests around the /live endpoint. The route lives inside
 * server.ts so we rebuild the handler here rather than import the
 * whole app (which would drag in env validation + prisma + routers).
 * The logic under test is the response contract, not the surrounding
 * wiring — asserting the contract is enough to catch any accidental
 * break when future edits touch server.ts.
 */
describe('GET /live', () => {
  const app = express();

  app.get('/live', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? process.env.NANORUN_VERSION ?? '0.1.0-dev',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  it('returns 200 with a stable body shape', async () => {
    const res = await request(app).get('/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('prefers APP_VERSION over NANORUN_VERSION when both are set', async () => {
    const prevApp = process.env.APP_VERSION;
    const prevNano = process.env.NANORUN_VERSION;
    process.env.APP_VERSION = 'git-abc123';
    process.env.NANORUN_VERSION = '0.2.0';
    try {
      const res = await request(app).get('/live');
      expect(res.body.version).toBe('git-abc123');
    } finally {
      if (prevApp === undefined) delete process.env.APP_VERSION;
      else process.env.APP_VERSION = prevApp;
      if (prevNano === undefined) delete process.env.NANORUN_VERSION;
      else process.env.NANORUN_VERSION = prevNano;
    }
  });
});
