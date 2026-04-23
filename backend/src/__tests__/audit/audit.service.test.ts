import type { PrismaClient } from '@prisma/client';
import { AuditService, AuditEventType } from '../../audit/audit.service';

describe('AuditService.computeHash', () => {
  it('is deterministic for the same payload and prevHash', () => {
    const payload = { foo: 'bar', n: 42 };
    const a = AuditService.computeHash('', payload);
    const b = AuditService.computeHash('', payload);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of object key order', () => {
    const a = AuditService.computeHash('prev', { a: 1, b: 2 });
    const b = AuditService.computeHash('prev', { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it('depends on prevHash', () => {
    const payload = { foo: 'bar' };
    const a = AuditService.computeHash('', payload);
    const b = AuditService.computeHash('something', payload);
    expect(a).not.toBe(b);
  });

  it('depends on payload contents', () => {
    const a = AuditService.computeHash('', { foo: 'bar' });
    const b = AuditService.computeHash('', { foo: 'baz' });
    expect(a).not.toBe(b);
  });
});

describe('AuditService.tenantLockKey', () => {
  it('is deterministic per tenant', () => {
    const a = AuditService.tenantLockKey('tenant-abc');
    const b = AuditService.tenantLockKey('tenant-abc');
    expect(a).toEqual(b);
  });

  it('uses a fixed namespace', () => {
    const a = AuditService.tenantLockKey('tenant-x');
    const b = AuditService.tenantLockKey('tenant-y');
    expect(a.namespace).toBe(0x4e52);
    expect(b.namespace).toBe(0x4e52);
    expect(a.tenant).not.toBe(b.tenant);
  });

  it('produces non-negative 31-bit ints', () => {
    for (const id of ['t1', 't2', 'long-tenant-id-' + 'x'.repeat(50)]) {
      const k = AuditService.tenantLockKey(id);
      expect(k.tenant).toBeGreaterThanOrEqual(0);
      expect(k.tenant).toBeLessThan(0x80000000);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration-style tests with an in-memory fake Prisma client.
// ---------------------------------------------------------------------------

interface StoredEvent {
  seq: bigint;
  id: string;
  tenantId: string;
  type: string;
  actorId: string | null;
  actorType: string | null;
  resource: string | null;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string;
  createdAt: Date;
}

class FakePrisma {
  private store: StoredEvent[] = [];
  private nextSeq = 1n;
  private nextId = 1;

  auditEvent = {
    findFirst: async (args: {
      where?: { tenantId?: string; seq?: { lt?: bigint } };
      orderBy?: { seq: 'asc' | 'desc' };
      select?: Record<string, boolean>;
    }) => {
      let rows = this.store.filter(
        r => !args.where?.tenantId || r.tenantId === args.where.tenantId
      );
      if (args.where?.seq?.lt !== undefined) {
        const lt = args.where.seq.lt;
        rows = rows.filter(r => r.seq < lt);
      }
      rows.sort((a, b) =>
        args.orderBy?.seq === 'desc' ? Number(b.seq - a.seq) : Number(a.seq - b.seq)
      );
      return rows[0] ?? null;
    },
    findMany: async (args: {
      where?: { tenantId?: string; seq?: { gte?: bigint } };
      orderBy?: { seq: 'asc' | 'desc' };
      take?: number;
    }) => {
      let rows = this.store.filter(
        r => !args.where?.tenantId || r.tenantId === args.where.tenantId
      );
      if (args.where?.seq?.gte !== undefined) {
        const gte = args.where.seq.gte;
        rows = rows.filter(r => r.seq >= gte);
      }
      rows.sort((a, b) => Number(a.seq - b.seq));
      return args.take ? rows.slice(0, args.take) : rows;
    },
    create: async (args: {
      data: Omit<StoredEvent, 'seq' | 'id' | 'createdAt'>;
      select?: Record<string, boolean>;
    }) => {
      const row: StoredEvent = {
        seq: this.nextSeq++,
        id: `evt-${this.nextId++}`,
        createdAt: new Date(),
        ...args.data,
        payload: args.data.payload as Record<string, unknown>,
      };
      this.store.push(row);
      return row;
    },
  };

  async $transaction<T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async $executeRawUnsafe(): Promise<number> {
    // Advisory lock is a no-op in the fake.
    return 0;
  }

  /** Test-only helper to read raw rows. */
  _all(): StoredEvent[] {
    return this.store;
  }

  /** Test-only helper to corrupt a row, simulating a tampering attempt
   *  that bypassed the Postgres trigger (e.g. dropped trigger + UPDATE). */
  _tamper(seq: bigint, mutation: (row: StoredEvent) => void): void {
    const row = this.store.find(r => r.seq === seq);
    if (!row) throw new Error(`tamper: no row with seq ${seq}`);
    mutation(row);
  }
}

const buildService = () => {
  const fake = new FakePrisma();
  const service = new AuditService(fake as unknown as PrismaClient);
  return { fake, service };
};

const evt = (
  over: Partial<{ type: AuditEventType; payload: Record<string, unknown>; resource: string }> = {}
) => ({
  tenantId: 't1',
  type: (over.type ?? 'run.started') as AuditEventType,
  actorId: 'user-1',
  actorType: 'user' as const,
  resource: over.resource ?? 'run-1',
  payload: over.payload ?? { runbook: 'deploy' },
});

describe('AuditService.record + verifyChain', () => {
  it('chains events: each row links to the previous hash', async () => {
    const { fake, service } = buildService();
    const a = await service.record(evt({ payload: { step: 1 } }));
    const b = await service.record(evt({ payload: { step: 2 } }));
    const c = await service.record(evt({ payload: { step: 3 } }));

    const rows = fake._all();
    expect(rows).toHaveLength(3);
    expect(rows[0].prevHash).toBe('');
    expect(rows[1].prevHash).toBe(a.hash);
    expect(rows[2].prevHash).toBe(b.hash);
    expect(c.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyChain reports an intact chain', async () => {
    const { service } = buildService();
    await service.record(evt({ payload: { step: 1 } }));
    await service.record(evt({ payload: { step: 2 } }));
    await service.record(evt({ payload: { step: 3 } }));

    const status = await service.verifyChain('t1');
    expect(status.eventCount).toBe(3);
    expect(status.firstBrokenSeq).toBeNull();
    expect(status.firstGapAfterSeq).toBeNull();
  });

  it('verifyChain detects payload tampering', async () => {
    const { fake, service } = buildService();
    await service.record(evt({ payload: { step: 1 } }));
    await service.record(evt({ payload: { step: 2 } }));
    await service.record(evt({ payload: { step: 3 } }));

    // Simulate someone bypassing the trigger and editing row #2's payload
    fake._tamper(2n, row => {
      row.payload = { step: 'TAMPERED' };
    });

    const status = await service.verifyChain('t1');
    expect(status.firstBrokenSeq).toBe(2n);
  });

  it('verifyChain detects hash tampering', async () => {
    const { fake, service } = buildService();
    await service.record(evt({ payload: { step: 1 } }));
    await service.record(evt({ payload: { step: 2 } }));

    fake._tamper(2n, row => {
      row.hash = 'a'.repeat(64);
    });

    const status = await service.verifyChain('t1');
    expect(status.firstBrokenSeq).toBe(2n);
  });

  it('isolates chains per tenant', async () => {
    const { fake, service } = buildService();
    await service.record({ ...evt(), tenantId: 't1' });
    await service.record({ ...evt(), tenantId: 't2' });
    await service.record({ ...evt(), tenantId: 't1' });

    const t1Rows = fake._all().filter(r => r.tenantId === 't1');
    const t2Rows = fake._all().filter(r => r.tenantId === 't2');
    expect(t1Rows).toHaveLength(2);
    expect(t2Rows).toHaveLength(1);
    expect(t1Rows[0].prevHash).toBe('');
    expect(t2Rows[0].prevHash).toBe('');
    expect(t1Rows[1].prevHash).toBe(t1Rows[0].hash);

    const s1 = await service.verifyChain('t1');
    const s2 = await service.verifyChain('t2');
    expect(s1.eventCount).toBe(2);
    expect(s2.eventCount).toBe(1);
    expect(s1.firstBrokenSeq).toBeNull();
    expect(s2.firstBrokenSeq).toBeNull();
  });

  it('hash is independent of payload key order', async () => {
    const { service } = buildService();
    const a = await service.record(evt({ payload: { foo: 1, bar: 2 } }));
    // New tenant to start a fresh chain
    const b = await service.record({
      ...evt({ payload: { bar: 2, foo: 1 } }),
      tenantId: 't-other',
    });
    // First event of each chain has prevHash = "" so the hashes match
    // when payloads are logically equal.
    expect(a.hash).toBe(b.hash);
  });
});
