import { DatabaseNodeExecutor } from '../../../editor/nodes/database.executor';
import { NodeExecutionError } from '../../../errors/custom-error';

const errCtx = { nodeId: 'n', nodeName: 'Database', nodeType: 'Database' };

describe('DatabaseNodeExecutor (runbook-scoped stub)', () => {
  const exec = new DatabaseNodeExecutor();

  it('exposes type=Database', () => {
    expect(exec.type).toBe('Database');
  });

  it('echoes operation/table and resolves the query template for migrate ops', async () => {
    const result = await exec.execute(
      {
        operation: 'migrate',
        table: 'users',
        query: 'ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP -- {{tag}}',
      },
      { tag: 'v42' },
      errCtx
    );
    expect(result.operation).toBe('migrate');
    expect(result.table).toBe('users');
    expect(result.query).toContain('-- v42');
    expect(result.message).toMatch(/stub/);
  });

  it('allows the health probe operation', async () => {
    const result = await exec.execute({ operation: 'health', query: 'SELECT 1' }, {}, errCtx);
    expect(result.operation).toBe('health');
  });

  it('allows the backup operation', async () => {
    const result = await exec.execute({ operation: 'backup' }, {}, errCtx);
    expect(result.operation).toBe('backup');
  });

  it('rejects legacy DML operations to prevent footguns', async () => {
    // Cast through `unknown` because the type now refuses legacy values
    // at compile time — we still want a runtime check for clients that
    // hand-roll JSON config.
    await expect(
      exec.execute({ operation: 'delete', table: 'users' } as unknown as never, {}, errCtx)
    ).rejects.toBeInstanceOf(NodeExecutionError);
  });

  it('returns data: null when no data payload is provided', async () => {
    const result = await exec.execute({ operation: 'health' }, {}, errCtx);
    expect(result.data).toBeNull();
  });
});
