// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. Same pattern as sql.routes.test.ts.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';
// SSRF guard would otherwise refuse 1.1.1.1 only in DNS-failure paths, but
// we also use literal IPs for blocked tests where the env flip should NOT
// apply. Keep this off and explicit.
delete process.env.OPERARI_HTTP_TESTER_ALLOW_PRIVATE;

import express from 'express';
import request from 'supertest';

jest.mock('../../config/logger.config', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../server', () => ({
  prisma: {},
}));

jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
    append: jest.fn().mockResolvedValue(undefined),
  })),
}));

// SecretTemplateResolver is the only dep that talks to Prisma indirectly.
// Stub `resolve` to return whatever fixture the test installs so we can
// exercise the {{secrets.X}} → plaintext substitution in the route
// without wiring real ConnectedAccount rows.
const resolveMock = jest.fn();
jest.mock('../../runbook/secrets/secret-template-resolver', () => {
  const actual = jest.requireActual('../../runbook/secrets/secret-template-resolver');
  return {
    ...actual,
    SecretTemplateResolver: jest.fn().mockImplementation(() => ({
      resolve: resolveMock,
    })),
  };
});

// Force the http-tester module to actually instantiate its resolver
// singleton. ENCRYPTION_KEY must be at least 32 chars for the
// ssrf-guard-independent path; ssrf-guard is exercised separately.
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

// Override globalThis.fetch — HttpExecutor uses it internally. Each
// test installs its own implementation via `installFetch`.
let installedFetch: jest.Mock;
const realFetch = globalThis.fetch;
function installFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  installedFetch = jest.fn(async (url: any, init?: any) => impl(url, init));
  (globalThis as { fetch: typeof fetch }).fetch = installedFetch as unknown as typeof fetch;
}

afterEach(() => {
  // Reset fetch + clear mocks between tests so leakage cannot cross.
  (globalThis as { fetch: typeof fetch }).fetch = realFetch;
  jest.clearAllMocks();
});

import httpTesterRouter, { __testHooks } from '../../routes/http-tester.routes';

function buildApp() {
  __testHooks.resetSecretResolver();
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: 'u1', email: 'u@e', role: 'USER', tenantId: 't1' };
    next();
  });
  app.use('/api/http-tester', httpTesterRouter);
  return app;
}

function fakeResponse({
  status = 200,
  statusText = 'OK',
  headers = {},
  body = '',
}: {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      forEach: (cb: (value: string, key: string) => void) => {
        for (const [k, v] of Object.entries(headers)) cb(v, k);
      },
    },
    text: async () => body,
  } as unknown as Response;
}

describe('POST /api/http-tester/execute', () => {
  describe('input validation', () => {
    it('rejects an empty body with 400', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/http-tester/execute').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid body');
    });

    it('rejects an unsupported method', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ method: 'TRACE', url: 'https://1.1.1.1/' });
      expect(res.status).toBe(400);
    });

    it('rejects a timeout above the cap', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ url: 'https://1.1.1.1/', timeoutMs: 999_999 });
      expect(res.status).toBe(400);
    });
  });

  describe('SSRF guard', () => {
    it('rejects localhost URLs', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ url: 'http://localhost:8080/admin' });
      expect(res.status).toBe(400);
      expect(res.body.reason).toBe('loopback');
    });

    it('rejects private-IP URLs', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ url: 'http://10.0.0.1/' });
      expect(res.status).toBe(400);
      expect(res.body.reason).toBe('private-ip');
    });

    it('rejects file:// scheme', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ url: 'file:///etc/passwd' });
      expect(res.status).toBe(400);
      expect(res.body.reason).toBe('unsupported-scheme');
    });
  });

  describe('happy path', () => {
    it('forwards a GET and returns status + headers + body + durationMs', async () => {
      installFetch(() =>
        fakeResponse({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"ok":true}',
        })
      );

      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ method: 'GET', url: 'https://1.1.1.1/' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(200);
      expect(res.body.statusText).toBe('OK');
      expect(res.body.headers['content-type']).toBe('application/json');
      expect(res.body.body).toBe('{"ok":true}');
      expect(typeof res.body.durationMs).toBe('number');
      expect(installedFetch).toHaveBeenCalledTimes(1);
    });

    it('returns the response intact for a 4xx (does NOT mark failed)', async () => {
      installFetch(() => fakeResponse({ status: 404, statusText: 'Not Found', body: 'nope' }));

      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ url: 'https://1.1.1.1/missing' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(404);
      expect(res.body.body).toBe('nope');
    });

    it('returns 502 when the network call throws', async () => {
      installFetch(() => {
        throw new Error('ECONNREFUSED');
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({ url: 'https://1.1.1.1/' });

      expect(res.status).toBe(502);
      expect(res.body.message).toContain('ECONNREFUSED');
    });
  });

  describe('secret references', () => {
    it('passes resolved secrets to the executor and emits one resolve call per request', async () => {
      // Pretend acc-123 resolves to "Bearer xyz". The HttpExecutor will
      // substitute it via {{secrets.acc-123}} in the Authorization header.
      resolveMock.mockResolvedValueOnce({ 'acc-123': 'Bearer xyz' });

      let observedAuthHeader: string | undefined;
      installFetch((_url, init) => {
        const h = (init?.headers ?? {}) as Record<string, string>;
        observedAuthHeader = h['Authorization'] ?? h['authorization'];
        return fakeResponse({ status: 200, body: '{}' });
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({
          method: 'GET',
          url: 'https://1.1.1.1/protected',
          headers: { Authorization: '{{secrets.acc-123}}' },
        });

      expect(res.status).toBe(200);
      expect(observedAuthHeader).toBe('Bearer xyz');
      expect(resolveMock).toHaveBeenCalledTimes(1);
      expect(resolveMock.mock.calls[0][0]).toMatchObject({
        tenantId: 't1',
        stepId: 'http-tester',
      });
    });

    it('returns 400 when a referenced secret cannot be resolved', async () => {
      const { SecretReferenceError } = jest.requireActual(
        '../../runbook/secrets/secret-template-resolver'
      );
      resolveMock.mockRejectedValueOnce(
        new SecretReferenceError('Cannot resolve {{secrets.missing}}', 'missing', 'http-tester')
      );

      const app = buildApp();
      const res = await request(app)
        .post('/api/http-tester/execute')
        .send({
          url: 'https://1.1.1.1/',
          headers: { Authorization: '{{secrets.missing}}' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Secret reference/);
      expect(res.body.accountId).toBe('missing');
    });
  });
});
