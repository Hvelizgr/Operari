import type {
    TransformNodeConfig,
    ExecutionInput,
    ExecutionOutput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext, NodeExecutorDeps } from './_shared';
import { resolveTemplate } from './_shared';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

/**
 * Transform node — applies a static key→template mapping against the
 * input. The previous `config.code` path executed user JavaScript inside
 * an isolated-vm sandbox; that path was removed in the post-pivot
 * cleanup because in-process sandboxing conflicts with the runner-first
 * sandboxing strategy (ADR 0001 / P0 #1). Authors who need arbitrary
 * code transforms should use a `shell` step that runs in a runner.
 *
 *   1. If `config.mapping` is set, resolve every value as a
 *      `{{template}}` against the input and return the new object.
 *   2. Otherwise pass the input through unchanged.
 */
export class TransformNodeExecutor
    implements EditorNodeExecutor<TransformNodeConfig, ExecutionOutput> {
    readonly type = 'Transform';

    // Reserved for future logging needs (e.g. mapping diagnostics).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(private readonly _deps: Pick<NodeExecutorDeps, 'logger'>) { }

    async execute(
        config: TransformNodeConfig,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<ExecutionOutput> {
        const { mapping } = config;

        if (mapping) {
            try {
                const result: ExecutionOutput = {};
                for (const [key, value] of Object.entries(mapping)) {
                    result[key] = resolveTemplate(value, input);
                }
                return result;
            } catch (error) {
                throw new NodeExecutionError({
                    message: `Failed to map transformation: ${error instanceof Error ? error.message : String(error)}`,
                    nodeId: '',
                    nodeName: 'Transform',
                    nodeType: 'Transform',
                    code: ErrorCode.NODE_EXECUTION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                });
            }
        }

        return input;
    }
}
