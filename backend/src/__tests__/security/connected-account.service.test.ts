import type { ConnectedAccount, PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

import type { AuditService } from '../../audit/audit.service';
import {
  ConnectedAccountError,
  ConnectedAccountService,
} from '../../security/connected-account.service';
import { SecretCipher } from '../../security/secret-cipher';
import { SecretReader } from '../../security/secret-reader';

const HEX_KEY = randomBytes(32).toString('hex');
const TENANT = 'tenant-1';
const USER = 'user-1';

function buildPrisma(seed: ConnectedAccount[] = []) {
  const rows: ConnectedAccount[] = [...seed];
  let nextId = rows.length + 1;

  const prisma = {
    connectedAccount: {
      create: jest.fn(
        async (args: { data: Omit<ConnectedAccount, 'id' | 'createdAt' | 'updatedAt'> }) => {
          const created: ConnectedAccount = {
            id: `acc-${nextId++}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...args.data,
          } as ConnectedAccount;
          rows.push(created);
          return created;
        }
      ),
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return rows.find(r => r.id === args.where.id) ?? null;
      }),
      findMany: jest.fn(async (args: { where: { tenantId: string; userId: string } }) => {
        return rows.filter(
          r => r.tenantId === args.where.tenantId && r.userId === args.where.userId
        );
      }),
      delete: jest.fn(async (args: { where: { id: string } }) => {
        const idx = rows.findIndex(r => r.id === args.where.id);
        if (idx === -1) throw new Error('not found');
        const [removed] = rows.splice(idx, 1);
        return removed;
      }),
    },
  } as unknown as PrismaClient;

  return { prisma, rows };
}

function buildAudit(): jest.Mocked<Pick<AuditService, 'record'>> {
  return {
    record: jest.fn().mockResolvedValue({ id: 'a', hash: 'h', seq: 1n }),
  };
}

function buildService(seed?: ConnectedAccount[]) {
  const { prisma, rows } = buildPrisma(seed);
  const audit = buildAudit();
  const cipher = new SecretCipher(HEX_KEY);
  const reader = new SecretReader(cipher, audit as unknown as AuditService);
  const service = new ConnectedAccountService(
    prisma,
    cipher,
    reader,
    audit as unknown as AuditService
  );
  return { service, prisma, rows, audit, cipher };
}

describe('ConnectedAccountService', () => {
  describe('link', () => {
    it('encrypts the access token and refresh token before persistence', async () => {
      const { service, rows, cipher } = buildService();

      await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        displayName: 'octocat',
        accessToken: 'ghp_supersecret',
        refreshToken: 'ghr_refreshme',
        scopes: ['repo', 'user:email'],
        actorId: USER,
      });

      expect(rows).toHaveLength(1);
      // Stored value must be ciphertext, not the plaintext
      expect(rows[0].accessToken).not.toBe('ghp_supersecret');
      expect(SecretCipher.isCiphertext(rows[0].accessToken)).toBe(true);
      expect(rows[0].refreshToken).not.toBe('ghr_refreshme');
      expect(SecretCipher.isCiphertext(rows[0].refreshToken!)).toBe(true);
      // Round-trip works with the per-tenant derived key (v2).
      expect(cipher.decryptForTenant(rows[0].accessToken, TENANT)).toBe('ghp_supersecret');
      expect(cipher.decryptForTenant(rows[0].refreshToken!, TENANT)).toBe('ghr_refreshme');
      expect(SecretCipher.versionOf(rows[0].accessToken)).toBe('v2');
    });

    it('emits connectedaccount.linked with the right metadata', async () => {
      const { service, audit } = buildService();

      await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'slack',
        displayName: 'workspace-acme',
        accessToken: 'xoxb-token',
        scopes: ['chat:write'],
        actorId: USER,
        actorType: 'user',
      });

      expect(audit.record).toHaveBeenCalledTimes(1);
      const call = audit.record.mock.calls[0][0];
      expect(call.type).toBe('connectedaccount.linked');
      expect(call.tenantId).toBe(TENANT);
      expect(call.actorId).toBe(USER);
      expect(call.resource).toMatch(/^connected-account:acc-/);
      const payload = call.payload as Record<string, unknown>;
      expect(payload.provider).toBe('slack');
      expect(payload.displayName).toBe('workspace-acme');
      expect(payload.scopes).toEqual(['chat:write']);
      expect(payload.hasRefreshToken).toBe(false);
      expect(typeof payload.keyFingerprint).toBe('string');
    });

    it('strips token columns from the returned summary', async () => {
      const { service } = buildService();
      const summary = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp_x',
        scopes: [],
        actorId: USER,
      });
      expect((summary as Record<string, unknown>).accessToken).toBeUndefined();
      expect((summary as Record<string, unknown>).refreshToken).toBeUndefined();
      expect(summary.provider).toBe('github');
    });
  });

  describe('getAccessToken', () => {
    it('reads the encrypted token through SecretReader and emits secret.accessed', async () => {
      const { service, audit } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp_secret',
        scopes: [],
        actorId: USER,
      });
      audit.record.mockClear();

      const plaintext = await service.getAccessToken({
        accountId: linked.id,
        tenantId: TENANT,
        actorId: 'run-42',
        actorType: 'system',
        reason: 'runbook-step',
      });

      expect(plaintext).toBe('ghp_secret');
      expect(audit.record).toHaveBeenCalledTimes(1);
      const call = audit.record.mock.calls[0][0];
      expect(call.type).toBe('secret.accessed');
      expect(call.actorId).toBe('run-42');
      const payload = call.payload as Record<string, unknown>;
      expect(payload.success).toBe(true);
      expect(payload.reason).toBe('runbook-step');
    });

    it('throws NOT_FOUND for missing accounts', async () => {
      const { service } = buildService();
      await expect(
        service.getAccessToken({
          accountId: 'ghost',
          tenantId: TENANT,
          actorId: USER,
          reason: 'test',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws CROSS_TENANT when the caller tenant does not own the account', async () => {
      const { service } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp',
        scopes: [],
        actorId: USER,
      });

      await expect(
        service.getAccessToken({
          accountId: linked.id,
          tenantId: 'other-tenant',
          actorId: 'attacker',
          reason: 'test',
        })
      ).rejects.toMatchObject({ code: 'CROSS_TENANT' });
    });
  });

  describe('getRefreshToken', () => {
    it('throws NO_REFRESH_TOKEN when the account never had one', async () => {
      const { service } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp',
        scopes: [],
        actorId: USER,
      });
      await expect(
        service.getRefreshToken({
          accountId: linked.id,
          tenantId: TENANT,
          actorId: USER,
          reason: 'test',
        })
      ).rejects.toMatchObject({ code: 'NO_REFRESH_TOKEN' });
    });

    it('returns the decrypted refresh token when present', async () => {
      const { service } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp',
        refreshToken: 'ghr',
        scopes: [],
        actorId: USER,
      });

      const refresh = await service.getRefreshToken({
        accountId: linked.id,
        tenantId: TENANT,
        actorId: 'cron',
        reason: 'oauth-refresh',
      });
      expect(refresh).toBe('ghr');
    });
  });

  describe('unlink', () => {
    it('deletes the row and emits connectedaccount.unlinked', async () => {
      const { service, rows, audit } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'slack',
        accessToken: 'xoxb',
        scopes: [],
        actorId: USER,
      });
      audit.record.mockClear();

      await service.unlink({
        accountId: linked.id,
        tenantId: TENANT,
        actorId: USER,
        reason: 'user-request',
      });

      expect(rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledTimes(1);
      const call = audit.record.mock.calls[0][0];
      expect(call.type).toBe('connectedaccount.unlinked');
      expect((call.payload as Record<string, unknown>).reason).toBe('user-request');
    });

    it('throws CROSS_TENANT before deleting the row', async () => {
      const { service, rows } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'slack',
        accessToken: 'xoxb',
        scopes: [],
        actorId: USER,
      });

      await expect(
        service.unlink({
          accountId: linked.id,
          tenantId: 'other-tenant',
          actorId: 'attacker',
        })
      ).rejects.toBeInstanceOf(ConnectedAccountError);
      // Row is still there
      expect(rows).toHaveLength(1);
    });
  });

  describe('list / getMetadata', () => {
    it('list returns summaries without token columns', async () => {
      const { service } = buildService();
      await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp',
        scopes: [],
        actorId: USER,
      });
      await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'slack',
        accessToken: 'xoxb',
        scopes: [],
        actorId: USER,
      });

      const list = await service.list(TENANT, USER);
      expect(list).toHaveLength(2);
      for (const item of list) {
        expect((item as Record<string, unknown>).accessToken).toBeUndefined();
        expect((item as Record<string, unknown>).refreshToken).toBeUndefined();
      }
    });

    it('getMetadata returns null for cross-tenant lookups (no oracle)', async () => {
      const { service } = buildService();
      const linked = await service.link({
        tenantId: TENANT,
        userId: USER,
        provider: 'github',
        accessToken: 'ghp',
        scopes: [],
        actorId: USER,
      });

      const otherTenantView = await service.getMetadata(linked.id, 'other-tenant');
      expect(otherTenantView).toBeNull();

      const ownTenantView = await service.getMetadata(linked.id, TENANT);
      expect(ownTenantView).not.toBeNull();
      expect((ownTenantView as Record<string, unknown>).accessToken).toBeUndefined();
    });
  });

  it('a successful read failure does not let an audit write failure leak plaintext', async () => {
    // Audit write fails on EVERY call. The link must still succeed, the
    // read must still return the plaintext, and no exception bubbles up
    // from the audit chain — the verifier is the backstop, not the
    // request path.
    const { prisma, rows } = buildPrisma();
    const audit = {
      record: jest.fn().mockRejectedValue(new Error('postgres down')),
    } as unknown as AuditService;
    const cipher = new SecretCipher(HEX_KEY);
    const reader = new SecretReader(cipher, audit);
    const service = new ConnectedAccountService(prisma, cipher, reader, audit);

    const linked = await service.link({
      tenantId: TENANT,
      userId: USER,
      provider: 'github',
      accessToken: 'ghp_secret',
      scopes: [],
      actorId: USER,
    });
    expect(rows).toHaveLength(1);

    const plaintext = await service.getAccessToken({
      accountId: linked.id,
      tenantId: TENANT,
      actorId: USER,
      reason: 'test',
    });
    expect(plaintext).toBe('ghp_secret');
  });
});
