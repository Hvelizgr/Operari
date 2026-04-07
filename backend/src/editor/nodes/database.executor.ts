import type {
    DatabaseNodeConfig,
    DatabaseResult,
    ExecutionInput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { resolveTemplate } from './_shared';

/**
 * Database node — currently a passthrough stub.
 *
 * The legacy `executeDatabase` method does NOT actually run a SQL
 * query; it only resolves templates and echoes the configuration with
 * a "requires connection configuration" message. We preserve that
 * behavior exactly so the editor flow keeps working until a real
 * database executor is wired (tracked separately).
 *
 * The fact that this is a stub is the reason it lives in the IO step
 * of the refactor (ADR 0002 step 3) rather than the pure-logic step
 * — once it grows real prisma/raw query support, it will need
 * `prisma` from `NodeExecutorDeps`.
 */
export class DatabaseNodeExecutor
    implements EditorNodeExecutor<DatabaseNodeConfig, DatabaseResult> {
    readonly type = 'Database';
    readonly aliases = ['SQL'] as const;

    async execute(
        config: DatabaseNodeConfig,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<DatabaseResult> {
        const { operation, table, query, data } = config;

        return {
            operation,
            table,
            query: resolveTemplate(query || '', input),
            data: data
                ? JSON.parse(resolveTemplate(JSON.stringify(data), input))
                : null,
            message: 'Database operations require connection configuration',
        };
    }
}
