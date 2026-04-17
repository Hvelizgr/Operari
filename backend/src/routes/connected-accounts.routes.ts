import { Router, Response } from 'express';
import { prisma } from '../server';
import { AuthRequest, anonymousFallback } from '../middleware/auth.middleware';
import { ConnectedAccountService } from '../security/connected-account.service';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { AuditService } from '../audit/audit.service';
import { env } from '../config/env.config';

const router = Router();

// Lazy singleton — the service constructor demands cipher/reader/audit
// even though `list` does not use them, so we instantiate them once
// here. The encryption key is optional in dev (no real secrets are
// stored) and falls back to a deterministic 32-byte hex string so the
// list endpoint never crashes a self-host setup.
let service: ConnectedAccountService | null = null;
function getService(): ConnectedAccountService {
    if (!service) {
        const key = env.ENCRYPTION_KEY ?? '0'.repeat(64);
        const cipher = new SecretCipher(key);
        const audit = new AuditService(prisma);
        const reader = new SecretReader(cipher, audit);
        service = new ConnectedAccountService(prisma, cipher, reader, audit);
    }
    return service;
}

// Anonymous fallback gated by NANORUN_ANONYMOUS_MODE=true.
router.use(anonymousFallback);

/**
 * GET /api/connected-accounts
 *
 * Token-free list of every account the current user has linked.
 * Used by the secret picker in the editor so step authors can select
 * a credential by id without ever seeing the underlying token. The
 * runtime engine resolves the id back to a token via
 * ConnectedAccountService.getAccessToken at execution time.
 *
 * Optional ?provider=github filter to scope the picker by provider.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { id: userId, tenantId } = req.user!;
        const accounts = await getService().list(tenantId, userId);
        const provider = req.query.provider as string | undefined;
        const filtered = provider
            ? accounts.filter((a) => a.provider === provider)
            : accounts;
        res.json({
            data: filtered.map((a) => ({
                id: a.id,
                provider: a.provider,
                displayName: a.displayName,
                scopes: a.scopes,
                createdAt: a.createdAt,
                tokenExpiry: a.tokenExpiry,
            })),
        });
    } catch (err) {
        req.log.error({ err }, 'List connected accounts error');
        res.status(500).json({ error: 'Failed to list connected accounts' });
    }
});

export default router;
