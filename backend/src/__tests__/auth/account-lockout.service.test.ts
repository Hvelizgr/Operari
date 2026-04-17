import {
    AccountLockoutService,
    MAX_FAILURES,
    WINDOW_MS,
    LOCK_DURATION_MS,
} from '../../auth/account-lockout.service';

type MockUser = {
    id: string;
    tenantId: string;
    failedLoginAttempts: number;
    lastFailedLoginAt: Date | null;
    lockedUntil: Date | null;
};

function fakeUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
        id: 'user-1',
        tenantId: 'tenant-1',
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
        ...overrides,
    };
}

describe('AccountLockoutService', () => {
    const mockUpdate = jest.fn();
    const mockAuditRecord = jest.fn().mockResolvedValue(undefined);

    const prisma = {
        user: { update: mockUpdate },
    } as unknown as import('@prisma/client').PrismaClient;

    const audit = { record: mockAuditRecord } as unknown as import('../../audit/audit.service').AuditService;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUpdate.mockResolvedValue({});
    });

    describe('isLocked', () => {
        it('returns false when lockedUntil is null', () => {
            const svc = new AccountLockoutService(prisma, audit);
            expect(svc.isLocked(fakeUser())).toBe(false);
        });

        it('returns true when lockedUntil is in the future', () => {
            const svc = new AccountLockoutService(prisma, audit);
            const user = fakeUser({ lockedUntil: new Date(Date.now() + 60_000) });
            expect(svc.isLocked(user)).toBe(true);
        });

        it('returns false once the lock has expired (self-healing, no cron needed)', () => {
            const svc = new AccountLockoutService(prisma, audit);
            const user = fakeUser({ lockedUntil: new Date(Date.now() - 1000) });
            expect(svc.isLocked(user)).toBe(false);
        });

        it('returns false for null user (defensive)', () => {
            const svc = new AccountLockoutService(prisma, audit);
            expect(svc.isLocked(null)).toBe(false);
        });
    });

    describe('recordFailure', () => {
        it('increments the counter on each consecutive failure', async () => {
            const svc = new AccountLockoutService(prisma, audit);
            const user = fakeUser({ failedLoginAttempts: 2, lastFailedLoginAt: new Date() });

            const result = await svc.recordFailure(user, { ip: '1.2.3.4' });
            expect(result.attempts).toBe(3);
            expect(result.nowLocked).toBe(false);
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'user-1' },
                    data: expect.objectContaining({ failedLoginAttempts: 3 }),
                }),
            );
        });

        it('resets the counter to 1 when the prior failure is outside the window', async () => {
            const svc = new AccountLockoutService(prisma, audit);
            const old = new Date(Date.now() - WINDOW_MS - 1000);
            const user = fakeUser({ failedLoginAttempts: 4, lastFailedLoginAt: old });

            const result = await svc.recordFailure(user);
            expect(result.attempts).toBe(1);
            expect(result.nowLocked).toBe(false);
        });

        it('locks the account once MAX_FAILURES is reached', async () => {
            const svc = new AccountLockoutService(prisma, audit);
            const user = fakeUser({
                failedLoginAttempts: MAX_FAILURES - 1,
                lastFailedLoginAt: new Date(),
            });

            const result = await svc.recordFailure(user, { ip: '1.2.3.4', userAgent: 'curl' });
            expect(result.nowLocked).toBe(true);

            const updateCall = mockUpdate.mock.calls[0]![0] as {
                data: { lockedUntil?: Date };
            };
            expect(updateCall.data.lockedUntil).toBeInstanceOf(Date);
            const lockMs = updateCall.data.lockedUntil!.getTime();
            expect(lockMs - Date.now()).toBeGreaterThan(LOCK_DURATION_MS - 2000);
            expect(lockMs - Date.now()).toBeLessThan(LOCK_DURATION_MS + 2000);
        });

        it('audits auth.login_failed on every failure and auth.account_locked only on the transition', async () => {
            const svc = new AccountLockoutService(prisma, audit);
            const user = fakeUser({
                failedLoginAttempts: MAX_FAILURES - 1,
                lastFailedLoginAt: new Date(),
            });

            await svc.recordFailure(user, { ip: '1.2.3.4', userAgent: 'curl' });
            // Promise chain resolves on next microtask; flush them so the
            // audit spy sees its invocations.
            await new Promise((r) => setImmediate(r));

            const types = mockAuditRecord.mock.calls.map(
                (c) => (c[0] as { type: string }).type,
            );
            expect(types).toContain('auth.login_failed');
            expect(types).toContain('auth.account_locked');
        });
    });

    describe('recordSuccess', () => {
        it('zeroes the counter and clears any lock', async () => {
            const svc = new AccountLockoutService(prisma, audit);
            await svc.recordSuccess('user-1');
            expect(mockUpdate).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: {
                    failedLoginAttempts: 0,
                    lastFailedLoginAt: null,
                    lockedUntil: null,
                },
            });
        });
    });
});
