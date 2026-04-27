/**
 * Catalog of permission strings used by Operari.
 *
 * Format: `<resource>:<verb>`. Wildcards work at the resource level
 * (`runbook:*`) and globally (`*`). Always use one of the constants
 * below — never an inline string — so the linter and grep can find
 * every call site.
 */
export const Permissions = {
  Runbook: {
    Read: 'runbook:read',
    Write: 'runbook:write',
    Execute: 'runbook:execute',
    Delete: 'runbook:delete',
  },
  Run: {
    Read: 'run:read',
    Cancel: 'run:cancel',
  },
  Approval: {
    Resolve: 'approval:resolve',
  },
  ApiKey: {
    Create: 'apikey:create',
    Revoke: 'apikey:revoke',
    List: 'apikey:list',
  },
  Audit: {
    Read: 'audit:read',
  },
  Secret: {
    Read: 'secret:read',
    Write: 'secret:write',
  },
  Tenant: {
    Admin: 'tenant:admin',
    BillingRead: 'tenant:billing:read',
  },
  /** Universal grant — equivalent to listing every permission */
  All: '*',
} as const;

/** Flat list of every permission in the catalog (excluding "*"). */
export const ALL_PERMISSIONS: readonly string[] = (() => {
  const out: string[] = [];
  const walk = (obj: Record<string, unknown>): void => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        if (value !== '*') out.push(value);
      } else if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>);
      }
    }
  };
  walk(Permissions as unknown as Record<string, unknown>);
  return Object.freeze(out);
})();

/**
 * Check whether a granted permission set covers a required permission.
 *
 * Matching rules:
 *   - exact match wins immediately
 *   - the granted token "*" covers everything
 *   - the granted token "<resource>:*" covers every verb on that resource
 *
 * The required permission must be a concrete `resource:verb` pair —
 * passing a wildcard as the *required* token is a programming error and
 * raises immediately so we don't silently allow everything.
 */
export function permissionsMatch(granted: ReadonlySet<string>, required: string): boolean {
  if (required.includes('*')) {
    throw new Error(`permissionsMatch: required permission must be concrete, got "${required}"`);
  }
  if (granted.has('*')) return true;
  if (granted.has(required)) return true;
  const colon = required.indexOf(':');
  if (colon > 0) {
    const resourceWildcard = `${required.substring(0, colon)}:*`;
    if (granted.has(resourceWildcard)) return true;
  }
  return false;
}

/**
 * Built-in role definitions seeded for every new tenant. The names are
 * lowercase by convention; they map ROUGHLY to the legacy `Role` enum
 * on User but expose the granular permissions a custom role can override.
 */
export const SYSTEM_ROLES: ReadonlyArray<{
  name: string;
  description: string;
  permissions: readonly string[];
}> = [
  {
    name: 'admin',
    description: 'Full control of the tenant',
    permissions: [Permissions.All],
  },
  {
    name: 'editor',
    description: 'Create and run runbooks, manage approvals',
    permissions: [
      Permissions.Runbook.Read,
      Permissions.Runbook.Write,
      Permissions.Runbook.Execute,
      Permissions.Run.Read,
      Permissions.Run.Cancel,
      Permissions.Approval.Resolve,
      Permissions.Audit.Read,
    ],
  },
  {
    name: 'runner',
    description: 'Execute existing runbooks but cannot edit them',
    permissions: [Permissions.Runbook.Read, Permissions.Runbook.Execute, Permissions.Run.Read],
  },
  {
    name: 'viewer',
    description: 'Read-only access',
    permissions: [Permissions.Runbook.Read, Permissions.Run.Read, Permissions.Audit.Read],
  },
];

/**
 * Permission set inherited from the legacy `User.role` enum, used as a
 * fallback when a user has zero RoleAssignments. This keeps every
 * existing endpoint working without forcing a data migration.
 */
export function legacyPermissions(legacyRole: 'ADMIN' | 'USER' | 'VIEWER'): readonly string[] {
  switch (legacyRole) {
    case 'ADMIN':
      return [Permissions.All];
    case 'USER':
      return [
        Permissions.Runbook.Read,
        Permissions.Runbook.Write,
        Permissions.Runbook.Execute,
        Permissions.Run.Read,
        Permissions.Run.Cancel,
        Permissions.Approval.Resolve,
        Permissions.Audit.Read,
      ];
    case 'VIEWER':
      return [Permissions.Runbook.Read, Permissions.Run.Read, Permissions.Audit.Read];
  }
}
