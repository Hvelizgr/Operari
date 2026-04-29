// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. tenant-scope-guard imports env.config
// transitively via logger.config, so we install compliant values before
// the import chain resolves.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import {
  installTenantScopeGuard,
  TenantScopeViolationError,
} from '../../middleware/tenant-scope-guard';

/**
 * Build a stub PrismaClient that only exposes $use, records the
 * middleware handler, and lets tests invoke it with arbitrary params.
 */
function buildStubPrisma() {
  type Middleware = (
    params: unknown,
    next: (params: unknown) => Promise<unknown>
  ) => Promise<unknown>;
  const handlers: Middleware[] = [];
  const prisma = {
    $use: (fn: Middleware) => {
      handlers.push(fn);
    },
  };
  return {
    prisma,
    invoke: async (params: { model: string; action: string; args?: unknown }) => {
      let called = false;
      const next = async (p: unknown) => {
        called = true;
        return p;
      };
      await handlers[0]!(params, next);
      return { called };
    },
  };
}

describe('tenantScopeGuard', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevStrict = process.env.OPERARI_TENANT_GUARD_STRICT;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevStrict === undefined) {
      delete process.env.OPERARI_TENANT_GUARD_STRICT;
    } else {
      process.env.OPERARI_TENANT_GUARD_STRICT = prevStrict;
    }
  });

  it('throws in development when Execution.findMany has no tenant filter', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    await expect(
      invoke({ model: 'Execution', action: 'findMany', args: { where: { status: 'RUNNING' } } })
    ).rejects.toBeInstanceOf(TenantScopeViolationError);
  });

  it('accepts Execution.findMany with where.tenantId', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'findMany',
      args: { where: { tenantId: 'tenant-1', status: 'RUNNING' } },
    });
    expect(called).toBe(true);
  });

  it('accepts a relation filter carrying tenantId', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'findMany',
      args: { where: { runbook: { tenantId: 'tenant-1' } } },
    });
    expect(called).toBe(true);
  });

  it('accepts findUnique by id (primary key lookup)', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'findUnique',
      args: { where: { id: 'exec-1' } },
    });
    expect(called).toBe(true);
  });

  it('opts out via OPERARI_ALLOW_CROSS_TENANT_QUERY and strips the flag', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const args = {
      where: { status: 'RUNNING' },
      OPERARI_ALLOW_CROSS_TENANT_QUERY: true,
    };
    const { called } = await invoke({ model: 'Execution', action: 'count', args });
    expect(called).toBe(true);
    // Flag was stripped before reaching the next handler.
    expect('OPERARI_ALLOW_CROSS_TENANT_QUERY' in args).toBe(false);
  });

  it('does not guard create paths (tenantId enforced by schema typing)', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'create',
      args: { data: { runbookId: 'w', userId: 'u', trigger: 'MANUAL', tenantId: 't' } },
    });
    expect(called).toBe(true);
  });

  it('does not guard non-tenant-scoped models (e.g. Runbook)', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Runbook',
      action: 'findMany',
      args: { where: { name: 'x' } },
    });
    expect(called).toBe(true);
  });

  it('soft-fails in production (logs, does not throw)', async () => {
    process.env.NODE_ENV = 'production';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'findMany',
      args: { where: { status: 'RUNNING' } },
    });
    // Query was allowed through in prod — safety net logs instead.
    expect(called).toBe(true);
  });

  it('accepts an AND composite where every branch is tenant-scoped', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'findMany',
      args: {
        where: {
          AND: [{ tenantId: 'tenant-1' }, { status: 'RUNNING' }],
        },
      },
    });
    expect(called).toBe(true);
  });

  it('rejects an OR composite where one branch is not scoped', async () => {
    process.env.NODE_ENV = 'development';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    await expect(
      invoke({
        model: 'Execution',
        action: 'findMany',
        args: {
          where: {
            OR: [{ tenantId: 'tenant-1' }, { status: 'RUNNING' }],
          },
        },
      })
    ).rejects.toBeInstanceOf(TenantScopeViolationError);
  });

  it('throws in production when OPERARI_TENANT_GUARD_STRICT=true', async () => {
    // T.3: once the operator has observed a clean prod log for 2 weeks,
    // flipping this flag promotes soft-fail to hard-throw without a
    // code change.
    process.env.NODE_ENV = 'production';
    process.env.OPERARI_TENANT_GUARD_STRICT = 'true';
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    await expect(
      invoke({ model: 'Execution', action: 'findMany', args: { where: { status: 'RUNNING' } } })
    ).rejects.toBeInstanceOf(TenantScopeViolationError);
  });

  it('still soft-fails in production when OPERARI_TENANT_GUARD_STRICT is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPERARI_TENANT_GUARD_STRICT;
    const { prisma, invoke } = buildStubPrisma();

    installTenantScopeGuard(prisma as any);

    const { called } = await invoke({
      model: 'Execution',
      action: 'findMany',
      args: { where: { status: 'RUNNING' } },
    });
    expect(called).toBe(true);
  });
});
