import { diffMetadata } from '@/lib/sql/diff';
import type { SqlMetadata } from '@/lib/sql/metadata';

const minimalCol = (overrides: Partial<SqlMetadata['columns'][0]>): SqlMetadata['columns'][0] => ({
  schema: 'public',
  table: 't',
  name: 'col',
  ordinalPosition: 1,
  type: 'text',
  nullable: true,
  default: null,
  isIdentity: false,
  isArray: false,
  characterMaximumLength: null,
  precision: null,
  scale: null,
  comment: null,
  ...overrides,
});

const baseMeta: SqlMetadata = {
  databaseName: 'app',
  databaseVersion: 'PostgreSQL 16',
  tables: [
    { schema: 'public', name: 'users', isView: false, isMaterializedView: false, comment: null },
    { schema: 'public', name: 'orders', isView: false, isMaterializedView: false, comment: null },
  ],
  columns: [
    minimalCol({ table: 'users', name: 'id', type: 'integer', nullable: false }),
    minimalCol({ table: 'users', name: 'email', type: 'text', nullable: false }),
    minimalCol({ table: 'orders', name: 'user_id', type: 'integer', nullable: false }),
  ],
  primaryKeys: [],
  foreignKeys: [
    {
      schema: 'public',
      table: 'orders',
      constraintName: 'orders_user_id_fkey',
      column: 'user_id',
      referencedSchema: 'public',
      referencedTable: 'users',
      referencedColumn: 'id',
      onDelete: 'CASCADE',
      onUpdate: null,
    },
  ],
  indexes: [],
};

describe('diffMetadata', () => {
  it('detects no changes when both snapshots are identical', () => {
    const diff = diffMetadata(baseMeta, baseMeta);
    expect(diff.counts.addedTables).toBe(0);
    expect(diff.counts.removedTables).toBe(0);
    expect(diff.counts.changedTables).toBe(0);
    expect(diff.counts.addedForeignKeys).toBe(0);
    expect(diff.counts.removedForeignKeys).toBe(0);
    for (const t of diff.tables.values()) {
      expect(t.status).toBe('unchanged');
    }
  });

  it('marks newly-introduced tables as added', () => {
    const next: SqlMetadata = {
      ...baseMeta,
      tables: [
        ...baseMeta.tables,
        {
          schema: 'public',
          name: 'audit',
          isView: false,
          isMaterializedView: false,
          comment: null,
        },
      ],
      columns: [
        ...baseMeta.columns,
        minimalCol({ table: 'audit', name: 'id', type: 'integer', nullable: false }),
      ],
    };
    const diff = diffMetadata(baseMeta, next);
    expect(diff.counts.addedTables).toBe(1);
    expect(diff.counts.addedColumns).toBe(1);
    const audit = diff.tables.get('public.audit')!;
    expect(audit.status).toBe('added');
    expect(audit.columns.every(c => c.status === 'added')).toBe(true);
  });

  it('marks dropped tables as removed and keeps their columns as ghost rows', () => {
    const next: SqlMetadata = {
      ...baseMeta,
      tables: baseMeta.tables.filter(t => t.name !== 'orders'),
      columns: baseMeta.columns.filter(c => c.table !== 'orders'),
      foreignKeys: [],
    };
    const diff = diffMetadata(baseMeta, next);
    expect(diff.counts.removedTables).toBe(1);
    const orders = diff.tables.get('public.orders')!;
    expect(orders.status).toBe('removed');
    expect(orders.side).toBe('base');
    expect(orders.columns.length).toBe(1);
    expect(orders.columns[0]?.status).toBe('removed');
    expect(diff.counts.removedForeignKeys).toBe(1);
  });

  it('flags type / nullable / default changes per-column', () => {
    const next: SqlMetadata = {
      ...baseMeta,
      columns: baseMeta.columns.map(c => {
        if (c.table === 'users' && c.name === 'email') {
          return { ...c, type: 'varchar', characterMaximumLength: 255, default: null };
        }
        if (c.table === 'users' && c.name === 'id') {
          return { ...c, nullable: true };
        }
        return c;
      }),
    };
    const diff = diffMetadata(baseMeta, next);
    const users = diff.tables.get('public.users')!;
    expect(users.status).toBe('changed');
    const emailDiff = users.columns.find(c => c.name === 'email')!;
    expect(emailDiff.status).toBe('changed');
    expect(emailDiff.changedFields).toEqual(
      expect.arrayContaining(['type', 'characterMaximumLength'])
    );
    const idDiff = users.columns.find(c => c.name === 'id')!;
    expect(idDiff.changedFields).toEqual(['nullable']);
  });

  it('detects FK additions independently from table changes', () => {
    const next: SqlMetadata = {
      ...baseMeta,
      foreignKeys: [
        ...baseMeta.foreignKeys,
        {
          schema: 'public',
          table: 'orders',
          constraintName: 'orders_brand_fk',
          column: 'user_id',
          referencedSchema: 'public',
          referencedTable: 'users',
          referencedColumn: 'id',
          onDelete: null,
          onUpdate: null,
        },
      ],
    };
    const diff = diffMetadata(baseMeta, next);
    expect(diff.counts.addedForeignKeys).toBe(1);
    expect(diff.addedForeignKeys.has('public.orders.orders_brand_fk')).toBe(true);
  });
});
