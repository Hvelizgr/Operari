process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import express from 'express';
import request from 'supertest';

const record = jest.fn().mockResolvedValue({ id: 'a', hash: 'h', seq: BigInt(1) });

jest.mock('../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../server', () => ({ prisma: { connectedAccount: { findFirst: jest.fn() } } }));
jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({ record })),
}));

import mcpTesterRouter from '../../routes/mcp-tester.routes';
import { ECHO_TOOL, type FakeMcpServer, startFakeMcpServer } from '../integrations/fake-mcp-server';

function buildApp(user: unknown = { id: 'u1', email: 'u@e', role: 'USER', tenantId: 't1' }) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    if (user) req.user = user;
    next();
  });
  app.use('/api/mcp-tester', mcpTesterRouter);
  return app;
}

describe('/api/mcp-tester', () => {
  let server: FakeMcpServer;

  beforeAll(async () => {
    server = await startFakeMcpServer([ECHO_TOOL]);
  });
  afterAll(() => server.close());
  beforeEach(() => record.mockClear());

  it('requires a session', async () => {
    const res = await request(buildApp(null))
      .post('/api/mcp-tester/inspect')
      .send({ url: server.url });
    expect(res.status).toBe(401);
  });

  it('inspect lists tools with the hash a step pins', async () => {
    const res = await request(buildApp()).post('/api/mcp-tester/inspect').send({ url: server.url });
    expect(res.status).toBe(200);
    expect(res.body.data.server.name).toBe('fake');
    expect(res.body.data.tools[0]).toMatchObject({ name: 'echo' });
    expect(res.body.data.tools[0].hash).toMatch(/^[0-9a-f]{16}$/);
    expect(record).not.toHaveBeenCalled();
  });

  it('call returns the raw result and audits it without the arguments', async () => {
    const res = await request(buildApp())
      .post('/api/mcp-tester/call')
      .send({ url: server.url, name: 'echo', arguments: { message: 'secret-ish' } });
    expect(res.status).toBe(200);
    expect(res.body.data.result.content[0].text).toBe('echo: secret-ish');
    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0][0];
    expect(event).toMatchObject({ tenantId: 't1', type: 'mcp.tool_called', actorId: 'u1' });
    expect(event.payload).toMatchObject({ tool: 'echo', outcome: 'ok' });
    expect(JSON.stringify(event.payload)).not.toContain('secret-ish');
  });

  it('rejects a missing target with 400', async () => {
    const res = await request(buildApp()).post('/api/mcp-tester/inspect').send({});
    expect(res.status).toBe(400);
  });

  it('reports an unreachable server as 502', async () => {
    const res = await request(buildApp())
      .post('/api/mcp-tester/inspect')
      .send({ url: 'http://127.0.0.1:1/mcp' });
    expect(res.status).toBe(502);
  });
});
