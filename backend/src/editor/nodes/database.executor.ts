import { ErrorCode, NodeExecutionError } from '../../errors/custom-error';
import type {
  DatabaseNodeConfig,
  DatabaseResult,
  ExecutionInput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { resolveTemplate } from './_shared';

/**
 * Database step — runbook-scoped passthrough stub.
 *
 * Operari narrows the database node to the operations a runbook
 * author legitimately needs:
 *
 *   - migrate  — apply a versioned schema migration (DDL)
 *   - health   — read-only sanity probe
 *   - backup   — issue a snapshot/backup command
 *
 * Arbitrary DML (insert/update/delete) against user tables is NOT
 * supported on purpose: the security model is "if you need to mutate
 * rows, do it from a shell step that runs your migration tool". This
 * removes a foot-gun where a runbook could `DELETE FROM users` by
 * accident or in response to a malicious template injection.
 *
 * The executor is still a stub (it does not actually run the query);
 * it returns the resolved config so downstream steps can pick up the
 * intent. Real DB connectivity will be wired in a follow-up that
 * injects prisma + a per-tenant connection registry through
 * NodeExecutorDeps.
 */
const ALLOWED_OPERATIONS = new Set(['migrate', 'health', 'backup']);

export class DatabaseNodeExecutor implements EditorNodeExecutor<
  DatabaseNodeConfig,
  DatabaseResult
> {
  readonly type = 'Database';
  readonly aliases = ['operari.postgres'] as const;

  async execute(
    config: DatabaseNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext
  ): Promise<DatabaseResult> {
    const { operation, table, query, data } = config;

    if (operation && !ALLOWED_OPERATIONS.has(operation)) {
      throw new NodeExecutionError({
        ...errorContext,
        message:
          `Database operation "${operation}" is not allowed in a runbook step. ` +
          `Use one of: ${[...ALLOWED_OPERATIONS].join(', ')}, or run it from a shell step.`,
        code: ErrorCode.NODE_EXECUTION_FAILED,
        userMessage:
          'This database operation is blocked. Runbooks can only run migrations, ' +
          'health checks, or backups; arbitrary DML belongs in a shell step.',
      });
    }

    return {
      operation,
      table,
      query: resolveTemplate(query || '', input),
      data: data ? JSON.parse(resolveTemplate(JSON.stringify(data), input)) : null,
      message: 'Database step is a stub — wire prisma in NodeExecutorDeps to make it active',
    };
  }
}
