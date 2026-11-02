import type { PrismaClient } from '@prisma/client';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../audit/audit.service';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { blockedTarget } from '../security/ssrf-guard';
import { parseHostKey, scanHostKey } from '../servers/host-key';
import { PrismaServerDirectory } from '../servers/server-directory';
import { caSetupSnippet } from '../servers/ssh-ca';
import { runOverOpenSsh, runOverSsh2 } from '../servers/ssh-transport';

const hostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^[A-Za-z0-9.:-]+$/, 'expected a hostname or IP address');
const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-z_][a-z0-9_.-]{0,31}$/i, 'expected a unix username');

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    host: hostSchema,
    port: z.number().int().min(1).max(65535).default(22),
    username: usernameSchema,
    hostKey: z.string().min(1).max(4096),
    authMode: z.enum(['key', 'certificate']).default('key'),
    credentialId: z.string().min(1).max(100).nullable().optional(),
    sudoAllowed: z.boolean().default(false),
  })
  .refine(v => v.authMode === 'certificate' || !!v.credentialId, {
    message: 'key auth needs an SSH private key credential',
    path: ['credentialId'],
  });

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  username: usernameSchema.optional(),
  hostKey: z.string().min(1).max(4096).optional(),
  authMode: z.enum(['key', 'certificate']).optional(),
  credentialId: z.string().min(1).max(100).nullable().optional(),
  sudoAllowed: z.boolean().optional(),
});

const scanSchema = z.object({
  host: hostSchema,
  port: z.number().int().min(1).max(65535).default(22),
});

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  host: true,
  port: true,
  username: true,
  hostKey: true,
  hostKeyFingerprint: true,
  authMode: true,
  credentialId: true,
  sudoAllowed: true,
  lastCheckedAt: true,
  lastCheckError: true,
  createdAt: true,
  updatedAt: true,
} as const;

function adminOnly(req: AuthRequest, res: Response): boolean {
  if (req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only workspace admins can manage servers' });
    return false;
  }
  return true;
}

export interface ServersRouterDeps {
  prisma: PrismaClient;
  scan?: typeof scanHostKey;
  checkKey?: typeof runOverSsh2;
  checkCert?: typeof runOverOpenSsh;
}

