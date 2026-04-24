process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import {
  AuditExportRow,
  buildDeletedActorSet,
  maskDeletedId,
  redactPayload,
  redactRow,
} from '../../audit/audit-redaction';
import type { AuditService } from '../../audit/audit.service';

const row = (overrides: Partial<AuditExportRow> = {}): AuditExportRow => ({
  id: 'evt-1',
  seq: 1n,
  type: 'run.started',
  actorId: 'user-alice',
  actorType: 'user',
  resource: 'exec-1',
  payload: {},
  hash: 'h1',
  prevHash: 'h0',
  createdAt: new Date('2026-04-01T00:00:00Z'),
  ...overrides,
});

describe('maskDeletedId', () => {
  it('is deterministic: same id → same token', () => {
    expect(maskDeletedId('user-alice')).toBe(maskDeletedId('user-alice'));
  });

  it('different ids produce different tokens', () => {
    expect(maskDeletedId('user-alice')).not.toBe(maskDeletedId('user-bob'));
  });

  it('emits the documented `<deleted-user-{hex8}>` shape', () => {
    expect(maskDeletedId('user-alice')).toMatch(/^<deleted-user-[0-9a-f]{8}>$/);
  });
});

describe('redactPayload', () => {
  it('masks a top-level string that matches a deleted id', () => {
    const deleted = new Set(['user-alice']);
    expect(redactPayload('user-alice', deleted)).toBe(maskDeletedId('user-alice'));
  });

  it('leaves live ids unchanged', () => {
    const deleted = new Set(['user-alice']);
    expect(redactPayload('user-bob', deleted)).toBe('user-bob');
  });

  it('recurses into nested objects and arrays', () => {
    const deleted = new Set(['user-alice', 'user-bob']);
    const input = {
      actor: { id: 'user-alice', name: 'Alice' },
      witnesses: ['user-bob', 'user-charlie'],
      nested: { deep: { id: 'user-alice' } },
    };
    const out = redactPayload(input, deleted) as Record<string, unknown>;
    expect((out.actor as Record<string, unknown>).id).toBe(maskDeletedId('user-alice'));
    // Name field stays — it's not in the deleted set verbatim
    expect((out.actor as Record<string, unknown>).name).toBe('Alice');
    expect((out.witnesses as string[])[0]).toBe(maskDeletedId('user-bob'));
    expect((out.witnesses as string[])[1]).toBe('user-charlie');
    expect(((out.nested as Record<string, unknown>).deep as Record<string, unknown>).id).toBe(
      maskDeletedId('user-alice')
    );
  });

  it('passes through primitives other than strings', () => {
    const deleted = new Set(['user-alice']);
    expect(redactPayload(42, deleted)).toBe(42);
    expect(redactPayload(true, deleted)).toBe(true);
    expect(redactPayload(null, deleted)).toBeNull();
    expect(redactPayload(undefined, deleted)).toBeUndefined();
  });

  it('returns the original value when the deleted set is empty (perf fast path in redactRow)', () => {
    // redactPayload always recurses; the fast-path lives in redactRow.
    // Just verify no spurious replacement with empty set.
    expect(redactPayload('anything', new Set())).toBe('anything');
  });
});

