import { DbmlParseError, parseDbml } from '@/lib/sql/dbml-import';

describe('parseDbml', () => {
  it('parses a single-table DBML doc into the SqlMetadata shape', () => {
    const dbml = `
      Table users {
        id integer [pk]
        email varchar(255) [not null, unique]
        created_at timestamp
        Note: 'app users'
      }
    `;
    const meta = parseDbml(dbml);

    expect(meta.tables).toEqual([
      {
        schema: 'public',
        name: 'users',
        isView: false,
        isMaterializedView: false,
        comment: 'app users',
      },
    ]);

    expect(meta.columns.map(c => c.name)).toEqual(['id', 'email', 'created_at']);
    const email = meta.columns.find(c => c.name === 'email');
    expect(email?.type).toBe('varchar(255)');
    expect(email?.nullable).toBe(false);
    expect(email?.characterMaximumLength).toBe(255);

    expect(meta.primaryKeys).toEqual([
      {
        schema: 'public',
        table: 'users',
        constraintName: 'users_pkey',
        columns: ['id'],
      },
    ]);
  });

  it('extracts foreign keys from the inline ref shorthand', () => {
    const dbml = `
      Table users {
        id integer [pk]
      }
      Table orders {
        id integer [pk]
        user_id integer [ref: > users.id]
      }
    `;
    const meta = parseDbml(dbml);
    expect(meta.foreignKeys).toEqual([
      expect.objectContaining({
        schema: 'public',
        table: 'orders',
        column: 'user_id',
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumn: 'id',
      }),
    ]);
  });

  it('handles a top-level Ref block with onDelete clause', () => {
    const dbml = `
      Table users {
        id integer [pk]
      }
      Table sessions {
        id integer [pk]
        user_id integer
      }
      Ref user_session_fk: sessions.user_id > users.id [delete: cascade]
    `;
    const meta = parseDbml(dbml);
    expect(meta.foreignKeys).toHaveLength(1);
    const fk = meta.foreignKeys[0];
    expect(fk.column).toBe('user_id');
    expect(fk.referencedTable).toBe('users');
    expect(fk.onDelete).toBe('CASCADE');
  });

  it('treats `Indexes [pk]` as a composite primary key', () => {
    const dbml = `
      Table memberships {
        org_id integer
        user_id integer

        Indexes {
          (org_id, user_id) [pk]
        }
      }
    `;
    const meta = parseDbml(dbml);
    expect(meta.primaryKeys).toEqual([
      {
        schema: 'public',
        table: 'memberships',
        constraintName: 'memberships_pkey',
        columns: ['org_id', 'user_id'],
      },
    ]);
  });

  it('captures non-PK indexes from the Indexes block', () => {
    const dbml = `
      Table events {
        id integer [pk]
        tenant_id integer
        created_at timestamp

        Indexes {
          (tenant_id, created_at) [name: 'events_tenant_created_idx']
        }
      }
    `;
    const meta = parseDbml(dbml);
    const eventIdx = meta.indexes.filter(i => i.table === 'events');
    expect(eventIdx).toHaveLength(1);
    expect(eventIdx[0].name).toBe('events_tenant_created_idx');
    expect(eventIdx[0].columns).toEqual(['tenant_id', 'created_at']);
  });

  it('honors a non-default schema name', () => {
    const dbml = `
      Table billing.invoices {
        id integer [pk]
        amount decimal
      }
    `;
    const meta = parseDbml(dbml);
    expect(meta.tables[0].schema).toBe('billing');
    expect(meta.columns[0].schema).toBe('billing');
  });

  it('throws DbmlParseError on a syntax problem', () => {
    expect(() => parseDbml('Table users { id integer [pk]')).toThrow(DbmlParseError);
  });

  it('exposes Project metadata as databaseName / databaseVersion', () => {
    const dbml = `
      Project app {
        database_type: 'PostgreSQL'
      }
      Table u {
        id integer [pk]
      }
    `;
    const meta = parseDbml(dbml);
    expect(meta.databaseName).toBe('app');
    expect(meta.databaseVersion).toBe('PostgreSQL');
  });
});
