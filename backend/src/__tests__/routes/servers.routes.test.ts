import { generateKeyPairSync } from 'crypto';
import express from 'express';
import request from 'supertest';

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../security/ssrf-guard', () => ({
  blockedTarget: async (_k: string, host: string) =>
    /^(10\.|127\.|169\.254\.)/.test(host) ? `${host} is a private address` : null,
}));

import { createServersRouter } from '../../routes/servers.routes';
import { hostKeyFromBlob } from '../../servers/host-key';

function blob(): Buffer {
  const { publicKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x as string, 'base64url');
  const s = (b: Buffer) => Buffer.concat([Buffer.from([0, 0, 0, b.length]), b]);
  return Buffer.concat([s(Buffer.from('ssh-ed25519')), s(raw)]);
}
const KEY = hostKeyFromBlob(blob());
const KEY2 = hostKeyFromBlob(blob());

function makePrisma() {
  return {
    server: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'srv-1', ...data })),
      update: jest.fn(async ({ data }: any) => ({ id: 'srv-1', ...data })),
      delete: jest.fn(),
    },
    connectedAccount: { findFirst: jest.fn() },
    $transaction: jest.fn().mockRejectedValue(new Error('no audit in tests')),
  };
}

function makeApp(
  prisma: any,
  role: 'ADMIN' | 'USER' = 'ADMIN',
  extra: Record<string, unknown> = {}
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'u1', role, tenantId: 't1' };
    next();
  });
  app.use('/api/servers', createServersRouter({ prisma, ...extra } as any));
  return app;
}

const body = (over: Record<string, unknown> = {}) => ({
  name: 'prod-1',
  host: 'prod-1.example.com',
  port: 22,
  username: 'deploy',
  hostKey: `${KEY.line} root@prod-1`,
  authMode: 'key',
  credentialId: 'cred-1',
  ...over,
});

describe('/api/servers', () => {
  it('lists only this workspace and never returns secrets', async () => {
    const prisma = makePrisma();
    await request(makeApp(prisma, 'USER')).get('/api/servers').expect(200);
    const args = prisma.server.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: 't1' });
    expect(Object.keys(args.select)).not.toContain('tenantId');
  });

  it('only admins write', async () => {
    const prisma = makePrisma();
    const app = makeApp(prisma, 'USER');
    await request(app).post('/api/servers').send(body()).expect(403);
    await request(app).post('/api/servers/scan').send({ host: 'h.example.com' }).expect(403);
    await request(app).delete('/api/servers/srv-1').expect(403);
    expect(prisma.server.create).not.toHaveBeenCalled();
  });

  it('registers with the canonical key and its fingerprint', async () => {
    const prisma = makePrisma();
    prisma.connectedAccount.findFirst.mockResolvedValue({ id: 'cred-1' });
    const res = await request(makeApp(prisma)).post('/api/servers').send(body()).expect(201);
    expect(prisma.connectedAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'cred-1', tenantId: 't1' },
    });
    expect(prisma.server.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 't1',
      hostKey: KEY.line,
      hostKeyFingerprint: KEY.fingerprint,
      createdBy: 'u1',
    });
    expect(res.body.data.id).toBe('srv-1');
  });

  it('refuses bad keys, private hosts, missing or foreign credentials', async () => {
    const prisma = makePrisma();
    prisma.connectedAccount.findFirst.mockResolvedValue(null);
    const app = makeApp(prisma);
    await request(app)
      .post('/api/servers')
      .send(body({ hostKey: 'ssh-ed25519 Zm9v' }))
      .expect(400);
    await request(app)
      .post('/api/servers')
      .send(body({ host: '10.0.0.5' }))
      .expect(400);
    await request(app)
      .post('/api/servers')
      .send(body({ credentialId: null }))
      .expect(400);
    await request(app).post('/api/servers').send(body()).expect(400);
    expect(prisma.server.create).not.toHaveBeenCalled();
  });

  it('drops the credential for certificate servers', async () => {
    const prisma = makePrisma();
    prisma.connectedAccount.findFirst.mockResolvedValue({ id: 'cred-1' });
    await request(makeApp(prisma))
      .post('/api/servers')
      .send(body({ authMode: 'certificate' }))
      .expect(201);
    expect(prisma.server.create.mock.calls[0][0].data.credentialId).toBeNull();
  });

  it('scans with the injected scanner and blocks private targets', async () => {
    const scan = jest.fn().mockResolvedValue(KEY);
    const app = makeApp(makePrisma(), 'ADMIN', { scan });
    const ok = await request(app)
      .post('/api/servers/scan')
      .send({ host: 'prod-1.example.com' })
      .expect(200);
    expect(ok.body.data).toEqual({
      hostKey: KEY.line,
      fingerprint: KEY.fingerprint,
      type: 'ssh-ed25519',
    });
    await request(app).post('/api/servers/scan').send({ host: '127.0.0.1' }).expect(400);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('re-pins on PATCH and 404s other workspaces', async () => {
    const prisma = makePrisma();
    prisma.server.findFirst.mockResolvedValueOnce(null);
    const app = makeApp(prisma);
    await request(app).patch('/api/servers/srv-x').send({ sudoAllowed: true }).expect(404);
    expect(prisma.server.findFirst.mock.calls[0][0].where).toEqual({ id: 'srv-x', tenantId: 't1' });

    prisma.server.findFirst.mockResolvedValueOnce({
      id: 'srv-1',
      tenantId: 't1',
      authMode: 'key',
      credentialId: 'cred-1',
      hostKeyFingerprint: KEY.fingerprint,
    });
    prisma.connectedAccount.findFirst.mockResolvedValue({ id: 'cred-1' });
    await request(app).patch('/api/servers/srv-1').send({ hostKey: KEY2.line }).expect(200);
    expect(prisma.server.update.mock.calls[0][0].data).toMatchObject({
      hostKey: KEY2.line,
      hostKeyFingerprint: KEY2.fingerprint,
    });
  });

  it('check connects with the pinned key and records the outcome', async () => {
    const prisma = makePrisma();
    prisma.server.findFirst.mockResolvedValue({
      id: 'srv-1',
      tenantId: 't1',
      name: 'prod-1',
      host: 'prod-1.example.com',
      port: 22,
      username: 'deploy',
      hostKey: KEY.line,
      authMode: 'key',
      credentialId: 'cred-1',
      sudoAllowed: true,
    });
    const checkKey = jest
      .fn()
      .mockResolvedValue({ exitCode: 0, stdout: 'sudo-ok\n', stderr: '', timedOut: false });
    const app = makeApp(prisma, 'ADMIN', { checkKey });
    // The real directory would decrypt the credential; stub that one call.
    const { PrismaServerDirectory } = jest.requireActual('../../servers/server-directory');
    jest.spyOn(PrismaServerDirectory.prototype, 'privateKey').mockResolvedValue('KEY');
    const res = await request(app).post('/api/servers/srv-1/check').expect(200);
    expect(res.body.data).toEqual({ ok: true, error: null, sudo: true });
    expect(checkKey.mock.calls[0][0]).toMatchObject({ hostKey: KEY.line, privateKey: 'KEY' });
    expect(checkKey.mock.calls[0][1]).toMatch(/^sudo -n true/);
    expect(prisma.server.update.mock.calls[0][0].data.lastCheckError).toBeNull();
  });
});
