import {
    permissionsMatch,
    Permissions,
    ALL_PERMISSIONS,
    SYSTEM_ROLES,
    legacyPermissions,
} from '../../rbac/permissions';

describe('permissionsMatch', () => {
    it('returns true on exact match', () => {
        const granted = new Set(['runbook:read']);
        expect(permissionsMatch(granted, 'runbook:read')).toBe(true);
    });

    it('returns false on miss', () => {
        const granted = new Set(['runbook:read']);
        expect(permissionsMatch(granted, 'runbook:write')).toBe(false);
    });

    it('honors global wildcard "*"', () => {
        const granted = new Set(['*']);
        expect(permissionsMatch(granted, 'runbook:delete')).toBe(true);
        expect(permissionsMatch(granted, 'audit:read')).toBe(true);
        expect(permissionsMatch(granted, 'tenant:admin')).toBe(true);
    });

    it('honors resource wildcard "<resource>:*"', () => {
        const granted = new Set(['runbook:*']);
        expect(permissionsMatch(granted, 'runbook:read')).toBe(true);
        expect(permissionsMatch(granted, 'runbook:write')).toBe(true);
        expect(permissionsMatch(granted, 'audit:read')).toBe(false);
    });

    it('throws when the required permission is itself a wildcard', () => {
        const granted = new Set(['*']);
        expect(() => permissionsMatch(granted, '*')).toThrow();
        expect(() => permissionsMatch(granted, 'runbook:*')).toThrow();
    });
});

describe('Permissions catalog', () => {
    it('has unique values across the entire tree', () => {
        const seen = new Set<string>();
        const dups: string[] = [];
        for (const p of ALL_PERMISSIONS) {
            if (seen.has(p)) dups.push(p);
            seen.add(p);
        }
        expect(dups).toEqual([]);
    });

    it('uses the resource:verb format consistently', () => {
        for (const p of ALL_PERMISSIONS) {
            expect(p).toMatch(/^[a-z]+(?::[a-z]+)+$/);
        }
    });

    it('exposes Runbook.Read = "runbook:read" for stable use at call sites', () => {
        expect(Permissions.Runbook.Read).toBe('runbook:read');
        expect(Permissions.All).toBe('*');
    });
});

describe('SYSTEM_ROLES', () => {
    it('defines admin, editor, runner, viewer with non-empty permissions', () => {
        const names = SYSTEM_ROLES.map((r) => r.name);
        expect(names).toEqual(['admin', 'editor', 'runner', 'viewer']);
        for (const role of SYSTEM_ROLES) {
            expect(role.permissions.length).toBeGreaterThan(0);
        }
    });

    it('admin role grants the global wildcard', () => {
        const admin = SYSTEM_ROLES.find((r) => r.name === 'admin');
        expect(admin?.permissions).toContain('*');
    });

    it('viewer role contains no write permissions', () => {
        const viewer = SYSTEM_ROLES.find((r) => r.name === 'viewer');
        for (const p of viewer?.permissions ?? []) {
            expect(p).not.toMatch(/write|delete|cancel|admin/);
        }
    });
});

describe('legacyPermissions', () => {
    it('ADMIN gets the wildcard', () => {
        expect(legacyPermissions('ADMIN')).toContain('*');
    });
    it('USER gets editor-style perms but not the wildcard', () => {
        const perms = legacyPermissions('USER');
        expect(perms).toContain('runbook:write');
        expect(perms).not.toContain('*');
    });
    it('VIEWER is read-only', () => {
        const perms = legacyPermissions('VIEWER');
        expect(perms).toContain('runbook:read');
        for (const p of perms) {
            expect(p).not.toMatch(/write|delete|cancel|admin/);
        }
    });
});
