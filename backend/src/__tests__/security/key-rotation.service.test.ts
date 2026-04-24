import type { ConnectedAccount, KeyRotationJob, PrismaClient, User } from '@prisma/client';
import { randomBytes } from 'crypto';

import type { AuditService } from '../../audit/audit.service';
import { KeyRotationError, KeyRotationService } from '../../security/key-rotation.service';
import { SecretCipher } from '../../security/secret-cipher';

const PRIMARY = randomBytes(32).toString('hex');
const LEGACY = randomBytes(32).toString('hex');

type AccountSeed = Pick<ConnectedAccount, 'id' | 'tenantId' | 'accessToken' | 'refreshToken'>;
type UserSeed = Pick<User, 'id' | 'tenantId' | 'mfaSecretCiphered'>;

/**
 * Minimal in-memory Prisma stub: only the tables + columns the
 * rotation service touches. Accepts `findFirst`/`findUnique`/`findMany`/
 * `create`/`update` with the shape the service actually uses.
 */
function buildPrisma(
  opts: {
    jobs?: KeyRotationJob[];
    accounts?: AccountSeed[];
    users?: UserSeed[];
  } = {}
) {
  const jobs: KeyRotationJob[] = [...(opts.jobs ?? [])];
  const accounts: AccountSeed[] = [...(opts.accounts ?? [])];
  const users: UserSeed[] = [...(opts.users ?? [])];
  let nextJobSeq = jobs.length + 1;

  const prisma = {
    keyRotationJob: {
      findFirst: jest.fn(async (args?: { where?: { status?: { in?: string[] } } }) => {
        const statuses = args?.where?.status?.in;
        const candidates = statuses ? jobs.filter(j => statuses.includes(j.status)) : [...jobs];
        candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return candidates[0] ?? null;
      }),
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return jobs.find(j => j.id === args.where.id) ?? null;
      }),
      create: jest.fn(async (args: { data: Partial<KeyRotationJob> }) => {
        const now = new Date();
        const job: KeyRotationJob = {
          id: `job-${nextJobSeq++}`,
          deadline: args.data.deadline ?? now,
          status: args.data.status ?? 'PENDING',
          dryRun: args.data.dryRun ?? false,
          rowsTotal: null,
          rowsCompleted: 0,
          rowsFailed: 0,
          nextCursor: null,
          lastError: null,
          startedAt: null,
          completedAt: null,
          createdByUserId: args.data.createdByUserId ?? null,
          createdAt: now,
          updatedAt: now,
        } as KeyRotationJob;
        jobs.push(job);
        return job;
      }),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const job = jobs.find(j => j.id === args.where.id);
        if (!job) throw new Error(`job ${args.where.id} not found`);
        for (const [k, v] of Object.entries(args.data)) {
          const current = (job as unknown as Record<string, unknown>)[k];
          if (v && typeof v === 'object' && 'increment' in (v as Record<string, unknown>)) {
            const inc = (v as { increment: number }).increment;
            (job as unknown as Record<string, unknown>)[k] = ((current as number) ?? 0) + inc;
          } else {
            (job as unknown as Record<string, unknown>)[k] = v;
          }
        }
        job.updatedAt = new Date();
        return job;
      }),
    },
    connectedAccount: {
      findMany: jest.fn(
        async (args: {
          where?: { id?: { gt?: string } };
          orderBy?: { id: 'asc' };
          take?: number;
        }) => {
          const afterId = args.where?.id?.gt;
          let rows = [...accounts];
          rows.sort((a, b) => (a.id < b.id ? -1 : 1));
          if (afterId) rows = rows.filter(r => r.id > afterId);
          if (args.take) rows = rows.slice(0, args.take);
          return rows;
        }
      ),
      update: jest.fn(
        async (args: {
          where: { id: string };
          data: { accessToken: string; refreshToken: string | null };
        }) => {
          const row = accounts.find(a => a.id === args.where.id);
          if (!row) throw new Error('not found');
          row.accessToken = args.data.accessToken;
          row.refreshToken = args.data.refreshToken;
          return row;
        }
      ),
    },
    user: {
      findMany: jest.fn(
        async (args: {
          where?: {
            mfaSecretCiphered?: { not: null };
            id?: { gt?: string };
          };
          orderBy?: { id: 'asc' };
          take?: number;
        }) => {
          const afterId = args.where?.id?.gt;
          let rows = users.filter(u => u.mfaSecretCiphered !== null);
          rows.sort((a, b) => (a.id < b.id ? -1 : 1));
          if (afterId) rows = rows.filter(r => r.id > afterId);
          if (args.take) rows = rows.slice(0, args.take);
          return rows;
        }
      ),
      update: jest.fn(
        async (args: { where: { id: string }; data: { mfaSecretCiphered: string } }) => {
          const row = users.find(u => u.id === args.where.id);
          if (!row) throw new Error('not found');
          row.mfaSecretCiphered = args.data.mfaSecretCiphered;
          return row;
        }
      ),
    },
  } as unknown as PrismaClient;

  return { prisma, jobs, accounts, users };
}

