import { seedDemoRunbook } from '../../services/tenant-seed.service';
import { workflowNodeSchema } from '../../types/runbook.types';

type MockPrisma = {
  runbook: {
    count: jest.Mock;
    create: jest.Mock;
  };
};

const mkPrisma = (): MockPrisma => ({
  runbook: {
    count: jest.fn(),
    create: jest.fn(),
  },
});

describe('seedDemoRunbook', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    // Seed failures log at warn — silence during the negative-path
    // tests so the jest output stays readable.
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('creates a demo runbook for a brand-new (0-runbook) tenant', async () => {
    const prisma = mkPrisma();
    prisma.runbook.count.mockResolvedValue(0);
    prisma.runbook.create.mockResolvedValue({ id: 'rb-1' });

    const id = await seedDemoRunbook(prisma as unknown as never, {
      tenantId: 't-1',
      userId: 'u-1',
    });

    expect(id).toBe('rb-1');
    expect(prisma.runbook.create).toHaveBeenCalledTimes(1);
    const args = prisma.runbook.create.mock.calls[0][0];
    expect(args.data.tenantId).toBe('t-1');
    expect(args.data.userId).toBe('u-1');
    expect(args.data.isActive).toBe(false);
    expect(args.data.name).toMatch(/Operari/i);
    // Definition shape: one note node + one shell node, no connection
    // (notes have no ports on the canvas).
    expect(args.data.nodes).toHaveLength(2);
    expect(args.data.connections).toHaveLength(0);
    const nodeTypes = (args.data.nodes as Array<{ type: string }>).map(n => n.type);
    expect(nodeTypes.sort()).toEqual(['custom.note', 'shell']);
    // The editor autosave PUTs these back verbatim, so they must pass
    // the same schema or the demo runbook can never be saved.
    for (const node of args.data.nodes as unknown[]) {
      expect(workflowNodeSchema.safeParse(node).success).toBe(true);
    }
  });

  it('is idempotent — skips create when the tenant already has ≥1 runbook', async () => {
    // Protects against the OAuth "upsert by provider id" path running
    // twice on a brittle provider that retries the callback.
    const prisma = mkPrisma();
    prisma.runbook.count.mockResolvedValue(3);

    const id = await seedDemoRunbook(prisma as unknown as never, {
      tenantId: 't-1',
      userId: 'u-1',
    });

    expect(id).toBeNull();
    expect(prisma.runbook.create).not.toHaveBeenCalled();
  });

  it('swallows errors and returns null so callers do not block on a seed failure', async () => {
    const prisma = mkPrisma();
    prisma.runbook.count.mockResolvedValue(0);
    prisma.runbook.create.mockRejectedValue(new Error('db down'));

    const id = await seedDemoRunbook(prisma as unknown as never, {
      tenantId: 't-1',
      userId: 'u-1',
    });

    expect(id).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'tenant-seed: demo runbook creation failed',
      expect.objectContaining({ tenantId: 't-1' })
    );
  });

  it('scopes the count query to the target tenant (idempotency is per-tenant)', async () => {
    const prisma = mkPrisma();
    prisma.runbook.count.mockResolvedValue(0);
    prisma.runbook.create.mockResolvedValue({ id: 'rb-1' });

    await seedDemoRunbook(prisma as unknown as never, {
      tenantId: 't-1',
      userId: 'u-1',
    });

    const countArgs = prisma.runbook.count.mock.calls[0][0];
    expect(countArgs).toEqual({ where: { tenantId: 't-1' } });
  });
});
