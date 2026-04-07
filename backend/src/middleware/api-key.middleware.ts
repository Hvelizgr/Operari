import { Request, Response, NextFunction } from 'express';
import { ApiKeyService, ApiKeyContext } from '../runbook/services/api-key.service';
import { prisma } from '../server';

let apiKeyService: ApiKeyService | null = null;
function getService() {
    if (!apiKeyService) apiKeyService = new ApiKeyService(prisma);
    return apiKeyService;
}

export interface ApiKeyRequest extends Request {
    apiContext?: ApiKeyContext;
}

/**
 * Middleware that validates Bearer API keys for /api/v1/* endpoints.
 *
 * Usage:
 *   router.post('/runbooks/:slug/trigger', requireApiKey('runbooks:trigger'), handler);
 *
 * If requiredScope is omitted, just checks the key is valid (no scope check).
 */
export function requireApiKey(requiredScope?: string) {
    return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing API key', code: 'missing_api_key' });
        }

        const rawKey = auth.substring(7);
        const context = await getService().validate(rawKey);

        if (!context) {
            return res.status(401).json({ error: 'Invalid or expired API key', code: 'invalid_api_key' });
        }

        if (requiredScope && !context.scopes.includes(requiredScope) && !context.scopes.includes('*')) {
            return res.status(403).json({
                error: `Missing required scope: ${requiredScope}`,
                code: 'insufficient_scope',
                required: requiredScope,
                granted: context.scopes,
            });
        }

        req.apiContext = context;
        next();
    };
}
