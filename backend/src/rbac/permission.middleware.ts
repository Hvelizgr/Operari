import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { PermissionService } from './permission.service';
import { prisma } from '../server';

let permissionService: PermissionService | null = null;

/**
 * Lazy singleton — built once on first use so importing the middleware
 * has no side effects at boot time.
 */
function getService(): PermissionService {
    if (!permissionService) permissionService = new PermissionService(prisma);
    return permissionService;
}

/** Test-only: replace the global service with an injected fake. */
export function __setPermissionServiceForTest(service: PermissionService | null): void {
    permissionService = service;
}

/**
 * Build an Express middleware that requires the authenticated user to
 * hold a specific permission. Returns 401 if no user is on the request,
 * 403 if the user is missing the permission.
 *
 * Usage:
 *
 *   router.delete(
 *     '/workflows/:id',
 *     authenticate,
 *     requirePermission(Permissions.Runbook.Delete),
 *     handler,
 *   );
 *
 * The middleware always runs AFTER `authenticate` — it depends on
 * `req.user.id` being set.
 */
export function requirePermission(required: string) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Authentication required', code: 'unauthorized' });
        }
        try {
            const ok = await getService().hasPermission(req.user.id, required);
            if (!ok) {
                return res.status(403).json({
                    error: `Missing permission: ${required}`,
                    code: 'permission_denied',
                    required,
                });
            }
            return next();
        } catch (err) {
            return res.status(500).json({
                error: 'Permission check failed',
                code: 'permission_check_failed',
                details: (err as Error).message,
            });
        }
    };
}

/**
 * Convenience: require ANY of a list of permissions (OR semantics).
 * Useful when an endpoint can be reached via multiple privilege paths.
 */
export function requireAnyPermission(...required: string[]) {
    if (required.length === 0) {
        throw new Error('requireAnyPermission: at least one permission must be supplied');
    }
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Authentication required', code: 'unauthorized' });
        }
        try {
            const service = getService();
            const granted = await service.getPermissions(req.user.id);
            for (const perm of required) {
                if (await service.hasPermission(req.user.id, perm)) {
                    return next();
                }
            }
            void granted;
            return res.status(403).json({
                error: `Missing one of: ${required.join(', ')}`,
                code: 'permission_denied',
                required,
            });
        } catch (err) {
            return res.status(500).json({
                error: 'Permission check failed',
                code: 'permission_check_failed',
                details: (err as Error).message,
            });
        }
    };
}
