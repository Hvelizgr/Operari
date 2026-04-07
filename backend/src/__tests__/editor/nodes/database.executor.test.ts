import { DatabaseNodeExecutor } from '../../../editor/nodes/database.executor';

const errCtx = { nodeId: 'n', nodeName: 'Database', nodeType: 'Database' };

describe('DatabaseNodeExecutor (passthrough stub)', () => {
    const exec = new DatabaseNodeExecutor();

    it('exposes type=Database and SQL alias', () => {
        expect(exec.type).toBe('Database');
        expect(exec.aliases).toEqual(['SQL']);
    });

    it('echoes operation/table and resolves the query template', async () => {
        const result = await exec.execute(
            {
                operation: 'select',
                table: 'users',
                query: 'SELECT * FROM users WHERE id = {{id}}',
            },
            { id: 42 },
            errCtx,
        );
        expect(result.operation).toBe('select');
        expect(result.table).toBe('users');
        expect(result.query).toBe('SELECT * FROM users WHERE id = 42');
        expect(result.message).toMatch(/connection configuration/);
    });

    it('resolves templates inside the data payload via JSON round-trip', async () => {
        const result = await exec.execute(
            {
                operation: 'insert',
                table: 'events',
                data: { user: '{{user}}', action: 'login' },
            },
            { user: 'alice' },
            errCtx,
        );
        expect(result.data).toEqual({ user: 'alice', action: 'login' });
    });

    it('returns data: null when no data payload is provided', async () => {
        const result = await exec.execute(
            { operation: 'select', table: 't' },
            {},
            errCtx,
        );
        expect(result.data).toBeNull();
    });
});
