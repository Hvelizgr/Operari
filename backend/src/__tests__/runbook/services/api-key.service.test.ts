import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { ApiKeyService } from '../../../runbook/services/api-key.service';
import { AuditService } from '../../../audit/audit.service';

class FakeAudit {
  public events: Array<{ type: string; tenantId: string; payload: Record<string, unknown> }> = [];
  async record(input: { type: string; tenantId: string; payload: Record<string, unknown> }) {
    this.events.push(input);
    return { id: 'evt-1', hash: 'x'.repeat(64), seq: BigInt(this.events.length) };
  }
}

interface FakeApiKeyRow {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

const buildPrisma = () => {
  const store: FakeApiKeyRow[] = [];
  let nextId = 1;

  const prisma = {
    apiKey: {
      create: jest.fn(async (args: { data: Omit<FakeApiKeyRow, 'id' | 'lastUsedAt'> }) => {
        const row: FakeApiKeyRow = {
          id: `key-${nextId++}`,
          lastUsedAt: null,
          ...args.data,
        };
        store.push(row);
        return row;
      }),
      findMany: jest.fn(async (args: { where: { prefix: string } }) => {
        return store.filter(r => r.prefix === args.where.prefix);
      }),
      findFirst: jest.fn(async (args: { where: { id: string; tenantId: string } }) => {
        return (
          store.find(r => r.id === args.where.id && r.tenantId === args.where.tenantId) ?? null
        );
      }),
      update: jest.fn(async (args: { where: { id: string }; data: Partial<FakeApiKeyRow> }) => {
        const row = store.find(r => r.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return row;
      }),
      deleteMany: jest.fn(async (args: { where: { id: string; tenantId: string } }) => {
        const before = store.length;
        const idx = store.findIndex(
          r => r.id === args.where.id && r.tenantId === args.where.tenantId
        );
        if (idx >= 0) store.splice(idx, 1);
        return { count: before - store.length };
      }),
    },
  } as unknown as PrismaClient;

  return { prisma, store };
};

const buildService = () => {
  const { prisma, store } = buildPrisma();
  const audit = new FakeAudit();
  const service = new ApiKeyService(prisma, { audit: audit as unknown as AuditService });
  return { prisma, store, audit, service };
};

describe('ApiKeyService → AuditService wiring', () => {
  it('emits apikey.created on create() WITHOUT leaking the plain key', async () => {
    const { audit, service } = buildService();

    const created = await service.create('tenant-1', 'compliance-bot', ['audit:read'], 'user-9');

    expect(created.plainKey).toMatch(/^nr_(test|live)_/);
    expect(audit.events).toHaveLength(1);

    const event = audit.events[0];
    expect(event.type).toBe('apikey.created');
    expect(event.tenantId).toBe('tenant-1');
    expect(event.payload).toMatchObject({
      keyId: created.id,
      name: 'compliance-bot',
      prefix: created.prefix,
      scopes: ['audit:read'],
    });

    // Critical: the plain key and the bcrypt hash must NEVER be in audit
    const json = JSON.stringify(event.payload);
    expect(json).not.toContain(created.plainKey);
    expect(json).not.toContain(created.keyHash);
  });

  it('emits apikey.used only on the first successful validate', async () => {
    const { audit, service } = buildService();
    const created = await service.create('tenant-1', 'bot', ['*']);
    audit.events.length = 0; // ignore the create event

    // First validate: emits apikey.used
    const ctx1 = await service.validate(created.plainKey);
    // Allow the fire-and-forget update + audit to settle
    await new Promise(r => setImmediate(r));
    expect(ctx1).not.toBeNull();
    expect(audit.events.filter(e => e.type === 'apikey.used')).toHaveLength(1);
    expect(audit.events[0].payload.firstUse).toBe(true);

    // Second validate: NO new audit event
    const ctx2 = await service.validate(created.plainKey);
    await new Promise(r => setImmediate(r));
    expect(ctx2).not.toBeNull();
    expect(audit.events.filter(e => e.type === 'apikey.used')).toHaveLength(1);
  });

  it('does not emit apikey.used for an invalid key', async () => {
    const { audit, service } = buildService();
    await service.create('tenant-1', 'bot', ['*']);
    audit.events.length = 0;

    const result = await service.validate('nr_test_invalidnonsense12345');
    expect(result).toBeNull();
    expect(audit.events).toHaveLength(0);
  });

  it('emits apikey.revoked on revoke()', async () => {
    const { audit, service } = buildService();
    const created = await service.create('tenant-1', 'bot', ['runs:read']);
    audit.events.length = 0;

    const ok = await service.revoke('tenant-1', created.id);
    expect(ok).toBe(true);

    expect(audit.events).toHaveLength(1);
    expect(audit.events[0].type).toBe('apikey.revoked');
    expect(audit.events[0].payload).toMatchObject({
      keyId: created.id,
      name: 'bot',
      scopes: ['runs:read'],
    });
  });

  it('does not emit apikey.revoked when the key does not exist', async () => {
    const { audit, service } = buildService();
    await service.create('tenant-1', 'bot', ['*']);
    audit.events.length = 0;

    const ok = await service.revoke('tenant-1', 'nonexistent');
    expect(ok).toBe(false);
    expect(audit.events).toHaveLength(0);
  });

  it('does not emit apikey.revoked when the tenant does not match', async () => {
    const { audit, service } = buildService();
    const created = await service.create('tenant-1', 'bot', ['*']);
    audit.events.length = 0;

    const ok = await service.revoke('other-tenant', created.id);
    expect(ok).toBe(false);
    expect(audit.events).toHaveLength(0);
  });

  it('survives audit failures during create()', async () => {
    const { prisma } = buildPrisma();
    const brokenAudit = {
      record: jest.fn().mockRejectedValue(new Error('chain offline')),
    } as unknown as AuditService;
    const service = new ApiKeyService(prisma, { audit: brokenAudit });

    await expect(service.create('tenant-1', 'bot', ['*'])).resolves.toMatchObject({
      tenantId: 'tenant-1',
    });
  });

  it('does not call audit when audit is null', async () => {
    const { prisma } = buildPrisma();
    const service = new ApiKeyService(prisma, { audit: null });

    const created = await service.create('tenant-1', 'bot', ['*']);
    const ok = await service.revoke('tenant-1', created.id);
    expect(ok).toBe(true);
  });
});
