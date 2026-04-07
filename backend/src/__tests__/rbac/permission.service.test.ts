import type { PrismaClient } from '@prisma/client';
import { PermissionService } from '../../rbac/permission.service';

interface FakeUserRow {
    id: string;
    role: 'ADMIN' | 'USER' | 'VIEWER';
    roleAssignments: Array<{
        role: { id: string; permissions: string[] };
    }>;
}

interface FakeRoleRow {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    permissions: string[];
    isSystem: boolean;
}

const buildPrisma = (users: FakeUserRow[]) => {
    const customRoles: FakeRoleRow[] = [];
    const prisma = {
        user: {
            findUnique: jest.fn(async (args: { where: { id: string } }) => {
                return users.find((u) => u.id === args.where.id) ?? null;
            }),
        },
        customRole: {
            upsert: jest.fn(async (args: {
                where: { tenantId_name: { tenantId: string; name: string } };
                create: Omit<FakeRoleRow, 'id'>;
                update: Partial<FakeRoleRow>;
            }) => {
                const existing = customRoles.find(
                    (r) =>
                        r.tenantId === args.where.tenantId_name.tenantId &&
                        r.name === args.where.tenantId_name.name,
                );
                if (existing) {
                    Object.assign(existing, args.update);
                    return existing;
                }
                const created: FakeRoleRow = {
                    id: `role-${customRoles.length + 1}`,
                    description: args.create.description ?? null,
                    tenantId: args.create.tenantId,
                    name: args.create.name,
                    permissions: args.create.permissions,
                    isSystem: args.create.isSystem,
                };
                customRoles.push(created);
                return created;
            }),
        },
    } as unknown as PrismaClient;

    return { prisma, customRoles };
};

describe('PermissionService.getPermissions', () => {
    it('falls back to legacy ADMIN role when no assignments exist', async () => {
        const { prisma } = buildPrisma([
            { id: 'u-1', role: 'ADMIN', roleAssignments: [] },
        ]);
        const service = new PermissionService(prisma);
        const perms = await service.getPermissions('u-1');
        expect(perms.has('*')).toBe(true);
    });

    it('falls back to legacy USER role when no assignments exist', async () => {
        const { prisma } = buildPrisma([
            { id: 'u-1', role: 'USER', roleAssignments: [] },
        ]);
        const service = new PermissionService(prisma);
        const perms = await service.getPermissions('u-1');
        expect(perms.has('*')).toBe(false);
        expect(perms.has('runbook:write')).toBe(true);
    });

    it('falls back to legacy VIEWER role when no assignments exist', async () => {
        const { prisma } = buildPrisma([
            { id: 'u-1', role: 'VIEWER', roleAssignments: [] },
        ]);
        const service = new PermissionService(prisma);
        const perms = await service.getPermissions('u-1');
        expect(perms.has('runbook:read')).toBe(true);
        expect(perms.has('runbook:write')).toBe(false);
    });

    it('uses CustomRole assignments when present, ignoring the legacy enum', async () => {
        const { prisma } = buildPrisma([
            {
                id: 'u-1',
                // Legacy ADMIN — but custom roles override this
                role: 'ADMIN',
                roleAssignments: [
                    { role: { id: 'r-viewer', permissions: ['runbook:read'] } },
                ],
            },
        ]);
        const service = new PermissionService(prisma);
        const perms = await service.getPermissions('u-1');
        expect(perms.has('*')).toBe(false);
        expect(perms.has('runbook:read')).toBe(true);
        expect(perms.has('runbook:write')).toBe(false);
    });

    it('unions permissions across multiple custom role assignments', async () => {
        const { prisma } = buildPrisma([
            {
                id: 'u-1',
                role: 'USER',
                roleAssignments: [
                    { role: { id: 'r-1', permissions: ['runbook:read'] } },
                    { role: { id: 'r-2', permissions: ['audit:read'] } },
                ],
            },
        ]);
        const service = new PermissionService(prisma);
        const perms = await service.getPermissions('u-1');
        expect(perms.has('runbook:read')).toBe(true);
        expect(perms.has('audit:read')).toBe(true);
    });

    it('returns empty set for an unknown user', async () => {
        const { prisma } = buildPrisma([]);
        const service = new PermissionService(prisma);
        const perms = await service.getPermissions('ghost');
        expect(perms.size).toBe(0);
    });

    it('caches the result and only hits the DB once until invalidated', async () => {
        const { prisma } = buildPrisma([
            { id: 'u-1', role: 'USER', roleAssignments: [] },
        ]);
        const service = new PermissionService(prisma);

        await service.getPermissions('u-1');
        await service.getPermissions('u-1');
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

        service.invalidate('u-1');
        await service.getPermissions('u-1');
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
});

describe('PermissionService.hasPermission', () => {
    it('honors wildcards in the resolved set', async () => {
        const { prisma } = buildPrisma([
            { id: 'u-1', role: 'ADMIN', roleAssignments: [] },
        ]);
        const service = new PermissionService(prisma);
        expect(await service.hasPermission('u-1', 'runbook:delete')).toBe(true);
        expect(await service.hasPermission('u-1', 'tenant:admin')).toBe(true);
    });

    it('returns false when permission is missing', async () => {
        const { prisma } = buildPrisma([
            { id: 'u-1', role: 'VIEWER', roleAssignments: [] },
        ]);
        const service = new PermissionService(prisma);
        expect(await service.hasPermission('u-1', 'runbook:write')).toBe(false);
    });
});

describe('PermissionService.seedSystemRoles', () => {
    it('upserts the four built-in roles for a tenant', async () => {
        const { prisma, customRoles } = buildPrisma([]);
        const service = new PermissionService(prisma);
        await service.seedSystemRoles('tenant-9');

        expect(customRoles.map((r) => r.name).sort()).toEqual([
            'admin',
            'editor',
            'runner',
            'viewer',
        ]);
        for (const role of customRoles) {
            expect(role.tenantId).toBe('tenant-9');
            expect(role.isSystem).toBe(true);
            expect(role.permissions.length).toBeGreaterThan(0);
        }
    });

    it('is idempotent (safe to call twice)', async () => {
        const { prisma, customRoles } = buildPrisma([]);
        const service = new PermissionService(prisma);
        await service.seedSystemRoles('tenant-9');
        await service.seedSystemRoles('tenant-9');
        expect(customRoles).toHaveLength(4);
    });
});
