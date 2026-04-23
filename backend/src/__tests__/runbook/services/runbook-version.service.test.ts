// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. runbook-version.service has no env imports but
// the Prisma mock plumbing might; set compliant values up front.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import type { Runbook } from '@prisma/client';

import {
  applyRunbookVersionSnapshot,
  RunbookVersionError,
  RunbookVersionService,
} from '../../../runbook/services/runbook-version.service';

const runbookRow = (overrides: Partial<Runbook> = {}): Runbook =>
  ({
    id: 'rb-1',
    slug: null,
    name: 'Deploy',
    description: 'prod deploy',
    category: 'deploy',
    nodes: [{ id: 'n-1', type: 'Trigger' }] as unknown as Runbook['nodes'],
    connections: [] as unknown as Runbook['connections'],
    inputs: [{ key: 'env' }] as unknown as Runbook['inputs'],
    isActive: true,
    schedule: null,
    userId: 'user-1',
    tenantId: 'tenant-1',
    onErrorRunbookId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  }) as Runbook;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrismaStub(
  existingVersions: Array<{ runbookId: string; version: number }> = [],
  runbookExists = true
): { prisma: any; created: Array<Record<string, unknown>> } {
  const created: Array<Record<string, unknown>> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    runbook: {
      findUnique: jest.fn(async () => (runbookExists ? runbookRow() : null)),
    },
    runbookVersion: {
      findFirst: jest.fn(async (args: { where: { runbookId: string } }) => {
        const matches = existingVersions.filter(v => v.runbookId === args.where.runbookId);
        if (matches.length === 0) return null;
        matches.sort((a, b) => b.version - a.version);
        return { version: matches[0].version } as { version: number };
      }),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return {
          id: `rv-${created.length}`,
          version: args.data.version,
          ...args.data,
        };
      }),
      findUnique: jest.fn(),
    },
  };
  prisma.$transaction = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (tx: any) => Promise<unknown>,
    _opts?: unknown
  ): Promise<unknown> => fn(prisma);
  return { prisma, created };
}

describe('RunbookVersionService.createVersion', () => {
  it('inserts version 1 when no prior versions exist', async () => {
    const { prisma, created } = buildPrismaStub([]);
    const svc = new RunbookVersionService(prisma);
    const result = await svc.createVersion({ runbookId: 'rb-1', actorId: 'user-1' });

    expect(result.version).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      runbookId: 'rb-1',
      tenantId: 'tenant-1',
      version: 1,
      createdByUserId: 'user-1',
    });
  });

  it('bumps the version monotonically per runbook', async () => {
    const { prisma, created } = buildPrismaStub([
      { runbookId: 'rb-1', version: 1 },
      { runbookId: 'rb-1', version: 2 },
      { runbookId: 'rb-1', version: 3 },
    ]);
    const svc = new RunbookVersionService(prisma);
    const result = await svc.createVersion({ runbookId: 'rb-1', actorId: 'user-1' });
    expect(result.version).toBe(4);
    expect(created[0].version).toBe(4);
  });

  it('snapshots the current Runbook definition fields', async () => {
    const { prisma, created } = buildPrismaStub([]);
    const svc = new RunbookVersionService(prisma);
    await svc.createVersion({ runbookId: 'rb-1', actorId: 'user-1' });

    const snap = created[0].snapshot as Record<string, unknown>;
    expect(snap.name).toBe('Deploy');
    expect(snap.description).toBe('prod deploy');
    expect(snap.category).toBe('deploy');
    expect(Array.isArray(snap.nodes)).toBe(true);
    expect(snap.inputs).toEqual([{ key: 'env' }]);
    expect(snap.onErrorRunbookId).toBeNull();
  });

  it('accepts a null actorId for system-initiated versions', async () => {
    const { prisma, created } = buildPrismaStub([]);
    const svc = new RunbookVersionService(prisma);
    await svc.createVersion({ runbookId: 'rb-1', actorId: null });
    expect(created[0].createdByUserId).toBeNull();
  });

  it('throws RUNBOOK_NOT_FOUND when the parent row is missing', async () => {
    const { prisma } = buildPrismaStub([], false);
    const svc = new RunbookVersionService(prisma);
    await expect(
      svc.createVersion({ runbookId: 'ghost', actorId: 'user-1' })
    ).rejects.toBeInstanceOf(RunbookVersionError);
  });
});

describe('RunbookVersionService.buildSnapshot', () => {
  it('freezes nodes/connections/inputs and identity-free metadata', () => {
    const snap = RunbookVersionService.buildSnapshot(runbookRow());
    expect(snap).toEqual({
      name: 'Deploy',
      description: 'prod deploy',
      category: 'deploy',
      nodes: [{ id: 'n-1', type: 'Trigger' }],
      connections: [],
      inputs: [{ key: 'env' }],
      onErrorRunbookId: null,
    });
  });

  it('defaults nullable JSON columns to empty arrays so consumers do not explode', () => {
    const snap = RunbookVersionService.buildSnapshot(
      runbookRow({
        nodes: null as unknown as Runbook['nodes'],
        connections: null as unknown as Runbook['connections'],
        inputs: null as unknown as Runbook['inputs'],
      })
    );
    expect(snap.nodes).toEqual([]);
    expect(snap.connections).toEqual([]);
    expect(snap.inputs).toEqual([]);
  });
});

describe('applyRunbookVersionSnapshot', () => {
  it('overrides definition fields from the snapshot but keeps identity intact', () => {
    const current = runbookRow({
      name: 'Current Name',
      nodes: [{ id: 'current' }] as unknown as Runbook['nodes'],
    });
    const frozen = applyRunbookVersionSnapshot(current, {
      name: 'Frozen Name',
      nodes: [{ id: 'frozen' }],
      connections: [{ id: 'c' }],
    });

    expect(frozen.id).toBe('rb-1');
    expect(frozen.tenantId).toBe('tenant-1');
    expect(frozen.userId).toBe('user-1');
    expect(frozen.name).toBe('Frozen Name');
    expect(frozen.nodes).toEqual([{ id: 'frozen' }]);
    expect(frozen.connections).toEqual([{ id: 'c' }]);
    // Inputs not in the snapshot payload → falls through to the
    // current Runbook row's inputs.
    expect(frozen.inputs).toEqual([{ key: 'env' }]);
  });

  it('returns the runbook unchanged when the snapshot is not an object', () => {
    const current = runbookRow();
    expect(applyRunbookVersionSnapshot(current, null)).toBe(current);
    expect(applyRunbookVersionSnapshot(current, 'string')).toBe(current);
  });

  it('accepts explicit null in snapshot.description / .onErrorRunbookId', () => {
    const current = runbookRow();
    const frozen = applyRunbookVersionSnapshot(current, {
      description: null,
      onErrorRunbookId: null,
    });
    expect(frozen.description).toBeNull();
    expect(frozen.onErrorRunbookId).toBeNull();
  });
});