export function createServersRouter(deps: ServersRouterDeps): Router {
  const { prisma } = deps;
  const scan = deps.scan ?? scanHostKey;
  const checkKey = deps.checkKey ?? runOverSsh2;
  const checkCert = deps.checkCert ?? runOverOpenSsh;
  const directory = new PrismaServerDirectory(prisma);
  const audit = new AuditService(prisma);
  const router = Router();
  router.use(authenticate);

  const record = (
    req: AuthRequest,
    type: 'server.registered' | 'server.updated' | 'server.removed',
    resource: string,
    payload: Record<string, unknown>
  ) =>
    void audit
      .record({
        tenantId: req.user!.tenantId,
        type,
        actorId: req.user!.id,
        actorType: 'user',
        resource: `server:${resource}`,
        payload,
      })
      .catch(() => undefined);

  async function credentialOk(tenantId: string, id: string | null | undefined): Promise<boolean> {
    if (!id) return true;
    const account = await prisma.connectedAccount.findFirst({ where: { id, tenantId } });
    return !!account;
  }

  router.get('/', async (req: AuthRequest, res) => {
    const servers = await prisma.server.findMany({
      where: { tenantId: req.user!.tenantId },
      select: PUBLIC_FIELDS,
      orderBy: { name: 'asc' },
    });
    res.json({ data: servers });
  });

  router.post('/scan', async (req: AuthRequest, res) => {
    if (!adminOnly(req, res)) return;
    const parsed = scanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const blocked = await blockedTarget('host', parsed.data.host);
    if (blocked) return res.status(400).json({ error: blocked });
    try {
      const key = await scan(parsed.data.host, parsed.data.port);
      res.json({ data: { hostKey: key.line, fingerprint: key.fingerprint, type: key.type } });
    } catch (err) {
      res.status(502).json({ error: `Could not read the host key: ${(err as Error).message}` });
    }
  });

  router.get('/ca', async (req: AuthRequest, res) => {
    if (!adminOnly(req, res)) return;
    try {
      const publicKey = await directory.certificateService().publicKey(req.user!.tenantId);
      res.json({ data: { publicKey, setup: caSetupSnippet(publicKey) } });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/', async (req: AuthRequest, res) => {
    if (!adminOnly(req, res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const data = parsed.data;
    let key;
    try {
      key = parseHostKey(data.hostKey);
    } catch (err) {
      return res.status(400).json({ error: `Invalid host key: ${(err as Error).message}` });
    }
    const blocked = await blockedTarget('host', data.host);
    if (blocked) return res.status(400).json({ error: blocked });
    if (!(await credentialOk(req.user!.tenantId, data.credentialId))) {
      return res.status(400).json({ error: 'Credential not found in this workspace' });
    }
    try {
      const server = await prisma.server.create({
        data: {
          tenantId: req.user!.tenantId,
          name: data.name,
          host: data.host,
          port: data.port,
          username: data.username,
          hostKey: key.line,
          hostKeyFingerprint: key.fingerprint,
          authMode: data.authMode,
          credentialId: data.authMode === 'key' ? data.credentialId : null,
          sudoAllowed: data.sudoAllowed,
          createdBy: req.user!.id,
        },
        select: PUBLIC_FIELDS,
      });
      record(req, 'server.registered', server.id, {
        name: server.name,
        host: server.host,
        port: server.port,
        fingerprint: server.hostKeyFingerprint,
        authMode: server.authMode,
        sudoAllowed: server.sudoAllowed,
      });
      res.status(201).json({ data: server });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        return res.status(409).json({ error: 'A server with that name already exists' });
      }
      throw err;
    }
  });

  router.patch('/:id', async (req: AuthRequest, res) => {
    if (!adminOnly(req, res)) return;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const existing = await prisma.server.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Server not found' });
    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.username !== undefined) update.username = data.username;
    if (data.sudoAllowed !== undefined) update.sudoAllowed = data.sudoAllowed;
    if (data.hostKey !== undefined) {
      try {
        const key = parseHostKey(data.hostKey);
        update.hostKey = key.line;
        update.hostKeyFingerprint = key.fingerprint;
      } catch (err) {
        return res.status(400).json({ error: `Invalid host key: ${(err as Error).message}` });
      }
    }
    const authMode = data.authMode ?? existing.authMode;
    const credentialId =
      data.credentialId !== undefined ? data.credentialId : existing.credentialId;
    if (authMode === 'key' && !credentialId) {
      return res.status(400).json({ error: 'key auth needs an SSH private key credential' });
    }
    if (!(await credentialOk(req.user!.tenantId, credentialId))) {
      return res.status(400).json({ error: 'Credential not found in this workspace' });
    }
    update.authMode = authMode;
    update.credentialId = authMode === 'key' ? credentialId : null;
    const server = await prisma.server.update({
      where: { id: existing.id },
      data: update,
      select: PUBLIC_FIELDS,
    });
    record(req, 'server.updated', server.id, {
      changed: Object.keys(update),
      fingerprint: server.hostKeyFingerprint,
      ...(update.hostKey ? { previousFingerprint: existing.hostKeyFingerprint } : {}),
      sudoAllowed: server.sudoAllowed,
    });
    res.json({ data: server });
  });

  router.delete('/:id', async (req: AuthRequest, res) => {
    if (!adminOnly(req, res)) return;
    const existing = await prisma.server.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Server not found' });
    await prisma.server.delete({ where: { id: existing.id } });
    record(req, 'server.removed', existing.id, {
      name: existing.name,
      host: existing.host,
      fingerprint: existing.hostKeyFingerprint,
    });
    res.status(204).end();
  });

  /** Connects with the pinned key and the stored auth and runs `true`. */
  router.post('/:id/check', async (req: AuthRequest, res) => {
    if (!adminOnly(req, res)) return;
    const server = await prisma.server.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
    });
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const blocked = await blockedTarget('host', server.host);
    const ref = { tenantId: server.tenantId, runId: `check:${server.id}`, stepId: 'check' };
    let error: string | null = blocked;
    let sudo: boolean | null = null;
    if (!error) {
      try {
        const target = { host: server.host, port: server.port, username: server.username };
        const command = server.sudoAllowed
          ? 'sudo -n true && echo sudo-ok || echo sudo-no'
          : 'true';
        const result =
          server.authMode === 'certificate'
            ? await checkCert(
                {
                  ...target,
                  hostKey: server.hostKey,
                  ...(await directory.certificate(server, ref)),
                },
                command,
                { timeoutMs: 20_000 }
              )
            : await checkKey(
                {
                  ...target,
                  hostKey: server.hostKey,
                  privateKey: await directory.privateKey(server, ref),
                },
                command,
                { timeoutMs: 20_000 }
              );
        if (result.exitCode !== 0) error = `exit ${result.exitCode}: ${result.stderr.trim()}`;
        if (server.sudoAllowed) sudo = result.stdout.includes('sudo-ok');
      } catch (err) {
        error = (err as Error).message;
      }
    }
    await prisma.server.update({
      where: { id: server.id },
      data: { lastCheckedAt: new Date(), lastCheckError: error },
    });
    res.json({ data: { ok: !error, error, sudo } });
  });

  return router;
}