describe('redactRow', () => {
  it('returns the row unchanged when the deleted set is empty', () => {
    const r = row();
    expect(redactRow(r, new Set())).toBe(r);
  });

  it('masks actorId and resource when they match a deleted id', () => {
    const deleted = new Set(['user-alice']);
    const r = row({ actorId: 'user-alice', resource: 'user-alice' });
    const out = redactRow(r, deleted);
    expect(out.actorId).toBe(maskDeletedId('user-alice'));
    expect(out.resource).toBe(maskDeletedId('user-alice'));
  });

  it('leaves actorId/resource untouched when not in the deleted set', () => {
    const deleted = new Set(['user-alice']);
    const r = row({ actorId: 'user-bob', resource: 'exec-xyz' });
    const out = redactRow(r, deleted);
    expect(out.actorId).toBe('user-bob');
    expect(out.resource).toBe('exec-xyz');
  });

  it('masks matching strings deep in payload', () => {
    const deleted = new Set(['user-alice']);
    const r = row({
      payload: { performedBy: 'user-alice', details: { nested: 'user-alice' } },
    });
    const out = redactRow(r, deleted);
    const payload = out.payload as Record<string, unknown>;
    expect(payload.performedBy).toBe(maskDeletedId('user-alice'));
    expect((payload.details as Record<string, unknown>).nested).toBe(maskDeletedId('user-alice'));
  });

  it('does NOT touch user.deleted tombstones (compliance evidence)', () => {
    const deleted = new Set(['user-alice']);
    const r = row({
      type: 'user.deleted',
      actorId: 'user-alice',
      payload: { email: 'alice@example.com', deletedAt: '2026-04-01T00:00:00Z' },
    });
    const out = redactRow(r, deleted);
    expect(out).toBe(r); // reference-equal: same row, no mutation
    expect(out.actorId).toBe('user-alice');
    expect((out.payload as Record<string, unknown>).email).toBe('alice@example.com');
  });

  it('does NOT touch tenant.deleted tombstones either', () => {
    const deleted = new Set(['user-alice']);
    const r = row({ type: 'tenant.deleted', actorId: 'user-alice' });
    const out = redactRow(r, deleted);
    expect(out).toBe(r);
  });

  it('never mutates the argument row', () => {
    const deleted = new Set(['user-alice']);
    const payload = { performedBy: 'user-alice' };
    const r = row({ actorId: 'user-alice', payload });
    const out = redactRow(r, deleted);
    expect(out).not.toBe(r);
    // Original untouched
    expect(r.actorId).toBe('user-alice');
    expect((r.payload as Record<string, unknown>).performedBy).toBe('user-alice');
    // Output redacted
    expect(out.actorId).toBe(maskDeletedId('user-alice'));
    expect((out.payload as Record<string, unknown>).performedBy).toBe(maskDeletedId('user-alice'));
  });
});

describe('buildDeletedActorSet', () => {
  function fakeAudit(rows: AuditExportRow[]): AuditService {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      streamEvents: async function* (_tenantId: string, opts: any) {
        for (const r of rows) {
          if (opts?.types && !opts.types.includes(r.type)) continue;
          yield r;
        }
      },
    } as unknown as AuditService;
  }

  it('collects actorId from every user.deleted tombstone', async () => {
    const audit = fakeAudit([
      row({ id: 'e1', type: 'user.deleted', actorId: 'user-alice' }),
      row({ id: 'e2', type: 'run.started', actorId: 'user-live' }),
      row({ id: 'e3', type: 'user.deleted', actorId: 'user-bob' }),
    ]);
    const set = await buildDeletedActorSet(audit, 't-1');
    expect(set.size).toBe(2);
    expect(set.has('user-alice')).toBe(true);
    expect(set.has('user-bob')).toBe(true);
    expect(set.has('user-live')).toBe(false);
  });

  it('also picks up deletedUserId from payload when present', async () => {
    const audit = fakeAudit([
      row({
        id: 'e1',
        type: 'user.deleted',
        actorId: 'admin-who-ran-delete',
        payload: { deletedUserId: 'user-purged' },
      }),
    ]);
    const set = await buildDeletedActorSet(audit, 't-1');
    expect(set.has('admin-who-ran-delete')).toBe(true);
    expect(set.has('user-purged')).toBe(true);
  });

  it('returns an empty set for a tenant with no tombstones', async () => {
    const audit = fakeAudit([row({ type: 'run.started', actorId: 'user-live' })]);
    const set = await buildDeletedActorSet(audit, 't-1');
    expect(set.size).toBe(0);
  });
});
