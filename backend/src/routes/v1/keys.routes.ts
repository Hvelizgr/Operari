import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../server';
import { ApiKeyService } from '../../runbook/services/api-key.service';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();

let _service: ApiKeyService | null = null;
function getService() {
  if (!_service) _service = new ApiKeyService(prisma);
  return _service;
}

// Use the legacy session-based auth for managing API keys (UI usage),
// not the API key auth itself (chicken-and-egg).
router.use(async (req: AuthRequest, _res, next) => {
  if (!req.user) {
    // Bootstrap default tenant for anonymous mode (mirrors chat.routes.ts pattern)
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'default' },
      update: {},
      create: { id: 'default-tenant', name: 'Default', slug: 'default', plan: 'FREE' },
    });
    await prisma.user.upsert({
      where: { email: 'anonymous@nanorun.local' },
      update: {},
      create: {
        id: 'anonymous',
        email: 'anonymous@nanorun.local',
        passwordHash: '',
        name: 'Anonymous',
        role: 'USER',
        tenantId: tenant.id,
      },
    });
    req.user = {
      id: 'anonymous',
      email: 'anonymous@nanorun.local',
      role: 'USER',
      tenantId: tenant.id,
    };
  }
  next();
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(['runbooks:read', 'runbooks:trigger', 'runs:read']),
  expiresAt: z.string().datetime().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const keys = await getService().list(req.user!.tenantId);
  res.json({ data: keys });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopes, expiresAt } = createSchema.parse(req.body);
    const key = await getService().create(
      req.user!.tenantId,
      name,
      scopes,
      req.user!.id,
      expiresAt ? new Date(expiresAt) : undefined
    );
    // Return plainKey ONCE — never shown again
    res.status(201).json({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      createdAt: key.createdAt,
      key: key.plainKey,
      warning: 'Save this key now — it will not be shown again.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ok = await getService().revoke(req.user!.tenantId, String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'API key not found' });
  res.json({ revoked: true });
});

export default router;
