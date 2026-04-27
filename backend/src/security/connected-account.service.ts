import type { ConnectedAccount, Prisma, PrismaClient } from '@prisma/client';

import type { ActorType, AuditService } from '../audit/audit.service';
import type { SecretCipher } from './secret-cipher';
import type { SecretReader } from './secret-reader';

/**
 * ConnectedAccountService — the only sanctioned path for creating,
 * reading, and removing OAuth credentials in Operari.
 *
 * Why it exists:
 *   - The schema has `accessToken` / `refreshToken` columns that
 *     historically held plaintext (P0 bomb #2 in
 *     IMPLEMENTACION_NANORUN.md). Every new write MUST go through
 *     `SecretCipher.encrypt`.
 *   - Every read MUST go through `SecretReader.read` so a
 *     `secret.accessed` event hits the audit chain — this is what
 *     compliance dashboards consume to answer "who pulled the GitHub
 *     token for tenant X this week".
 *   - Account creation and deletion emit `connectedaccount.linked` /
 *     `connectedaccount.unlinked` so the audit chain has a complete
 *     story: "linked at T0 by user A → token accessed at T1 by run R
 *     → unlinked at T2 by user A".
 *
 * Tenant safety: every method takes `tenantId` and refuses to operate
 * across tenants. Cross-tenant access throws CROSS_TENANT — never silent.
 *
 * Listing endpoints (`list`, `getMetadata`) NEVER return token material.
 * Only `getAccessToken` / `getRefreshToken` return plaintext, and both
 * fire audit events.
 */

export type ConnectedAccountSummary = Omit<ConnectedAccount, 'accessToken' | 'refreshToken'>;

export interface LinkAccountInput {
  tenantId: string;
  userId: string;
  provider: string;
  displayName?: string;
  /** Plaintext access token — encrypted before persistence */
  accessToken: string;
  /** Plaintext refresh token — encrypted before persistence */
  refreshToken?: string;
  tokenExpiry?: Date;
  scopes: string[];
  metadata?: Record<string, unknown>;
  /** Who is performing the link — recorded in the audit chain */
  actorId: string;
  actorType?: ActorType;
}

export interface UnlinkAccountInput {
  accountId: string;
  tenantId: string;
  actorId: string;
  actorType?: ActorType;
  /** Free-form reason recorded in the audit payload */
  reason?: string;
}

export interface ReadTokenInput {
  accountId: string;
  tenantId: string;
  /** Who/what is reading the token (user id, run id, system id) */
  actorId: string;
  actorType?: ActorType;
  /**
   * Why the token is being read. Surfaces in the secret.accessed
   * payload so dashboards can group by purpose: "oauth-refresh",
   * "runbook-step", "connection-test".
   */
  reason: string;
}

export class ConnectedAccountError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'CROSS_TENANT' | 'NO_REFRESH_TOKEN'
  ) {
    super(message);
    this.name = 'ConnectedAccountError';
  }
}

