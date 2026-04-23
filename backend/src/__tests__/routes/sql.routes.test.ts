// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. The global test setup installs a short secret
// ('test-secret-key', 15 chars) that's fine for routes that don't re-load
// env.config, but sql.routes imports it directly so we need a compliant
// value set BEFORE the import chain below resolves.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Silence pino so failing-query / schema-failure tests don't flood the log.
// ---------------------------------------------------------------------------

jest.mock('../../config/logger.config', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Prisma mock — only the fields the route touches. findFirst resolves to a
// single ConnectedAccount whose `accessToken` is the plaintext connection
// string we want SecretReader to hand back.
// ---------------------------------------------------------------------------

const connectedAccountFindFirst = jest.fn();
jest.mock('../../server', () => ({
  prisma: {
    connectedAccount: {
      findFirst: (args: any) => connectedAccountFindFirst(args),
    },
  },
}));

// ---------------------------------------------------------------------------
// AuditService is instantiated inside the route on each request. Mock with a
// no-op so audit writes don't hit Prisma during the test.
// ---------------------------------------------------------------------------

jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    append: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// SecretReader is used to decrypt the ConnectedAccount.accessToken. We short-
// circuit it to return the `ciphertext` field as-is so tests can assert the
// query flow without wiring real XChaCha20.
// ---------------------------------------------------------------------------

jest.mock('../../security/secret-reader', () => ({
  SecretReader: jest.fn().mockImplementation(() => ({
    read: jest.fn(async ({ ciphertext }: { ciphertext: string }) => ciphertext),
  })),
}));

// ---------------------------------------------------------------------------
// pg.Client mock. Each `query` call is captured so individual tests can
// assert the sequence (SET statement_timeout → BEGIN TRANSACTION READ ONLY →
// user query → COMMIT). The result for the user-query call is taken from the
// queue installed by the current test.
// ---------------------------------------------------------------------------

type ResponseSpec =
  | { rows: any[]; rowCount: number; fields?: Array<{ name: string; dataTypeID: number }> }
  | { error: string };

const pgQueue: ResponseSpec[] = [];
let pgCalls: string[] = [];
let endCalls = 0;

jest.mock('pg', () => {
  class FakeClient {
    constructor(_cfg: any) {}
    async connect() {
      /* noop */
    }
    async query(sql: string, _params?: any[]) {
      pgCalls.push(sql.trim());
      if (
        sql.includes('SET statement_timeout') ||
        sql === 'BEGIN TRANSACTION READ ONLY' ||
        sql === 'COMMIT' ||
        sql === 'ROLLBACK'
      ) {
        return { rows: [], rowCount: 0 };
      }
      // Everything else is treated as "the user query" OR a schema
      // introspection call, both pulled from the queue.
      const next = pgQueue.shift();
      if (!next) throw new Error('no pg response queued');
      if ('error' in next) throw new Error(next.error);
      return { rows: next.rows, rowCount: next.rowCount, fields: next.fields };
    }
    async end() {
      endCalls++;
    }
  }
  return { Client: FakeClient };
});

import sqlRouter from '../../routes/sql.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  // Inject a fake user so AuthRequest.user.tenantId is populated.
  app.use((req: any, _res, next) => {
    req.user = { id: 'u1', email: 'u@e', role: 'USER', tenantId: 't1' };
    next();
  });
  app.use('/api/sql', sqlRouter);
  return app;
}

