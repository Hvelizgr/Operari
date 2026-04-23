import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

import { csrfProtection } from '../../middleware/csrf.middleware';

/**
 * Rebuilds a minimal app per test so CSRF_ENFORCE changes are
 * picked up by the middleware's per-request resolver. We mount a
 * single POST endpoint that only runs when CSRF lets the request
 * through — asserting on its status gives a clean pass/block
 * signal.
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection());
  app.post('/api/test', (_req, res) => res.json({ ok: true }));
  app.get('/api/test', (_req, res) => res.json({ ok: true }));
  app.post('/api/v1/runs', (_req, res) => res.json({ ok: true }));
  app.post('/webhook/abc', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('csrfProtection', () => {
  const originalMode = process.env.CSRF_ENFORCE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.CSRF_ENFORCE;
    else process.env.CSRF_ENFORCE = originalMode;
  });

  it('is a no-op when CSRF_ENFORCE is unset (default self-host)', async () => {
    delete process.env.CSRF_ENFORCE;
    const app = makeApp();
    const res = await request(app).post('/api/test').set('Cookie', 'nanorun_session=s');
    expect(res.status).toBe(200);
  });

  it('blocks a cookie-session POST without the header when enforcing', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app)
      .post('/api/test')
      .set('Cookie', 'nanorun_session=s; nanorun_csrf=tok-123')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('csrf_invalid');
  });

  it('accepts a cookie-session POST when the header matches the cookie', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app)
      .post('/api/test')
      .set('Cookie', 'nanorun_session=s; nanorun_csrf=tok-123')
      .set('X-CSRF-Token', 'tok-123')
      .send({});
    expect(res.status).toBe(200);
  });

  it('rejects a mismatched header even when both are present', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app)
      .post('/api/test')
      .set('Cookie', 'nanorun_session=s; nanorun_csrf=tok-123')
      .set('X-CSRF-Token', 'tok-XYZ')
      .send({});
    expect(res.status).toBe(403);
  });

  it('lets GET through without the header (safe method)', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app)
      .get('/api/test')
      .set('Cookie', 'nanorun_session=s; nanorun_csrf=tok-123');
    expect(res.status).toBe(200);
  });

  it('exempts Bearer-authenticated requests (API key clients)', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app)
      .post('/api/test')
      .set('Authorization', 'Bearer sk_test_123')
      .send({});
    expect(res.status).toBe(200);
  });

  it('exempts /api/v1/* paths (API-key surface) even without Bearer', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app).post('/api/v1/runs').send({});
    expect(res.status).toBe(200);
  });

  it('exempts /webhook/* paths (HMAC-auth surface)', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    const res = await request(app).post('/webhook/abc').send({});
    expect(res.status).toBe(200);
  });

  it('lets unauthed mutating requests through (no session cookie)', async () => {
    process.env.CSRF_ENFORCE = 'true';
    const app = makeApp();
    // This is the /auth/login case — no cookie yet, so the
    // middleware has nothing to protect.
    const res = await request(app).post('/api/test').send({});
    expect(res.status).toBe(200);
  });

  it('logs but does not block in observe mode', async () => {
    process.env.CSRF_ENFORCE = 'observe';
    const app = makeApp();
    const res = await request(app)
      .post('/api/test')
      .set('Cookie', 'nanorun_session=s; nanorun_csrf=tok-123')
      .send({});
    expect(res.status).toBe(200);
  });
});
