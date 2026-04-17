import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import { verifyTotp } from './totp';
import { consumeBackupCode } from './mfa-backup-codes';
import { secretCipherFromEnv } from '../security/secret-cipher';

export class AccountDeletionError extends Error {
    constructor(
        message: string,
        readonly code:
            | 'invalid_credentials'
            | 'mfa_required'
            | 'mfa_invalid'
            | 'tenant_has_other_members',
    ) {
        super(message);
        this.name = 'AccountDeletionError';
    }
}

export interface DeleteAccountInput {
    userId: string;
    password: string;
    totpCode?: string;
    /** "I also want my workspace deleted". Required when the user is
     *  the only member — we re-surface this as a flag from the UI so
     *  deletion can't happen by accident. */
    deleteTenantIfSoleMember?: boolean;
}

export interface DeleteAccountResult {
    deletedUserId: string;
    deletedTenantId: string | null;
}

/**
 * GDPR self-serve account purge.
 *
 * The hash-chained audit log is immutable at the DB level (trigger
 * blocks UPDATE + DELETE), so we cannot scrub `actorId` out of past
 * events. Instead we write `user.deleted` / `tenant.deleted`
 * tombstones so a compliance audit can see the purge timestamp and
 * the chain stays verifiable.
 *
 * Scope of deletion:
 *   - Everything User.* cascades drops: oauth accounts, backup
 *     codes, password reset tokens, email verification tokens,
 *     role assignments.
 *   - Non-cascading personal data (Runbook, Execution, Conversation,
 *     ConnectedAccount) is deleted explicitly when the user is the
 *     sole tenant member. Those rows belong to the *tenant*, so when
 *     other members exist they stay (the team keeps its runbooks)
 *     and the deletion is blocked until the user transfers admin /
 *     is removed from the tenant first.
 *
 * Ordering matters: we delete child rows before the parent User so
 * a transient FK constraint never surfaces. Everything runs inside a
 * single prisma.$transaction so a mid-way failure rolls back and
 * leaves no half-deleted state.
 */
export class AccountDeletionService {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly audit?: AuditService,
    ) {}

    async deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountResult> {
        const user = await this.prisma.user.findUnique({
            where: { id: input.userId },
            select: {
                id: true,
                email: true,
                tenantId: true,
                passwordHash: true,
                mfaEnabled: true,
                mfaSecretCiphered: true,
            },
        });

        if (!user) {
            // Very unlikely (the session middleware already confirms
            // existence) but don't leak via 404 vs 401 either way.
            throw new AccountDeletionError('Invalid credentials', 'invalid_credentials');
        }

        if (!user.passwordHash) {
            // OAuth-only account — no password to reconfirm. Rather
            // than ship a second-factor-only deletion path here,
            // require the user to set a password first. Keeps the
            // deletion contract simple + uniform.
            throw new AccountDeletionError(
                'Set a password before deleting your account',
                'invalid_credentials',
            );
        }

        const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordOk) {
            throw new AccountDeletionError('Invalid credentials', 'invalid_credentials');
        }

        // MFA gate matches the login handler's behavior — a user who
        // enrolled TOTP has already proven they can produce a code,
        // so we refuse destructive actions without one. Accept
        // backup codes the same way login does (single-use).
        if (user.mfaEnabled && user.mfaSecretCiphered) {
            if (!input.totpCode) {
                throw new AccountDeletionError('MFA code required', 'mfa_required');
            }
            const cipher = secretCipherFromEnv();
            const secret = cipher.decrypt(user.mfaSecretCiphered, `mfa:${user.id}`);
            const totpOk =
                /^\d{6}$/.test(input.totpCode) && verifyTotp(secret, input.totpCode);
            const backupOk = totpOk
                ? false
                : await consumeBackupCode(this.prisma, user.id, input.totpCode);
            if (!totpOk && !backupOk) {
                throw new AccountDeletionError('Invalid MFA code', 'mfa_invalid');
            }
        }

        // Tenant membership branch.
        const tenantMemberCount = await this.prisma.user.count({
            where: { tenantId: user.tenantId },
        });

        const soleMember = tenantMemberCount <= 1;
        const deleteTenant = soleMember && !!input.deleteTenantIfSoleMember;

        if (soleMember && !input.deleteTenantIfSoleMember) {
            // Without the flag we can't purge a tenant that only has
            // this user — dangling runbooks + executions would stay.
            // Ask the caller to opt in explicitly so the UX has a
            // chance to double-confirm.
            throw new AccountDeletionError(
                'Deleting the last member requires tenant deletion confirmation',
                'tenant_has_other_members',
            );
        }

        if (!soleMember) {
            throw new AccountDeletionError(
                'Tenant has other members; transfer admin ownership first',
                'tenant_has_other_members',
            );
        }

        // At this point: user is the sole member + the caller asked
        // for tenant deletion. Cascade the whole tenant out, then the
        // user row. Prisma onDelete: Cascade fires for everything
        // hanging off Tenant (Runbook → Execution → ..., Webhook,
        // StorageBucket, Conversation, ConnectedAccount, etc). The
        // User row itself is NOT under Tenant.cascade, so we delete
        // it explicitly second.
        await this.prisma.$transaction(async (tx) => {
            await tx.tenant.delete({ where: { id: user.tenantId } });
            await tx.user.delete({ where: { id: user.id } });
        });

        // Audit AFTER the cascade. The trigger on AuditEvent only
        // forbids mutation — inserts are fine — so this always
        // lands. Fire-and-forget so a broken audit chain never
        // surfaces as a deletion failure to the user.
        void this.writeTombstones(user.id, user.tenantId, user.email, deleteTenant);

        return {
            deletedUserId: user.id,
            deletedTenantId: deleteTenant ? user.tenantId : null,
        };
    }

    private async writeTombstones(
        userId: string,
        tenantId: string,
        email: string,
        alsoTenant: boolean,
    ): Promise<void> {
        if (!this.audit) return;
        // Note: the tenant is already deleted, so we cannot anchor
        // the event on its id via the normal FK. The AuditEvent
        // table carries `tenantId` as a string column (no FK
        // enforced) so the tombstone survives the parent row being
        // gone.
        const payloadBase = {
            deletedAt: new Date().toISOString(),
            email,
            tenantDeleted: alsoTenant,
        };
        await Promise.allSettled([
            this.audit.record({
                tenantId,
                type: 'user.deleted',
                actorId: userId,
                actorType: 'user',
                resource: userId,
                payload: payloadBase,
            }),
            ...(alsoTenant
                ? [
                      this.audit.record({
                          tenantId,
                          type: 'tenant.deleted',
                          actorId: userId,
                          actorType: 'user',
                          resource: tenantId,
                          payload: payloadBase,
                      }),
                  ]
                : []),
        ]);
    }
}
