import type { PrismaClient } from '@prisma/client';

import { WaitpointError, WaitpointService } from '../../../runbook/services/waitpoint.service';

interface WaitpointRow {
  id: string;
  tenantId: string;
  executionId: string | null;
  status: 'PENDING' | 'COMPLETED' | 'TIMED_OUT' | 'CANCELLED';
  expiresAt: Date | null;
  tags: string[];
  completedValue: unknown;
  completedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const buildPrisma = (rows: WaitpointRow[] = []) => {
  const prisma = {
    waitpoint: {
      create: jest.fn(async (args: { data: Partial<WaitpointRow> }) => {
        const row: WaitpointRow = {
          id: args.data.id!,
          tenantId: args.data.tenantId!,
          executionId: args.data.executionId ?? null,
          status: 'PENDING',
          expiresAt: args.data.expiresAt ?? null,
          tags: args.data.tags ?? [],
          completedValue: null,
          completedBy: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return rows.find(r => r.id === args.where.id) ?? null;
      }),
      update: jest.fn(async (args: { where: { id: string }; data: Partial<WaitpointRow> }) => {
        const row = rows.find(r => r.id === args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      updateMany: jest.fn(
        async (args: {
          where: { status: string; expiresAt?: { lt: Date } };
          data: Partial<WaitpointRow>;
        }) => {
          let count = 0;
          for (const row of rows) {
            if (row.status !== args.where.status) continue;
            if (
              args.where.expiresAt?.lt &&
              (!row.expiresAt || row.expiresAt >= args.where.expiresAt.lt)
            ) {
              continue;
            }
            Object.assign(row, args.data);
            count++;
          }
          return { count };
        }
      ),
      findMany: jest.fn(
        async (args: {
          where: { tenantId: string; status?: string };
          take?: number;
          orderBy?: unknown;
        }) => {
          return rows
            .filter(r => r.tenantId === args.where.tenantId)
            .filter(r => !args.where.status || r.status === args.where.status)
            .slice(0, args.take ?? 50);
        }
      ),
    },
  } as unknown as PrismaClient;
  return { prisma, rows };
};

describe('WaitpointService', () => {
  describe('create', () => {
    it('mints an id with the wpt_ prefix and 32 hex chars', async () => {
      const { prisma, rows } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const row = await svc.create({ tenantId: 't1' });
      expect(row.id).toMatch(/^wpt_[0-9a-f]{32}$/);
      expect(rows).toHaveLength(1);
    });

    it('persists timeoutMs as expiresAt in the future', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const before = Date.now();
      const row = await svc.create({ tenantId: 't1', timeoutMs: 60_000 });
      expect(row.expiresAt).not.toBeNull();
      expect(row.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 60_000 - 5);
    });

    it('leaves expiresAt null when no timeout is supplied', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const row = await svc.create({ tenantId: 't1' });
      expect(row.expiresAt).toBeNull();
    });
  });

  describe('retrieve', () => {
    it('returns the row when tenant matches', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      const fetched = await svc.retrieve(created.id, 't1');
      expect(fetched.id).toBe(created.id);
    });

    it('throws NOT_FOUND for unknown id', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      await expect(svc.retrieve('wpt_missing', 't1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws CROSS_TENANT when accessed from a different tenant', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      await expect(svc.retrieve(created.id, 't2')).rejects.toBeInstanceOf(WaitpointError);
      await expect(svc.retrieve(created.id, 't2')).rejects.toMatchObject({
        code: 'CROSS_TENANT',
      });
    });
  });

  describe('complete', () => {
    it('marks the token COMPLETED and stores the value + completedBy', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      const updated = await svc.complete(created.id, {
        tenantId: 't1',
        value: { ok: true, score: 42 },
        completedBy: 'slack-callback',
      });
      expect(updated.status).toBe('COMPLETED');
      expect(updated.completedValue).toEqual({ ok: true, score: 42 });
      expect(updated.completedBy).toBe('slack-callback');
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('refuses to complete a token twice', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      await svc.complete(created.id, { tenantId: 't1', value: 1 });
      await expect(svc.complete(created.id, { tenantId: 't1', value: 2 })).rejects.toMatchObject({
        code: 'ALREADY_COMPLETED',
      });
    });

    it('refuses cross-tenant completion', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      await expect(
        svc.complete(created.id, { tenantId: 't2', value: 'nope' })
      ).rejects.toMatchObject({ code: 'CROSS_TENANT' });
    });
  });

  describe('cancel', () => {
    it('moves PENDING to CANCELLED', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      const cancelled = await svc.cancel(created.id, 't1');
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('is a no-op on already-terminal tokens', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const created = await svc.create({ tenantId: 't1' });
      await svc.complete(created.id, { tenantId: 't1', value: 'x' });
      const result = await svc.cancel(created.id, 't1');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('expireOverdue', () => {
    it('flips PENDING tokens whose expiresAt is in the past to TIMED_OUT', async () => {
      const { prisma, rows } = buildPrisma();
      const svc = new WaitpointService(prisma);
      // Past-due token
      await svc.create({ tenantId: 't1', timeoutMs: 1 });
      // Long-lived token
      await svc.create({ tenantId: 't1', timeoutMs: 60_000 });
      // Sleep just past the short timeout.
      await new Promise(r => setTimeout(r, 10));

      const count = await svc.expireOverdue();
      expect(count).toBe(1);
      expect(rows[0].status).toBe('TIMED_OUT');
      expect(rows[1].status).toBe('PENDING');
    });

    it('ignores tokens with no expiresAt', async () => {
      const { prisma, rows } = buildPrisma();
      const svc = new WaitpointService(prisma);
      await svc.create({ tenantId: 't1' });
      const count = await svc.expireOverdue();
      expect(count).toBe(0);
      expect(rows[0].status).toBe('PENDING');
    });
  });

  describe('list', () => {
    it('returns only this tenant rows', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      await svc.create({ tenantId: 't1' });
      await svc.create({ tenantId: 't2' });
      const list = await svc.list('t1');
      expect(list).toHaveLength(1);
      expect(list[0].tenantId).toBe('t1');
    });

    it('filters by status when supplied', async () => {
      const { prisma } = buildPrisma();
      const svc = new WaitpointService(prisma);
      const a = await svc.create({ tenantId: 't1' });
      await svc.create({ tenantId: 't1' });
      await svc.complete(a.id, { tenantId: 't1', value: 'x' });
      const list = await svc.list('t1', { status: 'COMPLETED' });
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(a.id);
    });
  });
});
