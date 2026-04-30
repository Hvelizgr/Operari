import { Response, Router } from 'express';
import { Client as PgClient } from 'pg';

import { AuditService } from '../audit/audit.service';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { AuthRequest } from '../middleware/auth.middleware';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { prisma } from '../server';

const router = Router();

// Anonymous fallback for dev
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

// Mirrors the capability bits the frontend reads from
// `@operari/shared`'s `connected-account-capabilities`. Kept as a small
// hard-coded set instead of pulling the shared package as a backend
// dependency — the SQL routes only need to ask one question ("can
// this provider speak SQL at all?") and a 6-line allowlist is easier
// to reason about than wiring an extra build step. Update this set
// when adding a new SQL-capable connector backend-side.
const SQL_CAPABLE_PROVIDERS = new Set(['postgres', 'mysql']);

function rejectIfNotSqlCapable(
  provider: string,
  res: Response,
  capability: 'query' | 'introspect'
): boolean {
  if (SQL_CAPABLE_PROVIDERS.has(provider)) return false;
  res.status(400).json({
    error: `Provider '${provider}' does not support ${capability}`,
    code: 'capability_unsupported',
    provider,
  });
  return true;
}

/**
 * Resolve the plaintext connection string for a ConnectedAccount.
 * Also returns the provider so callers can gate behaviour off it
 * without re-querying the row.
 */
async function resolveCredential(
  credentialId: string,
  tenantId: string
): Promise<{ connectionString: string; provider: string } | null> {
  const key = env.ENCRYPTION_KEY ?? '0'.repeat(64);
  const cipher = new SecretCipher(key);
  const audit = new AuditService(prisma);
  const reader = new SecretReader(cipher, audit);

  const account = await prisma.connectedAccount.findFirst({
    where: { id: credentialId, tenantId },
  });
  if (!account) return null;

  const connectionString = await reader.read({
    ciphertext: account.accessToken,
    aad: account.id,
    tenantId,
    actorId: 'system',
    resource: `connected-account:${credentialId}`,
    reason: 'sql-editor-query',
  });
  if (!connectionString) return null;
  return { connectionString, provider: account.provider };
}

/**
 * POST /api/sql/query
 *
 * Execute a read-only SQL query against a connected PostgreSQL database.
 * Body: { credentialId, query, timeout? }
 * Returns: { rows, rowCount, fields, durationMs }
 */
router.post('/query', async (req: AuthRequest, res: Response) => {
  const { credentialId, query, timeout = 30000 } = req.body;
  const tenantId = req.user!.tenantId;

  if (!credentialId || !query) {
    return res.status(400).json({ error: 'credentialId and query are required' });
  }

  // Wrap credential resolution so an encryption-config error (e.g.
  // ENCRYPTION_KEY not hex/base64 → SecretCipher ctor throws) doesn't
  // leak an unhandled rejection. Without this guard, supertest hangs
  // forever waiting for a response that never comes — which is the
  // exact bug that tripped the test-suite timeouts pre-CI.
  let credential: { connectionString: string; provider: string } | null;
  try {
    credential = await resolveCredential(credentialId, tenantId);
  } catch (err) {
    logger.error({ err, credentialId }, 'Failed to resolve database credential');
    return res.status(500).json({ error: 'Credential resolution failed' });
  }
  if (!credential) {
    return res.status(404).json({ error: 'Database credential not found' });
  }
  // Capability gate: rejecting a Slack credentialId here yields a
  // 400 with a useful message, instead of letting it through and
  // surfacing an obscure pg connection error 30s later.
  if (rejectIfNotSqlCapable(credential.provider, res, 'query')) return;

  const client = new PgClient({ connectionString: credential.connectionString });
  const startTime = Date.now();

  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${Math.min(Number(timeout), 60000)}`);
    await client.query('BEGIN TRANSACTION READ ONLY');

    const result = await client.query(query);
    await client.query('COMMIT');

    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map((f: { name: string; dataTypeID: number }) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, credentialId }, 'SQL query failed');
    res.status(422).json({ error: message, durationMs: Date.now() - startTime });
  } finally {
    await client.end();
  }
});

/**
 * POST /api/sql/schema
 *
 * Introspect the database schema (tables, columns, types).
 * Body: { credentialId }
 * Returns: { tables: [...] }
 */
router.post('/schema', async (req: AuthRequest, res: Response) => {
  const { credentialId } = req.body;
  const tenantId = req.user!.tenantId;

  if (!credentialId) {
    return res.status(400).json({ error: 'credentialId is required' });
  }

  // See /query handler for the rationale — keep credential resolution
  // guarded so an encryption-config error returns a clean 500 instead
  // of hanging the response.
  let credential: { connectionString: string; provider: string } | null;
  try {
    credential = await resolveCredential(credentialId, tenantId);
  } catch (err) {
    logger.error({ err, credentialId }, 'Failed to resolve database credential');
    return res.status(500).json({ error: 'Credential resolution failed' });
  }
  if (!credential) {
    return res.status(404).json({ error: 'Database credential not found' });
  }
  if (rejectIfNotSqlCapable(credential.provider, res, 'introspect')) return;

  const client = new PgClient({ connectionString: credential.connectionString });

  try {
    await client.connect();
    await client.query('SET statement_timeout = 15000');

    const tablesResult = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `);

    const tables = [];
    for (const row of tablesResult.rows) {
      const colsResult = await client.query(
        `
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
            `,
        [row.table_schema, row.table_name]
      );

      tables.push({
        schema: row.table_schema,
        name: row.table_name,
        columns: colsResult.rows.map(
          (c: {
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
          }) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable === 'YES',
            default: c.column_default,
          })
        ),
      });
    }

    res.json({ tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, credentialId }, 'Schema introspection failed');
    res.status(422).json({ error: message });
  } finally {
    await client.end();
  }
});

