import { formatColumnType, groupMetadata, type SqlMetadata } from '@/lib/sql/metadata';

const baseMetadata: SqlMetadata = {
  databaseName: 'app',
  databaseVersion: 'PostgreSQL 16',
  tables: [
    { schema: 'public', name: 'users', isView: false, isMaterializedView: false, comment: null },
    { schema: 'public', name: 'orders', isView: false, isMaterializedView: false, comment: null },
    {
      schema: 'public',
      name: 'active_users',
      isView: true,
      isMaterializedView: false,
      comment: null,
    },
  ],
  columns: [
    {
      schema: 'public',
      table: 'users',
      name: 'id',
      ordinalPosition: 1,
      type: 'integer',
      nullable: false,
      default: null,
      isIdentity: true,
      isArray: false,
      characterMaximumLength: null,
      precision: 32,
      scale: 0,
      comment: null,
    },
    {
      schema: 'public',
      table: 'users',
      name: 'email',
      ordinalPosition: 2,
      type: 'varchar',
      nullable: false,
      default: null,
      isIdentity: false,
      isArray: false,
      characterMaximumLength: 255,
      precision: null,
      scale: null,
      comment: null,
    },
    {
      schema: 'public',
      table: 'orders',
      name: 'user_id',
      ordinalPosition: 1,
      type: 'integer',
      nullable: false,
      default: null,
      isIdentity: false,
      isArray: false,
      characterMaximumLength: null,
      precision: 32,
      scale: 0,
      comment: null,
    },
  ],
  primaryKeys: [
    { schema: 'public', table: 'users', constraintName: 'users_pkey', columns: ['id'] },
  ],
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
  indexes: [
    {
      schema: 'public',
      table: 'users',
      name: 'users_pkey',
      type: 'btree',
      unique: true,
      isPrimary: true,
      columns: ['id'],
    },
  ],
};

describe('groupMetadata', () => {
  it('attaches columns, PK and FK column sets to each table bucket', () => {
    const grouped = groupMetadata(baseMetadata);

    expect(grouped.tables).toHaveLength(3);
    const users = grouped.byKey.get('public.users')!;
    expect(users.columns.map(c => c.name)).toEqual(['id', 'email']);
    expect(users.primaryKeyColumns.has('id')).toBe(true);
    expect(users.foreignKeyColumns.size).toBe(0);

    const orders = grouped.byKey.get('public.orders')!;
    expect(orders.foreignKeyColumns.has('user_id')).toBe(true);
  });

  it('orders columns by ordinalPosition even if the API hands them out of order', () => {
    const shuffled: SqlMetadata = {
      ...baseMetadata,
      columns: [...baseMetadata.columns].reverse(),
    };
    const grouped = groupMetadata(shuffled);
    const users = grouped.byKey.get('public.users')!;
    expect(users.columns.map(c => c.name)).toEqual(['id', 'email']);
  });

  it('lists views after tables and groups by schema for a stable diagram order', () => {
    const grouped = groupMetadata(baseMetadata);
    const order = grouped.tables.map(t => t.name);
    // Both base tables come before the view.
    expect(order.indexOf('active_users')).toBe(2);
  });

  it('exposes a sorted list of distinct schemas', () => {
    const meta: SqlMetadata = {
      ...baseMetadata,
      tables: [
        { schema: 'app', name: 't1', isView: false, isMaterializedView: false, comment: null },
        { schema: 'public', name: 't2', isView: false, isMaterializedView: false, comment: null },
        { schema: 'app', name: 't3', isView: false, isMaterializedView: false, comment: null },
      ],
      columns: [],
      primaryKeys: [],
      foreignKeys: [],
      indexes: [],
    };
    expect(groupMetadata(meta).schemas).toEqual(['app', 'public']);
  });
});

describe('formatColumnType', () => {
  const baseCol = baseMetadata.columns[0]!;

  it('renders character_maximum_length when present', () => {
    expect(
      formatColumnType({
        ...baseCol,
        type: 'varchar',
        characterMaximumLength: 255,
        precision: null,
        scale: null,
      })
    ).toBe('varchar(255)');
  });

  it('renders precision + scale for numeric types', () => {
    expect(
      formatColumnType({
        ...baseCol,
        type: 'numeric',
        characterMaximumLength: null,
        precision: 10,
        scale: 2,
      })
    ).toBe('numeric(10,2)');
  });

  it('renders precision alone when scale is null', () => {
    expect(
      formatColumnType({
        ...baseCol,
        type: 'real',
        characterMaximumLength: null,
        precision: null,
        scale: null,
      })
    ).toBe('real');
  });

  it('drops the redundant (precision,scale) on integer-family types', () => {
    // PG reports numeric_precision=32 / scale=0 for `integer`.
    // Showing `integer(32,0)` is noisy and not how DDL authors write it.
    expect(
      formatColumnType({
        ...baseCol,
        type: 'integer',
        characterMaximumLength: null,
        precision: 32,
        scale: 0,
      })
    ).toBe('integer');
    expect(
      formatColumnType({
        ...baseCol,
        type: 'bigint',
        characterMaximumLength: null,
        precision: 64,
        scale: 0,
      })
    ).toBe('bigint');
  });

  it('falls back to the bare type for text-like columns', () => {
    expect(
      formatColumnType({
        ...baseCol,
        type: 'text',
        characterMaximumLength: null,
        precision: null,
        scale: null,
      })
    ).toBe('text');
  });
});
