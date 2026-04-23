import {
  DatabaseExecutor,
  type DatabaseConfig,
} from '../../../runbook/executors/database.executor';
import type { ExecutorContext, ExecutorEvent } from '../../../runbook/types/executor.types';

// ---------------------------------------------------------------------------
// Fake pg.Client
// ---------------------------------------------------------------------------

class FakePgClient {
  public queries: string[] = [];
  public connected = false;
  private queryResults: Map<string, any>;

  constructor(results: Record<string, any> = {}) {
    this.queryResults = new Map(Object.entries(results));
  }

  async connect() {
    this.connected = true;
  }

  async query(sql: string, _params?: any[]) {
    this.queries.push(sql.trim());

    // Check for exact match first, then pattern match.
    for (const [pattern, result] of this.queryResults) {
      if (sql.includes(pattern)) {
        return result;
      }
    }

    // Default responses.
    if (sql.includes('SELECT 1')) {
      return { rows: [{ '?column?': 1 }] };
    }
    if (sql.includes('SHOW server_version')) {
      return { rows: [{ server_version: '16.2' }] };
    }
    if (sql.includes('information_schema.tables')) {
      return { rows: [] };
    }
    if (
      sql.includes('BEGIN') ||
      sql.includes('COMMIT') ||
      sql.includes('ROLLBACK') ||
      sql.includes('SET statement_timeout')
    ) {
      return { rows: [] };
    }

    return { rows: [], rowCount: 0, fields: [] };
  }

  async end() {
    this.connected = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const execCtx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  tenantId: 'tenant-1',
  variables: {},
  previousOutputs: {},
  secrets: {
    'db-cred-1': 'postgresql://user:pass@db.internal:5432/myapp',
  },
  ...overrides,
});

const dbConfig = (overrides: Partial<DatabaseConfig> = {}): DatabaseConfig => ({
  operation: 'health',
  credentialId: 'db-cred-1',
  ...overrides,
});

describe('DatabaseExecutor', () => {
  it('runs health check and returns server version', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(dbConfig(), execCtx());

    expect(result.success).toBe(true);
    const output = result.output as any;
    expect(output.connected).toBe(true);
    expect(output.serverVersion).toBe('16.2');
    expect(output.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('runs introspect on empty database', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(dbConfig({ operation: 'introspect' }), execCtx());

    expect(result.success).toBe(true);
    const output = result.output as any;
    expect(output.tables).toEqual([]);
  });

  it('runs introspect and returns table info', async () => {
    const fakePg = new FakePgClient({
      'information_schema.tables': {
        rows: [{ table_schema: 'public', table_name: 'users' }],
      },
      'information_schema.columns': {
        rows: [
          {
            column_name: 'id',
            data_type: 'uuid',
            is_nullable: 'NO',
            column_default: 'gen_random_uuid()',
          },
          {
            column_name: 'email',
            data_type: 'character varying',
            is_nullable: 'NO',
            column_default: null,
          },
        ],
      },
      'PRIMARY KEY': {
        rows: [{ column_name: 'id' }],
      },
      'FOREIGN KEY': {
        rows: [],
      },
      pg_index: {
        rows: [],
      },
    });
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(dbConfig({ operation: 'introspect' }), execCtx());

    expect(result.success).toBe(true);
    const output = result.output as any;
    expect(output.tables).toHaveLength(1);
    expect(output.tables[0].name).toBe('users');
    expect(output.tables[0].columns).toHaveLength(2);
    expect(output.tables[0].columns[0].name).toBe('id');
    expect(output.tables[0].primaryKey).toEqual(['id']);
  });

  it('runs read-only query', async () => {
    const fakePg = new FakePgClient({
      'SELECT COUNT': {
        rows: [{ count: 42 }],
        rowCount: 1,
        fields: [{ name: 'count', dataTypeID: 20 }],
      },
    });
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(
      dbConfig({
        operation: 'query',
        query: 'SELECT COUNT(*) FROM users',
      }),
      execCtx()
    );

    expect(result.success).toBe(true);
    const output = result.output as any;
    expect(output.rows).toEqual([{ count: 42 }]);
    expect(output.rowCount).toBe(1);

    // Verify read-only transaction was used.
    expect(fakePg.queries).toContain('BEGIN TRANSACTION READ ONLY');
    expect(fakePg.queries).toContain('COMMIT');
  });

  it('fails when credentialId is not in secrets', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(dbConfig({ credentialId: 'missing-cred' }), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database credential not found');
    expect(result.error).toContain('missing-cred');
  });

  it('fails when query is missing for operation=query', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(dbConfig({ operation: 'query' }), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('query is required');
  });

  it('resolves templates in query', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    await executor.execute(
      dbConfig({
        operation: 'query',
        query: 'SELECT * FROM {{vars.table}}',
      }),
      execCtx({ variables: { table: 'orders' } })
    );

    const queryStatements = fakePg.queries.filter(q => q.includes('orders'));
    expect(queryStatements.length).toBeGreaterThan(0);
  });

  it('sets statement timeout', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    await executor.execute(dbConfig({ timeout: 15000 }), execCtx());

    const timeoutQuery = fakePg.queries.find(q => q.includes('statement_timeout'));
    expect(timeoutQuery).toContain('15000');
  });

  it('emits log events', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    const events: ExecutorEvent[] = [];
    const ctx = execCtx({ emit: e => events.push(e) });

    await executor.execute(dbConfig(), ctx);

    const logEvents = events.filter(e => e.type === 'log');
    expect(logEvents.length).toBeGreaterThanOrEqual(2);
    expect(logEvents[0].text).toContain('Connected');
    expect(logEvents[1].text).toContain('health completed');
  });

  it('handles connection errors', async () => {
    const executor = new DatabaseExecutor(() => {
      const client = {
        connect: async () => {
          throw new Error('Connection refused');
        },
        end: async () => {},
      };
      return client as any;
    });

    const result = await executor.execute(dbConfig(), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('fails on unknown operation', async () => {
    const fakePg = new FakePgClient();
    const executor = new DatabaseExecutor(() => fakePg as any);

    const result = await executor.execute(dbConfig({ operation: 'drop' as any }), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown operation');
  });
});
