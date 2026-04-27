import { Client as PgClient } from 'pg';

import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';
import { createSSHTunnel, type TunnelResult } from './ssh-tunnel';

export interface DatabaseConfig {
  /**
   * Operation to perform.
   * - introspect: query information_schema for tables, columns, FKs, indexes
   * - health: SELECT 1 + server version
   * - query: run a read-only SQL query
   */
  operation: 'introspect' | 'health' | 'query';
  /**
   * ConnectedAccount ID whose accessToken holds the PostgreSQL connection string
   * (e.g. postgresql://user:pass@host:5432/dbname).
   */
  credentialId: string;
  /** Optional SSH tunnel for accessing databases behind a bastion. */
  sshTunnel?: {
    host: string;
    port?: number;
    username: string;
    /** ConnectedAccount ID for the SSH private key. */
    sshCredentialId: string;
  };
  /** SQL query for operation='query'. Supports template substitution. */
  query?: string;
  /** Statement timeout in milliseconds (default: 30000). */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Schema introspection types (returned as executor output)
// ---------------------------------------------------------------------------

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

interface ForeignKeyInfo {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

interface SchemaInfo {
  tables: TableInfo[];
}

/**
 * Database executor — introspect schemas, run health checks, or execute
 * read-only queries against a PostgreSQL database.
 *
 * Credentials are stored as ConnectedAccount records (provider="postgres")
 * with the connection string in the encrypted accessToken field.
 *
 * For databases behind a bastion, provide sshTunnel config to route the
 * connection through an SSH tunnel (reuses the same ssh2 library as the
 * SSH executor).
 */
export class DatabaseExecutor implements StepExecutor<DatabaseConfig> {
  readonly type = 'operari.database';

  /** Injectable for tests. */
  private readonly createPgClient: (connectionString: string) => PgClient;

  constructor(createPgClient?: (connectionString: string) => PgClient) {
    this.createPgClient = createPgClient ?? (cs => new PgClient({ connectionString: cs }));
  }

  async execute(config: DatabaseConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const timeoutMs = config.timeout ?? 30_000;

    // Resolve connection string from secrets.
    const connectionString = context.secrets?.[config.credentialId];
    if (!connectionString) {
      return {
        success: false,
        error: `Database credential not found: credentialId "${config.credentialId}" is not in context.secrets. Add a ConnectedAccount with provider="postgres" and reference it in the step config.`,
        duration: Date.now() - startTime,
      };
    }

    let tunnel: TunnelResult | null = null;
    let effectiveConnectionString = connectionString;

    try {
      // Set up SSH tunnel if configured.
      if (config.sshTunnel) {
        const sshKey = context.secrets?.[config.sshTunnel.sshCredentialId];
        if (!sshKey) {
          return {
            success: false,
            error: `SSH key not found for tunnel: sshCredentialId "${config.sshTunnel.sshCredentialId}" is not in context.secrets.`,
            duration: Date.now() - startTime,
          };
        }

        context.emit?.({
          type: 'log',
          text: `Opening SSH tunnel to ${config.sshTunnel.host}...`,
          timestamp: new Date(),
        });

        // Parse the original connection string to get the DB host:port.
        const dbUrl = new URL(connectionString);
        const dbHost = dbUrl.hostname;
        const dbPort = parseInt(dbUrl.port || '5432', 10);

        tunnel = await createSSHTunnel({
          sshHost: resolveTemplate(config.sshTunnel.host, context),
          sshPort: config.sshTunnel.port ?? 22,
          sshUsername: resolveTemplate(config.sshTunnel.username, context),
          privateKey: sshKey,
          forwardHost: dbHost,
          forwardPort: dbPort,
        });

        // Rewrite connection string to go through the tunnel.
        dbUrl.hostname = '127.0.0.1';
        dbUrl.port = String(tunnel.localPort);
        effectiveConnectionString = dbUrl.toString();
      }

      const client = this.createPgClient(effectiveConnectionString);
      await client.connect();

      try {
        // Set statement timeout for safety.
        await client.query(`SET statement_timeout = ${timeoutMs}`);

        context.emit?.({
          type: 'log',
          text: `Connected — running ${config.operation}`,
          timestamp: new Date(),
        });

        let output: Record<string, unknown>;

        switch (config.operation) {
          case 'health':
            output = await this.runHealth(client);
            break;
          case 'introspect':
            output = await this.runIntrospect(client);
            break;
          case 'query':
            output = await this.runQuery(client, config, context);
            break;
          default:
            return {
              success: false,
              error: `Unknown operation: ${config.operation}`,
              duration: Date.now() - startTime,
            };
        }

        context.emit?.({
          type: 'log',
          text: `${config.operation} completed (${Date.now() - startTime}ms)`,
          timestamp: new Date(),
        });

        return {
          success: true,
          output,
          duration: Date.now() - startTime,
        };
      } finally {
        await client.end();
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      };
    } finally {
      if (tunnel) await tunnel.close();
    }
  }

