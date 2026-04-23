import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { buildAuthProvider } from '../../auth';
import { AuthTransportError } from '../../auth/auth-provider.types';
import { JwtAuthProvider } from '../../auth/jwt-auth-provider';
import { WorkOSAuthProvider, type WorkOSClaims } from '../../auth/workos-auth-provider';

const SECRET = 'test-secret';

function buildPrisma(
  seed: {
    users?: Array<{ id: string; email: string; role: string; tenantId: string }>;
    tenants?: Array<{ id: string; workosOrganizationId?: string | null }>;
  } = {}
) {
  const users = [...(seed.users ?? [])];
  const tenants = [...(seed.tenants ?? [])];
  return {
    user: {
      findUnique: jest.fn(async (args: { where: { id?: string; email?: string } }) => {
        if (args.where.id) return users.find(u => u.id === args.where.id) ?? null;
        if (args.where.email) return users.find(u => u.email === args.where.email) ?? null;
        return null;
      }),
      upsert: jest.fn(
        async (args: {
          where: { email: string };
          create: {
            email: string;
            name: string;
            passwordHash: string;
            tenantId: string;
            role: string;
          };
          update: { tenantId: string; role: string };
        }) => {
          const existing = users.find(u => u.email === args.where.email);
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
        }
      ),
    },
    tenant: {
      findUnique: jest.fn(async (args: { where: { workosOrganizationId?: string } }) => {
        if (!args.where.workosOrganizationId) return null;
        const found = tenants.find(t => t.workosOrganizationId === args.where.workosOrganizationId);
        return found ? { id: found.id } : null;
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
      SECRET
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

  it('returns null when no NanoRun tenant is linked to the WorkOS organization (fail closed)', async () => {
    // The tenant table has no row with workosOrganizationId='org-1',
    // so findUnique returns null and verifyToken refuses the
    // session. Pins the fail-closed contract: WorkOS knows the
    // user but the user belongs to an org we do not host →
    // 401, not silent success.
    const prisma = buildPrisma({ tenants: [] });
    const provider = new WorkOSAuthProvider(prisma, {
      verifyJwksToken: async () => validClaims,
    });
    await expect(provider.verifyToken('valid')).resolves.toBeNull();
  });

  it('resolves the tenant by workosOrganizationId and upserts the user (happy path)', async () => {
    const prisma = buildPrisma({
      tenants: [{ id: 'tenant-cloud-1', workosOrganizationId: 'org-1' }],
    });
    const provider = new WorkOSAuthProvider(prisma, {
      verifyJwksToken: async () => validClaims,
    });

    const user = await provider.verifyToken('valid');
    expect(user).not.toBeNull();
    expect(user!.tenantId).toBe('tenant-cloud-1');
    expect(user!.email).toBe('sso@enterprise.test');
    expect(user!.provider).toBe('workos');
    // Default mapRole passes the WorkOS role through
    expect(user!.role).toBe('admin');
  });

  it('upsert preserves the existing user across repeat sessions', async () => {
    const prisma = buildPrisma({
      tenants: [{ id: 'tenant-cloud-1', workosOrganizationId: 'org-1' }],
      users: [
        {
          id: 'preexisting-user',
          email: 'sso@enterprise.test',
          role: 'USER',
          tenantId: 'tenant-cloud-1',
        },
      ],
    });
    const provider = new WorkOSAuthProvider(prisma, {
      verifyJwksToken: async () => validClaims,
    });
    const first = await provider.verifyToken('valid');
    const second = await provider.verifyToken('valid');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Same DB id (the upsert hit the existing row, not a new one)
    expect(second!.id).toBe(first!.id);
  });

  it('honors the mapRole option for custom WorkOS → NanoRun role mapping', async () => {
    const prisma = buildPrisma({
      tenants: [{ id: 'tenant-cloud-1', workosOrganizationId: 'org-1' }],
    });
    const provider = new WorkOSAuthProvider(prisma, {
      verifyJwksToken: async () => validClaims,
      mapRole: role => (role === 'admin' ? 'ADMIN' : 'USER'),
    });
    const user = await provider.verifyToken('valid');
    expect(user!.role).toBe('ADMIN');
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
