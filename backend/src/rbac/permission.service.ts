import type { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES, legacyPermissions, permissionsMatch } from './permissions';

export interface PermissionServiceOptions {
  /**
   * Cache time-to-live in milliseconds. The effective permission set
   * for a user is cached so we don't issue a DB round-trip on every
   * request. Default 30s — short enough that role revocations take
   * effect quickly, long enough to amortize.
   */
  cacheTtlMs?: number;
}

interface CachedSet {
  permissions: Set<string>;
  expiresAt: number;
}

/**
 * PermissionService — resolves the effective permission set of a user
 * and answers `hasPermission(userId, perm)` queries used by RBAC
 * middleware.
 *
 * Resolution algorithm:
 *   1. If the user has at least one RoleAssignment, the effective set
 *      is the UNION of every CustomRole.permissions array. Custom
 *      roles win — even an ADMIN-enum user can be locked down by
 *      assigning them a `viewer` role and nothing else.
 *   2. Otherwise the user falls back to the legacy `User.role` enum
 *      via {@link legacyPermissions}. This keeps every existing
 *      endpoint working without forcing a data migration.
 *
 * Tenant safety: this service does NOT check tenant isolation by
 * itself. The caller (route handler / middleware) must already have
 * authenticated the user and pulled their tenantId from the JWT. The
 * RBAC layer answers "does this user have this permission" and
 * nothing else.
 */
export class PermissionService {
  private readonly cache = new Map<string, CachedSet>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    options: PermissionServiceOptions = {}
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000;
  }

  /**
   * Resolve the effective permission set for a user. Cached.
   */
  async getPermissions(userId: string): Promise<Set<string>> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    let permissions: Set<string>;

    if (!user) {
      permissions = new Set();
    } else if (user.roleAssignments.length > 0) {
      permissions = new Set();
      for (const assignment of user.roleAssignments) {
        for (const perm of assignment.role.permissions) {
          permissions.add(perm);
        }
      }
    } else {
      permissions = new Set(legacyPermissions(user.role));
    }

    this.cache.set(userId, {
      permissions,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return permissions;
  }

  /**
   * Check whether a user has a specific permission. Wildcards in the
   * granted set are honored; the required permission must be concrete
   * (see {@link permissionsMatch}).
   */
  async hasPermission(userId: string, required: string): Promise<boolean> {
    const granted = await this.getPermissions(userId);
    return permissionsMatch(granted, required);
  }

  /**
   * Invalidate the cached permission set for a single user. Call this
   * after granting or revoking a role to make the change visible
   * within milliseconds instead of waiting for cache TTL.
   */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /** Invalidate every cached entry — used by tests and on global config changes. */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Create the four built-in roles for a tenant: admin, editor,
   * runner, viewer. Idempotent — safe to call multiple times via
   * `upsert`. Should run once when a tenant is provisioned (we don't
   * call this from anywhere yet to avoid touching auth.routes; it's
   * exposed so a future tenant-provisioning service or migration
   * script can invoke it).
   */
  async seedSystemRoles(tenantId: string): Promise<void> {
    for (const role of SYSTEM_ROLES) {
      await this.prisma.customRole.upsert({
        where: { tenantId_name: { tenantId, name: role.name } },
        create: {
          tenantId,
          name: role.name,
          description: role.description,
          permissions: [...role.permissions],
          isSystem: true,
        },
        update: {
          description: role.description,
          permissions: [...role.permissions],
          isSystem: true,
        },
      });
    }
  }
}