  private async runHealth(client: PgClient): Promise<Record<string, unknown>> {
    const start = Date.now();
    await client.query('SELECT 1');
    const versionResult = await client.query('SHOW server_version');
    return {
      connected: true,
      serverVersion: versionResult.rows[0]?.server_version ?? 'unknown',
      latencyMs: Date.now() - start,
    };
  }

  private async runIntrospect(client: PgClient): Promise<Record<string, unknown>> {
    // 1. Tables
    const tablesResult = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `);

    const tables: TableInfo[] = [];

    for (const row of tablesResult.rows) {
      const schema = row.table_schema;
      const tableName = row.table_name;

      // 2. Columns
      const colsResult = await client.query(
        `
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
            `,
        [schema, tableName]
      );

      const columns: ColumnInfo[] = colsResult.rows.map(
        (c: {
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
        }) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          defaultValue: c.column_default,
        })
      );

      // 3. Primary key
      const pkResult = await client.query(
        `
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = $1
                  AND tc.table_name = $2
                  AND tc.constraint_type = 'PRIMARY KEY'
                ORDER BY kcu.ordinal_position
            `,
        [schema, tableName]
      );

      const primaryKey = pkResult.rows.map((r: { column_name: string }) => r.column_name);

      // 4. Foreign keys
      const fkResult = await client.query(
        `
                SELECT kcu.column_name,
                       ccu.table_name AS references_table,
                       ccu.column_name AS references_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
                  AND tc.table_schema = ccu.table_schema
                WHERE tc.table_schema = $1
                  AND tc.table_name = $2
                  AND tc.constraint_type = 'FOREIGN KEY'
            `,
        [schema, tableName]
      );

      const foreignKeys: ForeignKeyInfo[] = fkResult.rows.map(
        (r: { column_name: string; references_table: string; references_column: string }) => ({
          column: r.column_name,
          referencesTable: r.references_table,
          referencesColumn: r.references_column,
        })
      );

      // 5. Indexes
      const idxResult = await client.query(
        `
                SELECT i.relname AS index_name,
                       ix.indisunique AS is_unique,
                       array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
                FROM pg_index ix
                JOIN pg_class t ON t.oid = ix.indrelid
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                WHERE n.nspname = $1
                  AND t.relname = $2
                GROUP BY i.relname, ix.indisunique
                ORDER BY i.relname
            `,
        [schema, tableName]
      );

      const indexes: IndexInfo[] = idxResult.rows.map(
        (r: { index_name: string; columns: string[]; is_unique: boolean }) => ({
          name: r.index_name,
          columns: r.columns,
          unique: r.is_unique,
        })
      );

      tables.push({ name: tableName, schema, columns, primaryKey, foreignKeys, indexes });
    }

    const schemaInfo: SchemaInfo = { tables };
    return schemaInfo as unknown as Record<string, unknown>;
  }

  private async runQuery(
    client: PgClient,
    config: DatabaseConfig,
    context: ExecutorContext
  ): Promise<Record<string, unknown>> {
    if (!config.query) {
      throw new Error('query is required for operation="query"');
    }

    const sql = resolveTemplate(config.query, context);

    // Enforce read-only transaction to prevent accidental writes.
    await client.query('BEGIN TRANSACTION READ ONLY');
    try {
      const result = await client.query(sql);
      await client.query('COMMIT');
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map((f: { name: string; dataTypeID: number }) => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
  }
}
