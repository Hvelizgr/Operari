import { Router, Response } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { Client as PgClient } from 'pg';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { AuditService } from '../audit/audit.service';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';

const router = Router();

// Anonymous fallback for dev
router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanorun.local',
            role: 'USER',
            tenantId: 'default-tenant',
        };
    }
    next();
});

/**
 * Resolve the plaintext connection string for a ConnectedAccount.
 */
async function resolveConnectionString(credentialId: string, tenantId: string): Promise<string | null> {
    const key = env.ENCRYPTION_KEY ?? '0'.repeat(64);
    const cipher = new SecretCipher(key);
    const audit = new AuditService(prisma);
    const reader = new SecretReader(cipher, audit);

    const account = await prisma.connectedAccount.findFirst({
        where: { id: credentialId, tenantId },
    });
    if (!account) return null;

    return reader.read({
        ciphertext: account.accessToken,
        aad: account.id,
        tenantId,
        actorId: 'system',
        resource: `connected-account:${credentialId}`,
        reason: 'sql-editor-query',
    });
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

    const connectionString = await resolveConnectionString(credentialId, tenantId);
    if (!connectionString) {
        return res.status(404).json({ error: 'Database credential not found' });
    }

    const client = new PgClient({ connectionString });
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
            fields: result.fields?.map((f: any) => ({
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

    const connectionString = await resolveConnectionString(credentialId, tenantId);
    if (!connectionString) {
        return res.status(404).json({ error: 'Database credential not found' });
    }

    const client = new PgClient({ connectionString });

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
            const colsResult = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
            `, [row.table_schema, row.table_name]);

            tables.push({
                schema: row.table_schema,
                name: row.table_name,
                columns: colsResult.rows.map((c: any) => ({
                    name: c.column_name,
                    type: c.data_type,
                    nullable: c.is_nullable === 'YES',
                    default: c.column_default,
                })),
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

export default router;
