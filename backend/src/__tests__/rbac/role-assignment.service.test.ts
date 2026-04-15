import type { PrismaClient } from '@prisma/client';
import type { AuditService } from '../../audit/audit.service';
import type { PermissionService } from '../../rbac/permission.service';
import {
    RoleAssignmentService,
    RoleAssignmentError,
} from '../../rbac/role-assignment.service';

interface FakeUser { id: string; email: string; tenantId: string; }
interface FakeRole { id: string; name: string; tenantId: string; }
interface FakeAssignment { id: string; userId: string; roleId: string; grantedBy: string | null; }

function buildPrisma(seed: { users: FakeUser[]; roles: FakeRole[]; assignments?: FakeAssignment[] }) {
    const assignments: FakeAssignment[] = [...(seed.assignments ?? [])];
    let nextId = assignments.length + 1;

    const prisma = {
        user: {
            findUnique: jest.fn(async (args: { where: { id: string } }) => {
                return seed.users.find((u) => u.id === args.where.id) ?? null;
            }),
        },
        customRole: {
            findUnique: jest.fn(async (args: { where: { id: string } }) => {
                return seed.roles.find((r) => r.id === args.where.id) ?? null;
            }),
        },
        roleAssignment: {
            findUnique: jest.fn(async (args: {
                where: { userId_roleId: { userId: string; roleId: string } };
            }) => {
                return (
                    assignments.find(
                        (a) =>
                            a.userId === args.where.userId_roleId.userId &&
                            a.roleId === args.where.userId_roleId.roleId,
                    ) ?? null
                );
            }),
            create: jest.fn(async (args: {
                data: { userId: string; roleId: string; grantedBy: string | null };
            }) => {
                const created: FakeAssignment = {
                    id: `assign-${nextId++}`,
                    userId: args.data.userId,
                    roleId: args.data.roleId,
                    grantedBy: args.data.grantedBy,
                };
                assignments.push(created);
                return created;
            }),
            delete: jest.fn(async (args: {
                where: { userId_roleId: { userId: string; roleId: string } };
            }) => {
                const idx = assignments.findIndex(
                    (a) =>
                        a.userId === args.where.userId_roleId.userId &&
                        a.roleId === args.where.userId_roleId.roleId,
                );
                if (idx === -1) throw new Error('not found');
                const [removed] = assignments.splice(idx, 1);
                return removed;
            }),
        },
    } as unknown as PrismaClient;

    return { prisma, assignments };
}

function buildAudit(): jest.Mocked<Pick<AuditService, 'record'>> {
    return {
        record: jest.fn().mockResolvedValue({ id: 'a', hash: 'h', seq: 1n }),
    };
}

function buildPermissions(): jest.Mocked<Pick<PermissionService, 'invalidate'>> {
    return { invalidate: jest.fn() };
}

const TENANT = 'tenant-1';
const USER: FakeUser = { id: 'user-1', email: 'a@b.test', tenantId: TENANT };
const ROLE: FakeRole = { id: 'role-1', name: 'editor', tenantId: TENANT };

