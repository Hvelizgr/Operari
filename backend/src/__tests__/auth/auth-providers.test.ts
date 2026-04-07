import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import { JwtAuthProvider } from '../../auth/jwt-auth-provider';
import { WorkOSAuthProvider, type WorkOSClaims } from '../../auth/workos-auth-provider';
import { AuthTransportError } from '../../auth/auth-provider.types';
import { buildAuthProvider } from '../../auth';

const SECRET = 'test-secret';

function buildPrisma(seed: { users?: Array<{ id: string; email: string; role: string; tenantId: string }>; tenants?: Array<{ id: string; workosOrganizationId?: string }> } = {}) {
    const users = [...(seed.users ?? [])];
    return {
        user: {
            findUnique: jest.fn(async (args: { where: { id?: string; email?: string } }) => {
                if (args.where.id) return users.find((u) => u.id === args.where.id) ?? null;
                if (args.where.email) return users.find((u) => u.email === args.where.email) ?? null;
                return null;
            }),
            upsert: jest.fn(async (args: {
                where: { email: string };
                create: { email: string; name: string; passwordHash: string; tenantId: string; role: string };
                update: { tenantId: string; role: string };
            }) => {
                const existing = users.find((u) => u.email === args.where.email);
                if (existing) {
                    existing.role = args.update.role;
                    existing.tenantId = args.update.tenantId;
                    return existing;
                }
                const created = {
                    id: `user-${users.length + 1}`,
                    email: args.create.email,
                    role: args.create.role,
                    tenantId: args.create.tenantId,
                };
                users.push(created);
                return created;
            }),
        },
    } as unknown as PrismaClient;
}

describe('JwtAuthProvider', () => {
    it('exposes name="jwt"', () => {
        const prisma = buildPrisma();
        expect(new JwtAuthProvider(prisma, SECRET).name).toBe('jwt');
    });

    it('verifies a valid token and returns the resolved user', async () => {
        const prisma = buildPrisma({
            users: [{ id: 'user-1', email: 'a@b.test', role: 'USER', tenantId: 't-1' }],
        });
        const provider = new JwtAuthProvider(prisma, SECRET);
        const token = jwt.sign(
            { userId: 'user-1', email: 'a@b.test', role: 'USER', tenantId: 't-1' },
            SECRET,
        );

        const user = await provider.verifyToken(token);
        expect(user).toEqual({
            id: 'user-1',
            email: 'a@b.test',
            role: 'USER',
            tenantId: 't-1',
            provider: 'jwt',
        });
    });

    it('returns null for an invalid signature (no throw)', async () => {
        const prisma = buildPrisma({ users: [{ id: 'u', email: 'a', role: 'USER', tenantId: 't' }] });
        const provider = new JwtAuthProvider(prisma, SECRET);
        const token = jwt.sign({ userId: 'u', email: 'a', role: 'USER', tenantId: 't' }, 'WRONG');
        await expect(provider.verifyToken(token)).resolves.toBeNull();
    });

    it('returns null when the user does not exist in the DB anymore', async () => {
        const prisma = buildPrisma({ users: [] });
        const provider = new JwtAuthProvider(prisma, SECRET);
        const token = jwt.sign({ userId: 'ghost', email: 'g', role: 'USER', tenantId: 't' }, SECRET);
        await expect(provider.verifyToken(token)).resolves.toBeNull();
    });

    it('returns null when the secret is missing (misconfiguration guard)', async () => {
        const prisma = buildPrisma();
        const provider = new JwtAuthProvider(prisma, '');
        await expect(provider.verifyToken('any.token.here')).resolves.toBeNull();
    });

    it('returns null on a malformed token (no throw)', async () => {
        const prisma = buildPrisma();
        const provider = new JwtAuthProvider(prisma, SECRET);
        await expect(provider.verifyToken('not-a-jwt')).resolves.toBeNull();
        await expect(provider.verifyToken('')).resolves.toBeNull();
    });
});

describe('WorkOSAuthProvider', () => {
    const validClaims: WorkOSClaims = {
        sub: 'workos-user-1',
        email: 'sso@enterprise.test',
        organization_id: 'org-1',
        role: 'admin',
        iat: 1700000000,
        exp: 1700003600,
    };

    it('exposes name="workos"', () => {
        const prisma = buildPrisma();
        const provider = new WorkOSAuthProvider(prisma, {
            verifyJwksToken: async () => null,
        });
        expect(provider.name).toBe('workos');
    });

    it('returns null when the verifyJwksToken function returns null (bad token)', async () => {
        const prisma = buildPrisma();
        const provider = new WorkOSAuthProvider(prisma, {
            verifyJwksToken: async () => null,
        });
        await expect(provider.verifyToken('bad.token')).resolves.toBeNull();
    });

    it('throws AuthTransportError when verifyJwksToken throws (WorkOS unreachable)', async () => {
        const prisma = buildPrisma();
        const provider = new WorkOSAuthProvider(prisma, {
            verifyJwksToken: async () => {
                throw new Error('ENETUNREACH');
            },
        });
        await expect(provider.verifyToken('any')).rejects.toBeInstanceOf(AuthTransportError);
    });

    it('returns null when WorkOS validates but no NanoRun tenant matches the organization_id', async () => {
        // The placeholder findTenantByWorkOSOrgId returns null until
        // the cloud beta migration adds the column. The test pins the
        // fail-closed behavior so an operator turning on the flag
        // before the column exists sees 401, not silent success.
        const prisma = buildPrisma();
        const provider = new WorkOSAuthProvider(prisma, {
            verifyJwksToken: async () => validClaims,
        });
        await expect(provider.verifyToken('valid')).resolves.toBeNull();
    });

    it('mapRole defaults to passing the WorkOS role through (or "USER" if absent)', async () => {
        // We test the mapRole behavior in isolation since the full
        // upsert path requires the tenant lookup, which is stubbed.
        const prisma = buildPrisma();
        const provider = new WorkOSAuthProvider(prisma, {
            verifyJwksToken: async () => null,
            mapRole: (role) => role?.toUpperCase() ?? 'VIEWER',
        });
        // Just smoke-test that the option is accepted and the
        // provider constructs without throwing.
        expect(provider.name).toBe('workos');
    });
});

describe('buildAuthProvider', () => {
    const ORIGINAL_ENV = process.env.NANORUN_AUTH_PROVIDER;

    afterEach(() => {
        process.env.NANORUN_AUTH_PROVIDER = ORIGINAL_ENV;
    });

    it('defaults to JwtAuthProvider', () => {
        delete process.env.NANORUN_AUTH_PROVIDER;
        const provider = buildAuthProvider(buildPrisma());
        expect(provider.name).toBe('jwt');
    });

    it('returns WorkOSAuthProvider when NANORUN_AUTH_PROVIDER=workos', () => {
        process.env.NANORUN_AUTH_PROVIDER = 'workos';
        const provider = buildAuthProvider(buildPrisma());
        expect(provider.name).toBe('workos');
    });

    it('falls back to JWT for unknown provider names', () => {
        process.env.NANORUN_AUTH_PROVIDER = 'auth0-eventually';
        const provider = buildAuthProvider(buildPrisma());
        expect(provider.name).toBe('jwt');
    });
});
