import { exportDbml } from '@/lib/sql/dbml-export';
import { groupMetadata, type SqlMetadata } from '@/lib/sql/metadata';

const metadata: SqlMetadata = {
  databaseName: 'app',
  databaseVersion: 'PostgreSQL 16',
  tables: [
    { schema: 'public', name: 'users', isView: false, isMaterializedView: false, comment: null },
    {
      schema: 'public',
      name: 'orders',
      isView: false,
      isMaterializedView: false,
      comment: 'order facts',
    },
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
      comment: 'lower-case unique',
    },
    {
      schema: 'public',
      table: 'users',
      name: 'created_at',
      ordinalPosition: 3,
      type: 'timestamp',
      nullable: false,
      default: 'now()',
      isIdentity: false,
      isArray: false,
      characterMaximumLength: null,
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
    {
      schema: 'public',
      table: 'users',
      name: 'users_email_idx',
      type: 'btree',
      unique: true,
      isPrimary: false,
      columns: ['email'],
    },
  ],
};

describe('exportDbml', () => {
  it('emits Table blocks for base tables and skips views', () => {
    const dbml = exportDbml(groupMetadata(metadata));
    expect(dbml).toContain('Table public.users {');
    expect(dbml).toContain('Table public.orders');
    // Views are not part of DBML; chartdb skips them too.
    expect(dbml).not.toContain('Table public.active_users');
  });

  it('renders column types, NOT NULL, defaults, and comments', () => {
    const dbml = exportDbml(groupMetadata(metadata));
    expect(dbml).toContain('email varchar(255) [not null, note:');
    expect(dbml).toContain("note: 'lower-case unique'");
    // Function-style defaults must be backtick-wrapped, raw literals
    // pass through.
    expect(dbml).toContain('default: `now()`');
  });

  it('marks identity columns with increment', () => {
    const dbml = exportDbml(groupMetadata(metadata));
    // Match the `id` line on `users` specifically (the first column,
    // before any `user_id` foreign-key column on other tables).
    const idLine = dbml.split('\n').find(l => /^\s+id\b/.test(l))!;
    expect(idLine).toContain('not null');
    expect(idLine).toContain('increment');
  });

  it('emits an Indexes block with type + name settings', () => {
    const dbml = exportDbml(groupMetadata(metadata));
    expect(dbml).toContain('Indexes {');
    // Single-column indexes are not wrapped in parens.
    expect(dbml).toMatch(/email \[unique, name: 'users_email_idx'\]/);
  });

  it('emits Ref blocks with constraint name + delete action', () => {
    const dbml = exportDbml(groupMetadata(metadata));
    expect(dbml).toContain(
      `Ref 'orders_user_id_fkey': public.orders.user_id > public.users.id [delete: cascade]`
    );
  });

  it('respects visibleSchemas filtering', () => {
    const meta: SqlMetadata = {
      ...metadata,
      tables: [
        ...metadata.tables,
        {
          schema: 'analytics',
          name: 'sessions',
          isView: false,
          isMaterializedView: false,
          comment: null,
        },
      ],
      columns: [
        ...metadata.columns,
        {
          schema: 'analytics',
          table: 'sessions',
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
      ],
    };
    const dbml = exportDbml(groupMetadata(meta), { visibleSchemas: new Set(['public']) });
    expect(dbml).toContain('Table public.users');
    expect(dbml).not.toContain('analytics.sessions');
  });

  it('produces deterministic output for the same input (diff-friendly)', () => {
    const a = exportDbml(groupMetadata(metadata));
    const b = exportDbml(groupMetadata(metadata));
    expect(a).toBe(b);
  });
});