describe('RoleAssignmentService', () => {
    describe('grant', () => {
        it('creates the assignment, invalidates cache, emits role.granted', async () => {
            const { prisma, assignments } = buildPrisma({ users: [USER], roles: [ROLE] });
            const audit = buildAudit();
            const permissions = buildPermissions();
            const svc = new RoleAssignmentService(
                prisma,
                audit as unknown as AuditService,
                permissions as unknown as PermissionService,
            );

            const result = await svc.grant({
                userId: USER.id,
                roleId: ROLE.id,
                tenantId: TENANT,
                actorId: 'admin-1',
                actorType: 'user',
                reason: 'promoted',
            });

            expect(result.assignmentId).toBeDefined();
            expect(assignments).toHaveLength(1);
            expect(permissions.invalidate).toHaveBeenCalledWith(USER.id);
            expect(audit.record).toHaveBeenCalledTimes(1);
            const arg = audit.record.mock.calls[0][0];
            expect(arg.type).toBe('role.granted');
            expect(arg.tenantId).toBe(TENANT);
            expect(arg.actorId).toBe('admin-1');
            expect(arg.resource).toBe(`user:${USER.id}`);
            const payload = arg.payload as Record<string, unknown>;
            expect(payload.userId).toBe(USER.id);
            expect(payload.roleId).toBe(ROLE.id);
            expect(payload.roleName).toBe('editor');
            expect(payload.userEmail).toBe(USER.email);
            expect(payload.reason).toBe('promoted');
        });

        it('throws ALREADY_ASSIGNED if the user already has the role', async () => {
            const { prisma } = buildPrisma({
                users: [USER],
                roles: [ROLE],
                assignments: [{ id: 'pre-1', userId: USER.id, roleId: ROLE.id, grantedBy: null }],
            });
            const audit = buildAudit();
            const svc = new RoleAssignmentService(
                prisma,
                audit as unknown as AuditService,
                buildPermissions() as unknown as PermissionService,
            );

            await expect(
                svc.grant({ userId: USER.id, roleId: ROLE.id, tenantId: TENANT }),
            ).rejects.toMatchObject({ code: 'ALREADY_ASSIGNED' });
            expect(audit.record).not.toHaveBeenCalled();
        });

        it('refuses cross-tenant grants', async () => {
            const { prisma } = buildPrisma({
                users: [USER],
                roles: [{ ...ROLE, tenantId: 'other-tenant' }],
            });
            const audit = buildAudit();
            const svc = new RoleAssignmentService(
                prisma,
                audit as unknown as AuditService,
                buildPermissions() as unknown as PermissionService,
            );

            await expect(
                svc.grant({ userId: USER.id, roleId: ROLE.id, tenantId: TENANT }),
            ).rejects.toMatchObject({ code: 'CROSS_TENANT' });
            expect(audit.record).not.toHaveBeenCalled();
        });

        it('throws NOT_FOUND when the user does not exist', async () => {
            const { prisma } = buildPrisma({ users: [], roles: [ROLE] });
            const svc = new RoleAssignmentService(
                prisma,
                buildAudit() as unknown as AuditService,
                buildPermissions() as unknown as PermissionService,
            );
            await expect(
                svc.grant({ userId: 'ghost', roleId: ROLE.id, tenantId: TENANT }),
            ).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('revoke', () => {
        it('removes the assignment, invalidates cache, emits role.revoked', async () => {
            const { prisma, assignments } = buildPrisma({
                users: [USER],
                roles: [ROLE],
                assignments: [{ id: 'pre-1', userId: USER.id, roleId: ROLE.id, grantedBy: null }],
            });
            const audit = buildAudit();
            const permissions = buildPermissions();
            const svc = new RoleAssignmentService(
                prisma,
                audit as unknown as AuditService,
                permissions as unknown as PermissionService,
            );

            await svc.revoke({
                userId: USER.id,
                roleId: ROLE.id,
                tenantId: TENANT,
                actorId: 'admin-1',
            });

            expect(assignments).toHaveLength(0);
            expect(permissions.invalidate).toHaveBeenCalledWith(USER.id);
            expect(audit.record).toHaveBeenCalledTimes(1);
            expect(audit.record.mock.calls[0][0].type).toBe('role.revoked');
        });

        it('throws NOT_ASSIGNED when there is nothing to revoke', async () => {
            const { prisma } = buildPrisma({ users: [USER], roles: [ROLE] });
            const audit = buildAudit();
            const svc = new RoleAssignmentService(
                prisma,
                audit as unknown as AuditService,
                buildPermissions() as unknown as PermissionService,
            );

            await expect(
                svc.revoke({ userId: USER.id, roleId: ROLE.id, tenantId: TENANT }),
            ).rejects.toBeInstanceOf(RoleAssignmentError);
            expect(audit.record).not.toHaveBeenCalled();
        });
    });

    it('does not let an audit failure roll back a successful grant', async () => {
        const { prisma, assignments } = buildPrisma({ users: [USER], roles: [ROLE] });
        const audit = {
            record: jest.fn().mockRejectedValue(new Error('postgres down')),
        } as unknown as AuditService;
        const svc = new RoleAssignmentService(
            prisma,
            audit,
            buildPermissions() as unknown as PermissionService,
        );

        await expect(
            svc.grant({ userId: USER.id, roleId: ROLE.id, tenantId: TENANT }),
        ).resolves.toBeDefined();
        expect(assignments).toHaveLength(1);
    });
});