/**
 * POST /api/sql/metadata
 *
 * Rich PostgreSQL schema introspection in a small set of focused queries.
 * Inspired by chartdb's single-query "smart query" pattern (AGPL, see
 * docs/research/chartdb-research.md) but split into readable sub-queries
 * we maintain ourselves.
 *
 * Body: { credentialId }
 * Response shape (zod-validated on the frontend):
 *   {
 *     databaseName, databaseVersion,
 *     tables:        [{ schema, name, isView, isMaterializedView, comment }]
 *     columns:       [{ schema, table, name, type, ordinalPosition,
 *                       nullable, default, comment, isIdentity, isArray,
 *                       characterMaximumLength, precision, scale }]
 *     primaryKeys:   [{ schema, table, columns[], constraintName }]
 *     foreignKeys:   [{ schema, table, column, referencedSchema,
 *                       referencedTable, referencedColumn, constraintName,
 *                       onDelete, onUpdate }]
 *     indexes:       [{ schema, table, name, columns[], unique, type,
 *                       isPrimary }]
 *   }
 *
 * Excludes pg_catalog / information_schema from every result. Uses the
 * existing read-only pattern (statement_timeout + READ ONLY transaction)
 * so a hostile metadata query can't mutate the connected database.
 */
router.post('/metadata', async (req: AuthRequest, res: Response) => {
  const { credentialId } = req.body;
  const tenantId = req.user!.tenantId;

  if (!credentialId) {
    return res.status(400).json({ error: 'credentialId is required' });
  }

  let credential: { connectionString: string; provider: string } | null;
  try {
    credential = await resolveCredential(credentialId, tenantId);
  } catch (err) {
    logger.error({ err, credentialId }, 'Failed to resolve database credential');
    return res.status(500).json({ error: 'Credential resolution failed' });
  }
  if (!credential) {
    return res.status(404).json({ error: 'Database credential not found' });
  }
  if (rejectIfNotSqlCapable(credential.provider, res, 'introspect')) return;

  const client = new PgClient({ connectionString: credential.connectionString });
  const startTime = Date.now();

  try {
    await client.connect();
    await client.query('SET statement_timeout = 30000');
    await client.query('BEGIN TRANSACTION READ ONLY');

    const [
      versionResult,
      databaseNameResult,
      tablesResult,
      columnsResult,
      pksResult,
      fksResult,
      indexesResult,
    ] = await Promise.all([
      client.query('SELECT version() AS version'),
      client.query('SELECT current_database() AS name'),
      client.query(`
        SELECT
          n.nspname AS schema,
          c.relname AS name,
          c.relkind AS kind,
          obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'v', 'm')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
        ORDER BY n.nspname, c.relname
      `),
      client.query(`
        SELECT
          c.table_schema AS schema,
          c.table_name AS table,
          c.column_name AS name,
          c.ordinal_position AS ordinal_position,
          c.data_type AS type,
          c.udt_name AS udt_name,
          c.is_nullable = 'YES' AS nullable,
          c.column_default AS default,
          c.is_identity = 'YES' AS is_identity,
          c.character_maximum_length AS character_maximum_length,
          c.numeric_precision AS numeric_precision,
          c.numeric_scale AS numeric_scale,
          col_description(format('%I.%I', c.table_schema, c.table_name)::regclass, c.ordinal_position) AS comment
        FROM information_schema.columns c
        JOIN pg_namespace n ON n.nspname = c.table_schema
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND c.table_schema NOT LIKE 'pg_toast%'
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `),
      client.query(`
        SELECT
          n.nspname AS schema,
          cl.relname AS table,
          c.conname AS constraint_name,
          ARRAY(
            SELECT a.attname
            FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            ORDER BY k.ord
          ) AS columns
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        WHERE c.contype = 'p'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, cl.relname
      `),
      client.query(`
        SELECT
          n.nspname AS schema,
          cl.relname AS table,
          c.conname AS constraint_name,
          a.attname AS column,
          fn.nspname AS referenced_schema,
          fcl.relname AS referenced_table,
          fa.attname AS referenced_column,
          c.confdeltype AS on_delete_code,
          c.confupdtype AS on_update_code
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        JOIN pg_class fcl ON fcl.oid = c.confrelid
        JOIN pg_namespace fn ON fn.oid = fcl.relnamespace
        JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = ANY(c.confkey)
        WHERE c.contype = 'f'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND array_position(c.conkey, a.attnum) = array_position(c.confkey, fa.attnum)
        ORDER BY n.nspname, cl.relname, c.conname
      `),
      client.query(`
        SELECT
          n.nspname AS schema,
          tcl.relname AS table,
          icl.relname AS name,
          am.amname AS type,
          i.indisunique AS unique,
          i.indisprimary AS is_primary,
          ARRAY(
            SELECT a.attname
            FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
            ORDER BY k.ord
          ) AS columns
        FROM pg_index i
        JOIN pg_class icl ON icl.oid = i.indexrelid
        JOIN pg_class tcl ON tcl.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = tcl.relnamespace
        JOIN pg_am am ON am.oid = icl.relam
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, tcl.relname, icl.relname
      `),
    ]);

    await client.query('COMMIT');

    // Map PG `confdeltype` / `confupdtype` codes (single chars) to FK
    // action verbs the UI can render. 'a' is the implicit default and
    // we surface it as null so the cardinality marker stays clean.
    const referentialAction = (code: string): string | null => {
      switch (code) {
        case 'a':
          return null;
        case 'r':
          return 'RESTRICT';
        case 'c':
          return 'CASCADE';
        case 'n':
          return 'SET NULL';
        case 'd':
          return 'SET DEFAULT';
        default:
          return null;
      }
    };

    const tables = tablesResult.rows.map(
      (r: { schema: string; name: string; kind: string; comment: string | null }) => ({
        schema: r.schema,
        name: r.name,
        isView: r.kind === 'v',
        isMaterializedView: r.kind === 'm',
        comment: r.comment,
      })
    );

    const columns = columnsResult.rows.map(
      (r: {
        schema: string;
        table: string;
        name: string;
        ordinal_position: number;
        type: string;
        udt_name: string;
        nullable: boolean;
        default: string | null;
        is_identity: boolean;
        character_maximum_length: number | null;
        numeric_precision: number | null;
        numeric_scale: number | null;
        comment: string | null;
      }) => {
        const isArray = r.type === 'ARRAY';
        // For arrays, `udt_name` is the element type prefixed with `_`.
        // Strip the underscore so the UI displays e.g. `text[]` rather
        // than `_text` — mirrors `format_type(typelem, NULL)` semantics.
        const elementType =
          isArray && typeof r.udt_name === 'string' && r.udt_name.startsWith('_')
            ? r.udt_name.slice(1)
            : r.udt_name;
        return {
          schema: r.schema,
          table: r.table,
          name: r.name,
          ordinalPosition: r.ordinal_position,
          type: isArray ? `${elementType}[]` : r.type === 'USER-DEFINED' ? r.udt_name : r.type,
          nullable: r.nullable,
          default: r.default,
          isIdentity: r.is_identity,
          isArray,
          characterMaximumLength: r.character_maximum_length,
          precision: r.numeric_precision,
          scale: r.numeric_scale,
          comment: r.comment,
        };
      }
    );

    const primaryKeys = pksResult.rows.map(
      (r: { schema: string; table: string; constraint_name: string; columns: string[] }) => ({
        schema: r.schema,
        table: r.table,
        constraintName: r.constraint_name,
        columns: r.columns,
      })
    );

    const foreignKeys = fksResult.rows.map(
      (r: {
        schema: string;
        table: string;
        constraint_name: string;
        column: string;
        referenced_schema: string;
        referenced_table: string;
        referenced_column: string;
        on_delete_code: string;
        on_update_code: string;
      }) => ({
        schema: r.schema,
        table: r.table,
        constraintName: r.constraint_name,
        column: r.column,
        referencedSchema: r.referenced_schema,
        referencedTable: r.referenced_table,
        referencedColumn: r.referenced_column,
        onDelete: referentialAction(r.on_delete_code),
        onUpdate: referentialAction(r.on_update_code),
      })
    );

    const indexes = indexesResult.rows.map(
      (r: {
        schema: string;
        table: string;
        name: string;
        type: string;
        unique: boolean;
        is_primary: boolean;
        columns: string[];
      }) => ({
        schema: r.schema,
        table: r.table,
        name: r.name,
        type: r.type,
        unique: r.unique,
        isPrimary: r.is_primary,
        columns: r.columns,
      })
    );

    res.json({
      databaseName: databaseNameResult.rows[0]?.name ?? null,
      databaseVersion: versionResult.rows[0]?.version ?? null,
      tables,
      columns,
      primaryKeys,
      foreignKeys,
      indexes,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, credentialId }, 'Metadata introspection failed');
    res.status(422).json({ error: message });
  } finally {
    await client.end();
  }
});

export default router;
