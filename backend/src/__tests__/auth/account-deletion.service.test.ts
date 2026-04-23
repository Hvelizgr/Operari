import bcrypt from 'bcryptjs';

import { AccountDeletionError, AccountDeletionService } from '../../auth/account-deletion.service';

// The service calls secretCipherFromEnv + verifyTotp in the MFA
// branch; those paths are exercised by the MFA test suite, so here
// we keep tests focused on the decision logic by leaving MFA off on
// every fixture user.

type TxCallback = (tx: unknown) => Promise<unknown>;

function buildPrismaMock() {
  const user = {
    findUnique: jest.fn(),
    count: jest.fn(),
    delete: jest.fn().mockResolvedValue({}),
  };
  const tenant = {
    delete: jest.fn().mockResolvedValue({}),
  };
  const tx = { user, tenant };
  return {
    user,
    tenant,
    $transaction: jest.fn((cb: TxCallback) => cb(tx)),
  } as unknown as import('@prisma/client').PrismaClient & {
    user: typeof user;
    tenant: typeof tenant;
    $transaction: jest.Mock;
  };
}

describe('AccountDeletionService', () => {
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('../../audit/audit.service').AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects the request when the password is wrong', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      tenantId: 't1',
      passwordHash: await bcrypt.hash('actual', 4),
      mfaEnabled: false,
      mfaSecretCiphered: null,
    });
    const svc = new AccountDeletionService(prisma, audit);

    await expect(svc.deleteAccount({ userId: 'u1', password: 'guess' })).rejects.toMatchObject({
      name: 'AccountDeletionError',
      code: 'invalid_credentials',
    });
    expect(prisma.tenant.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('blocks sole-member deletion until the caller opts into tenant purge', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      tenantId: 't1',
      passwordHash: await bcrypt.hash('pw', 4),
      mfaEnabled: false,
      mfaSecretCiphered: null,
    });
    prisma.user.count.mockResolvedValue(1);

    const svc = new AccountDeletionService(prisma, audit);
    await expect(svc.deleteAccount({ userId: 'u1', password: 'pw' })).rejects.toMatchObject({
      code: 'tenant_has_other_members',
    });
    expect(prisma.tenant.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when the tenant has other members', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      tenantId: 't1',
      passwordHash: await bcrypt.hash('pw', 4),
      mfaEnabled: false,
      mfaSecretCiphered: null,
    });
    prisma.user.count.mockResolvedValue(3);

    const svc = new AccountDeletionService(prisma, audit);
    await expect(
      svc.deleteAccount({
        userId: 'u1',
        password: 'pw',
        deleteTenantIfSoleMember: true,
      })
    ).rejects.toMatchObject({ code: 'tenant_has_other_members' });
    expect(prisma.tenant.delete).not.toHaveBeenCalled();
  });

  it('deletes the tenant + user (in that order) when the user is the sole member and opts in', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      tenantId: 't1',
      passwordHash: await bcrypt.hash('pw', 4),
      mfaEnabled: false,
      mfaSecretCiphered: null,
    });
    prisma.user.count.mockResolvedValue(1);

    const svc = new AccountDeletionService(prisma, audit);
    const result = await svc.deleteAccount({
      userId: 'u1',
      password: 'pw',
      deleteTenantIfSoleMember: true,
    });

    expect(result).toEqual({ deletedUserId: 'u1', deletedTenantId: 't1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tenant.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });

    // The tenant must delete before the user — reversing the order
    // would fail the FK since User.tenantId → Tenant.id without
    // cascade on that side.
    const tenantCall = (prisma.tenant.delete as jest.Mock).mock.invocationCallOrder[0]!;
    const userCall = (prisma.user.delete as jest.Mock).mock.invocationCallOrder[0]!;
    expect(tenantCall).toBeLessThan(userCall);

    // Audit tombstones fire after the cascade. Flush microtasks
    // because the write is fire-and-forget inside the service.
    await new Promise(r => setImmediate(r));
    const types = (audit.record as jest.Mock).mock.calls.map(c => (c[0] as { type: string }).type);
    expect(types).toEqual(expect.arrayContaining(['user.deleted', 'tenant.deleted']));
  });

  it('refuses OAuth-only accounts (no passwordHash) so password reconfirm stays meaningful', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'oauth@b.c',
      tenantId: 't1',
      passwordHash: null,
      mfaEnabled: false,
      mfaSecretCiphered: null,
    });
    const svc = new AccountDeletionService(prisma, audit);
    await expect(
      svc.deleteAccount({
        userId: 'u1',
        password: 'whatever',
        deleteTenantIfSoleMember: true,
      })
    ).rejects.toBeInstanceOf(AccountDeletionError);
  });
});