export class ConnectedAccountService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: SecretCipher,
    private readonly reader: SecretReader,
    private readonly audit: AuditService
  ) {}

  /**
   * Encrypt the supplied tokens and persist a new account row. Emits
   * `connectedaccount.linked` to the audit chain. The plaintext tokens
   * leave this method's scope as soon as encryption returns; they are
   * NEVER logged.
   */
  async link(input: LinkAccountInput): Promise<ConnectedAccountSummary> {
    // Per-tenant key derivation (v2). A leaked accessToken ciphertext
    // from tenant A cannot be decrypted under tenant B's derived key,
    // even if both share the same master OPERARI_SECRET_KEY.
    const accessTokenCipher = this.cipher.encryptForTenant(input.accessToken, input.tenantId);
    const refreshTokenCipher = input.refreshToken
      ? this.cipher.encryptForTenant(input.refreshToken, input.tenantId)
      : null;

    const account = await this.prisma.connectedAccount.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        provider: input.provider,
        displayName: input.displayName ?? null,
        accessToken: accessTokenCipher,
        refreshToken: refreshTokenCipher,
        tokenExpiry: input.tokenExpiry ?? null,
        scopes: input.scopes,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.recordSafe('connectedaccount.linked', {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'user',
      resource: `connected-account:${account.id}`,
      payload: {
        accountId: account.id,
        provider: account.provider,
        displayName: account.displayName,
        userId: account.userId,
        scopes: account.scopes,
        hasRefreshToken: refreshTokenCipher !== null,
        keyFingerprint: this.cipher.keyFingerprint(),
      },
    });

    return ConnectedAccountService.toSummary(account);
  }

  /**
   * Delete the account and emit `connectedaccount.unlinked`. Throws
   * NOT_FOUND or CROSS_TENANT before touching the row.
   */
  async unlink(input: UnlinkAccountInput): Promise<void> {
    const existing = await this.loadAndVerify(input.accountId, input.tenantId);

    await this.prisma.connectedAccount.delete({
      where: { id: existing.id },
    });

    await this.recordSafe('connectedaccount.unlinked', {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'user',
      resource: `connected-account:${existing.id}`,
      payload: {
        accountId: existing.id,
        provider: existing.provider,
        displayName: existing.displayName,
        userId: existing.userId,
        reason: input.reason ?? null,
      },
    });
  }

  /**
   * Decrypt and return the access token. Goes through {@link SecretReader}
   * which emits `secret.accessed` per call (success or failure).
   */
  async getAccessToken(input: ReadTokenInput): Promise<string> {
    const account = await this.loadAndVerify(input.accountId, input.tenantId);
    return this.reader.read({
      ciphertext: account.accessToken,
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'system',
      resource: `connected-account:${account.id}`,
      reason: input.reason,
    });
  }

  /**
   * Decrypt and return the refresh token. Throws NO_REFRESH_TOKEN if
   * the account does not have one (e.g. provider does not issue them
   * or the user authorized via a flow that did not request offline
   * access).
   */
  async getRefreshToken(input: ReadTokenInput): Promise<string> {
    const account = await this.loadAndVerify(input.accountId, input.tenantId);
    if (!account.refreshToken) {
      throw new ConnectedAccountError(
        `Account ${account.id} has no refresh token`,
        'NO_REFRESH_TOKEN'
      );
    }
    return this.reader.read({
      ciphertext: account.refreshToken,
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'system',
      resource: `connected-account:${account.id}`,
      reason: input.reason,
    });
  }

  /**
   * Token-free metadata view of every account a user has linked.
   * Safe to expose over an HTTP API; tokens are stripped at the
   * service boundary, not in the route.
   */
  async list(tenantId: string, userId: string): Promise<ConnectedAccountSummary[]> {
    const rows = await this.prisma.connectedAccount.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(ConnectedAccountService.toSummary);
  }

  /**
   * Token-free single account by id (tenant-scoped). Returns null if
   * the account does not exist OR belongs to another tenant — callers
   * should not be able to distinguish those cases.
   */
  async getMetadata(accountId: string, tenantId: string): Promise<ConnectedAccountSummary | null> {
    const row = await this.prisma.connectedAccount.findUnique({
      where: { id: accountId },
    });
    if (!row || row.tenantId !== tenantId) return null;
    return ConnectedAccountService.toSummary(row);
  }

  /**
   * Load the row and verify it belongs to the calling tenant. Used by
   * every mutating method so cross-tenant access is impossible.
   */
  private async loadAndVerify(accountId: string, tenantId: string): Promise<ConnectedAccount> {
    const row = await this.prisma.connectedAccount.findUnique({
      where: { id: accountId },
    });
    if (!row) {
      throw new ConnectedAccountError(`ConnectedAccount ${accountId} not found`, 'NOT_FOUND');
    }
    if (row.tenantId !== tenantId) {
      throw new ConnectedAccountError(
        `Cross-tenant access refused for ConnectedAccount ${accountId}`,
        'CROSS_TENANT'
      );
    }
    return row;
  }

  /**
   * Strip the encrypted token columns from a row before returning it
   * to a caller. Centralized so a future column rename or schema
   * change has one place to update.
   */
  static toSummary(account: ConnectedAccount): ConnectedAccountSummary {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accessToken, refreshToken, ...summary } = account;
    return summary;
  }

  /**
   * Best-effort audit write — same pattern as RoleAssignmentService
   * and SecretReader. The mutation has already happened; losing the
   * audit row is a verifier-detectable gap, not a reason to undo a
   * successful operation.
   */
  private async recordSafe(
    type: 'connectedaccount.linked' | 'connectedaccount.unlinked',
    params: {
      tenantId: string;
      actorId: string;
      actorType: ActorType;
      resource: string;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId: params.tenantId,
        type,
        actorId: params.actorId,
        actorType: params.actorType,
        resource: params.resource,
        payload: params.payload,
      });
    } catch {
      // intentional
    }
  }
}