function buildAudit(): jest.Mocked<Pick<AuditService, 'record'>> {
  return {
    record: jest.fn().mockResolvedValue({ id: 'a', hash: 'h', seq: 1n }),
  };
}

describe('KeyRotationService.startRotation', () => {
  it('creates a PENDING job when no active job exists', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    const deadline = new Date(Date.now() + 86_400_000);
    const job = await svc.startRotation({ deadline, actorId: 'user-1' });

    expect(job.status).toBe('PENDING');
    expect(job.dryRun).toBe(false);
    expect(job.createdByUserId).toBe('user-1');
    expect(job.deadline).toEqual(deadline);
  });

  it('rejects when another active job exists', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    await svc.startRotation({ deadline: new Date(), actorId: null });
    await expect(svc.startRotation({ deadline: new Date(), actorId: null })).rejects.toMatchObject({
      code: 'ACTIVE_JOB_EXISTS',
    });
  });

  it('rejects real rotation when cipher has no legacy keys', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY); // no legacy
    const svc = new KeyRotationService({ prisma, cipher });

    await expect(svc.startRotation({ deadline: new Date(), actorId: null })).rejects.toMatchObject({
      code: 'NO_LEGACY_KEYS',
    });
  });

  it('allows dry-run even without legacy keys', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY); // no legacy
    const svc = new KeyRotationService({ prisma, cipher });

    const job = await svc.startRotation({
      deadline: new Date(),
      actorId: null,
      dryRun: true,
    });
    expect(job.status).toBe('PENDING');
    expect(job.dryRun).toBe(true);
  });
});

