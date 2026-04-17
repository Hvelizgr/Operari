import type { PrismaClient, User } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';

/**
 * Policy constants. Tuned against the existing edge rate-limit
 * (`loginEmailRateLimiter`: 5 attempts / min / email). Those five
 * per minute are cheap to burn through; the patient attacker runs
 * 4/min forever and never trips the edge. This layer catches them
 * by carrying state across minutes and survives a server restart.
 *
 *   MAX_FAILURES    — how many wrong passwords inside WINDOW_MS
 *                     before we lock.
 *   WINDOW_MS       — rolling window the counter lives in. A failure
 *                     older than this "expires" (we reset the count
 *                     on the next write).
 *   LOCK_DURATION_MS — how long the lock lasts once tripped.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_DURATION_MS = 30 * 60 * 1000;

interface LockoutRequestCtx {
    ip?: string | null;
    userAgent?: string | null;
}

export type LockedUserSummary = Pick<
    User,
    'id' | 'tenantId' | 'failedLoginAttempts' | 'lastFailedLoginAt' | 'lockedUntil'
>;

/**
 * Encapsulates the account-lockout rules behind three calls:
 *
 *   isLocked(user)                  — pure read of lockedUntil
 *   recordFailure(user, ctx)        — increment / trip / audit
 *   recordSuccess(userId)           — clear counter + lock
 *
 * The login handler calls `isLocked` before bcrypt (fail fast) and
 * `recordFailure` only if bcrypt returned false; that ordering
 * means a valid credential still gets through even against a
 * locked account, but we re-check `isLocked` *after* bcrypt so the
 * 401 still lands (we never leak lock state by varying error shape
 * on any response).
 *
 * Audit writes are best-effort — a broken audit chain must never
 * prevent the login flow from responding.
 */
export class AccountLockoutService {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly audit?: AuditService,
    ) {}

    isLocked(user: LockedUserSummary | null, now: Date = new Date()): boolean {
        if (!user?.lockedUntil) return false;
        return user.lockedUntil.getTime() > now.getTime();
    }

    /**
     * Record a wrong-password attempt. Returns the updated
     * `failedLoginAttempts` and whether this attempt tripped the
     * lock so the caller can log-structured the outcome if it cares.
     *
     * When the last failure happened more than WINDOW_MS ago the
     * counter resets to 1 on this call — we want 5 failures *inside*
     * the window, not 5 failures ever.
     */
    async recordFailure(
        user: LockedUserSummary,
        ctx: LockoutRequestCtx = {},
        now: Date = new Date(),
    ): Promise<{ attempts: number; nowLocked: boolean }> {
        const lastFailureMs = user.lastFailedLoginAt?.getTime() ?? 0;
        const windowExpired = now.getTime() - lastFailureMs > WINDOW_MS;
        const attempts = windowExpired ? 1 : user.failedLoginAttempts + 1;
        const nowLocked = attempts >= MAX_FAILURES;
        const lockedUntil = nowLocked ? new Date(now.getTime() + LOCK_DURATION_MS) : null;

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: attempts,
                lastFailedLoginAt: now,
                ...(nowLocked ? { lockedUntil } : {}),
            },
        });

        // Always audit the failure. Fan out to account_locked only
        // on the transition edge so the audit stream shows the single
        // moment a lock was tripped, not every subsequent failed
        // attempt against an already-locked account.
        this.safeAudit('auth.login_failed', user, ctx, {
            attempts,
            windowMs: WINDOW_MS,
        });
        if (nowLocked) {
            this.safeAudit('auth.account_locked', user, ctx, {
                lockedUntil: lockedUntil?.toISOString(),
                lockDurationMs: LOCK_DURATION_MS,
                triggeredByAttempt: attempts,
            });
        }

        return { attempts, nowLocked };
    }

    /**
     * Clear the counter + lock after a successful login. Idempotent:
     * zero-counter users just stay zero. Called as the first thing
     * in the success branch so a failed bcrypt doesn't get the
     * wipe treatment.
     */
    async recordSuccess(userId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
                lockedUntil: null,
            },
        });
    }

    private safeAudit(
        type: 'auth.login_failed' | 'auth.account_locked',
        user: LockedUserSummary,
        ctx: LockoutRequestCtx,
        extra: Record<string, unknown>,
    ): void {
        if (!this.audit) return;
        void this.audit
            .record({
                tenantId: user.tenantId,
                type,
                actorId: user.id,
                actorType: 'user',
                resource: user.id,
                payload: {
                    ip: ctx.ip ?? null,
                    userAgent: ctx.userAgent ?? null,
                    ...extra,
                },
            })
            .catch(() => {
                /* never block auth on a broken audit chain */
            });
    }
}