describe('SQL routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pgQueue.length = 0;
    pgCalls = [];
    endCalls = 0;
  });

  // -----------------------------------------------------------------------
  // POST /query
  // -----------------------------------------------------------------------

  describe('POST /api/sql/query', () => {
    it('rejects requests missing credentialId or query with 400', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/sql/query').send({ query: 'SELECT 1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/credentialId.*query/);
    });

    it('returns 404 when the credential does not exist for the tenant', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce(null);
      const app = buildApp();
      const res = await request(app)
        .post('/api/sql/query')
        .send({ credentialId: 'missing', query: 'SELECT 1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('wraps the user query in BEGIN TRANSACTION READ ONLY + COMMIT', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      pgQueue.push({ rows: [{ n: 1 }], rowCount: 1, fields: [{ name: 'n', dataTypeID: 23 }] });

      const app = buildApp();
      const res = await request(app)
        .post('/api/sql/query')
        .send({ credentialId: 'acc-1', query: 'SELECT 1 AS n' });

      expect(res.status).toBe(200);
      // Read-only transaction must wrap the user query.
      expect(pgCalls).toContain('BEGIN TRANSACTION READ ONLY');
      expect(pgCalls).toContain('COMMIT');
      // User query executed between BEGIN and COMMIT, not before.
      const begin = pgCalls.indexOf('BEGIN TRANSACTION READ ONLY');
      const user = pgCalls.indexOf('SELECT 1 AS n');
      const commit = pgCalls.indexOf('COMMIT');
      expect(begin).toBeLessThan(user);
      expect(user).toBeLessThan(commit);
    });

    it('caps statement_timeout at 60000ms even when the caller asks for more', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      pgQueue.push({ rows: [], rowCount: 0 });

      const app = buildApp();
      await request(app)
        .post('/api/sql/query')
        .send({ credentialId: 'acc-1', query: 'SELECT 1', timeout: 999999 });

      const setCall = pgCalls.find(c => c.startsWith('SET statement_timeout'));
      expect(setCall).toBeDefined();
      // 999999 > 60000 so the route should clamp to 60000.
      expect(setCall).toContain('60000');
    });

    it('returns the query rows + rowCount + fields + durationMs on success', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      pgQueue.push({
        rows: [{ id: 1, name: 'alice' }],
        rowCount: 1,
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 25 },
        ],
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/sql/query')
        .send({ credentialId: 'acc-1', query: 'SELECT * FROM users' });

      expect(res.status).toBe(200);
      expect(res.body.rows).toEqual([{ id: 1, name: 'alice' }]);
      expect(res.body.rowCount).toBe(1);
      expect(res.body.fields).toEqual([
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 25 },
      ]);
      expect(typeof res.body.durationMs).toBe('number');
    });

    it('returns 422 + error message on query failure without leaking stack traces', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      pgQueue.push({ error: 'syntax error at or near "SELEC"' });

      const app = buildApp();
      const res = await request(app)
        .post('/api/sql/query')
        .send({ credentialId: 'acc-1', query: 'SELEC 1' });

      expect(res.status).toBe(422);
      expect(res.body.error).toContain('syntax error');
      expect(res.body).not.toHaveProperty('stack');
      expect(typeof res.body.durationMs).toBe('number');
    });

    it('closes the pg connection even on failure', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      pgQueue.push({ error: 'boom' });

      const app = buildApp();
      await request(app).post('/api/sql/query').send({ credentialId: 'acc-1', query: 'SELECT 1' });

      expect(endCalls).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // POST /schema
  // -----------------------------------------------------------------------

  describe('POST /api/sql/schema', () => {
    it('rejects requests missing credentialId with 400', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/sql/schema').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/credentialId/);
    });

    it('returns 404 when the credential is not found', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce(null);
      const app = buildApp();
      const res = await request(app).post('/api/sql/schema').send({ credentialId: 'missing' });
      expect(res.status).toBe(404);
    });

    it('introspects tables + columns into the canonical shape', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      // First call: list tables. Second call: columns for the single table.
      pgQueue.push({
        rows: [{ table_schema: 'public', table_name: 'users' }],
        rowCount: 1,
      });
      pgQueue.push({
        rows: [
          { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
          { column_name: 'email', data_type: 'text', is_nullable: 'YES', column_default: null },
        ],
        rowCount: 2,
      });

      const app = buildApp();
      const res = await request(app).post('/api/sql/schema').send({ credentialId: 'acc-1' });

      expect(res.status).toBe(200);
      expect(res.body.tables).toEqual([
        {
          schema: 'public',
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', nullable: false, default: null },
            { name: 'email', type: 'text', nullable: true, default: null },
          ],
        },
      ]);
    });

    it('returns 422 when introspection fails', async () => {
      connectedAccountFindFirst.mockResolvedValueOnce({
        id: 'acc-1',
        accessToken: 'postgres://x@h:5432/db',
      });
      pgQueue.push({ error: 'connection terminated' });

      const app = buildApp();
      const res = await request(app).post('/api/sql/schema').send({ credentialId: 'acc-1' });
      expect(res.status).toBe(422);
      expect(res.body.error).toContain('connection terminated');
    });
  });
});