describe('KeyRotationService.rotateNextBatch', () => {
  it('flips PENDING → RUNNING on first batch and stamps startedAt', async () => {
    // Seed one legacy-encrypted account so there's work to do.
    const legacyCipher = new SecretCipher(LEGACY);
    const account: AccountSeed = {
      id: 'acc-1',
      tenantId: 'tenant-a',
      accessToken: legacyCipher.encryptForTenant('token-1', 'tenant-a'),
      refreshToken: null,
    };
    const { prisma } = buildPrisma({ accounts: [account] });
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher, batchSize: 10 });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    expect(job.status).toBe('PENDING');
    const after = await svc.rotateNextBatch(job.id);

    expect(after.status).toBe('RUNNING');
    expect(after.startedAt).toBeInstanceOf(Date);
    expect(after.rowsCompleted).toBe(1);
  });

  it('re-encrypts rows under primary and advances cursor through all tables to COMPLETED', async () => {
    const legacyCipher = new SecretCipher(LEGACY);
    const accounts: AccountSeed[] = [
      {
        id: 'acc-1',
        tenantId: 'tenant-a',
        accessToken: legacyCipher.encryptForTenant('t1', 'tenant-a'),
        refreshToken: legacyCipher.encryptForTenant('r1', 'tenant-a'),
      },
      {
        id: 'acc-2',
        tenantId: 'tenant-b',
        accessToken: legacyCipher.encryptForTenant('t2', 'tenant-b'),
        refreshToken: null,
      },
    ];
    const users: UserSeed[] = [
      {
        id: 'user-1',
        tenantId: 'tenant-a',
        mfaSecretCiphered: legacyCipher.encryptForTenant('mfa1', 'tenant-a', 'mfa:user-1'),
      },
    ];
    const { prisma } = buildPrisma({ accounts, users });
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher, batchSize: 100 });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });

    // Tick 1: ConnectedAccount batch (processes both, exhausts table,
    //         advances cursor to User for next tick).
    let current = await svc.rotateNextBatch(job.id);
    expect(current.status).toBe('RUNNING');
    expect(current.rowsCompleted).toBe(2);
    // Tick 2: User batch — processes the one row, exhausts, completes.
    current = await svc.rotateNextBatch(job.id);
    expect(current.status).toBe('COMPLETED');
    expect(current.rowsCompleted).toBe(3);
    expect(current.completedAt).toBeInstanceOf(Date);

    // All rows now readable under primary without legacy fallback.
    const primaryOnly = new SecretCipher(PRIMARY);
    expect(primaryOnly.decryptForTenant(accounts[0].accessToken, 'tenant-a')).toBe('t1');
    expect(primaryOnly.decryptForTenant(accounts[0].refreshToken!, 'tenant-a')).toBe('r1');
    expect(primaryOnly.decryptForTenant(accounts[1].accessToken, 'tenant-b')).toBe('t2');
    expect(
      primaryOnly.decryptForTenant(users[0].mfaSecretCiphered!, 'tenant-a', 'mfa:user-1')
    ).toBe('mfa1');
  });

  it('resumes from the persisted cursor across ticks', async () => {
    const legacyCipher = new SecretCipher(LEGACY);
    const accounts: AccountSeed[] = Array.from({ length: 5 }, (_, i) => ({
      id: `acc-${i + 1}`,
      tenantId: 'tenant-a',
      accessToken: legacyCipher.encryptForTenant(`t${i + 1}`, 'tenant-a'),
      refreshToken: null,
    }));
    const { prisma } = buildPrisma({ accounts });
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher, batchSize: 2 });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    // Tick 1: processes acc-1, acc-2
    let current = await svc.rotateNextBatch(job.id);
    expect(current.rowsCompleted).toBe(2);
    expect((current.nextCursor as { table: string; lastId: string }).lastId).toBe('acc-2');
    // Tick 2: processes acc-3, acc-4
    current = await svc.rotateNextBatch(job.id);
    expect(current.rowsCompleted).toBe(4);
    expect((current.nextCursor as { table: string; lastId: string }).lastId).toBe('acc-4');
    // Tick 3: processes acc-5 (partial batch → exhausts → advance to User)
    current = await svc.rotateNextBatch(job.id);
    expect(current.rowsCompleted).toBe(5);
    expect((current.nextCursor as { table: string }).table).toBe('User');
    // Tick 4: User table empty → COMPLETED
    current = await svc.rotateNextBatch(job.id);
    expect(current.status).toBe('COMPLETED');
  });

  it('dryRun does not write back (rows remain under legacy key)', async () => {
    const legacyCipher = new SecretCipher(LEGACY);
    const accounts: AccountSeed[] = [
      {
        id: 'acc-1',
        tenantId: 'tenant-a',
        accessToken: legacyCipher.encryptForTenant('t1', 'tenant-a'),
        refreshToken: null,
      },
    ];
    const originalCipher = accounts[0].accessToken;
    const { prisma } = buildPrisma({ accounts });
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher, batchSize: 10 });

    const job = await svc.startRotation({
      deadline: new Date(),
      actorId: null,
      dryRun: true,
    });
    await svc.rotateNextBatch(job.id);
    await svc.rotateNextBatch(job.id); // completes

    // Row unchanged in dry-run.
    expect(accounts[0].accessToken).toBe(originalCipher);
    expect(prisma.connectedAccount.update).not.toHaveBeenCalled();
  });

  it('skips write for rows already ciphered under the primary (idempotent resume)', async () => {
    // Simulate a resumed rotation: row is already under primary.
    const primaryCipher = new SecretCipher(PRIMARY);
    const accounts: AccountSeed[] = [
      {
        id: 'acc-1',
        tenantId: 'tenant-a',
        accessToken: primaryCipher.encryptForTenant('already-rotated', 'tenant-a'),
        refreshToken: null,
      },
    ];
    const { prisma } = buildPrisma({ accounts });
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher, batchSize: 10 });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    await svc.rotateNextBatch(job.id);

    // No write should have happened — rewrap short-circuited.
    expect(prisma.connectedAccount.update).not.toHaveBeenCalled();
  });

  it('emits an audit event per non-empty batch', async () => {
    const legacyCipher = new SecretCipher(LEGACY);
    const accounts: AccountSeed[] = [
      {
        id: 'acc-1',
        tenantId: 'tenant-a',
        accessToken: legacyCipher.encryptForTenant('t1', 'tenant-a'),
        refreshToken: null,
      },
    ];
    const { prisma } = buildPrisma({ accounts });
    const audit = buildAudit();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({
      prisma,
      cipher,
      audit: audit as unknown as AuditService,
      batchSize: 10,
    });

    const job = await svc.startRotation({ deadline: new Date(), actorId: 'admin-1' });
    await svc.rotateNextBatch(job.id);

    expect(audit.record).toHaveBeenCalled();
    const call = audit.record.mock.calls[0][0];
    expect(call.type).toBe('key.rotated');
    expect(call.actorId).toBe('admin-1');
    expect((call.payload as Record<string, unknown>).batchProcessed).toBe(1);
  });

  it('throws JOB_NOT_FOUND for unknown job', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    await expect(svc.rotateNextBatch('no-such-job')).rejects.toMatchObject({
      code: 'JOB_NOT_FOUND',
    });
  });

  it('throws JOB_TERMINAL for a completed job', async () => {
    const { prisma, jobs } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    const stored = jobs.find(j => j.id === job.id)!;
    stored.status = 'COMPLETED';

    await expect(svc.rotateNextBatch(job.id)).rejects.toMatchObject({
      code: 'JOB_TERMINAL',
    });
  });
});

describe('KeyRotationService.cancel', () => {
  it('flips an active job to CANCELLED', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    const cancelled = await svc.cancel(job.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.completedAt).toBeInstanceOf(Date);
  });

  it('refuses to cancel a terminal job', async () => {
    const { prisma, jobs } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    jobs.find(j => j.id === job.id)!.status = 'COMPLETED';

    await expect(svc.cancel(job.id)).rejects.toBeInstanceOf(KeyRotationError);
  });

  it('returns JOB_NOT_FOUND for unknown id', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });

    await expect(svc.cancel('no-such')).rejects.toMatchObject({ code: 'JOB_NOT_FOUND' });
  });
});

describe('KeyRotationService.getActiveJob', () => {
  it('returns null when no PENDING/RUNNING job exists', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });
    expect(await svc.getActiveJob()).toBeNull();
  });

  it('returns the PENDING job once created', async () => {
    const { prisma } = buildPrisma();
    const cipher = new SecretCipher(PRIMARY, [LEGACY]);
    const svc = new KeyRotationService({ prisma, cipher });
    const job = await svc.startRotation({ deadline: new Date(), actorId: null });
    const active = await svc.getActiveJob();
    expect(active?.id).toBe(job.id);
  });
});
