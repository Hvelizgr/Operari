import type {
    TransformNodeConfig,
    ExecutionInput,
    ExecutionOutput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext, NodeExecutorDeps } from './_shared';
import { resolveTemplate } from './_shared';
import { SandboxError, NodeExecutionError, ErrorCode } from '../../errors/custom-error';

/**
 * Transform node — runs user code in the JS sandbox or applies a static
 * key→template mapping. Behavior preserved exactly from the legacy
 * `executeTransform` method:
 *   1. If `config.code` is set, run it through the sandbox and rethrow
 *      sandbox failures as `SandboxError`.
 *   2. Else if `config.mapping` is set, resolve every value as a
 *      `{{template}}` against the input and return the new object.
 *   3. Otherwise pass the input through unchanged.
 */
export class TransformNodeExecutor
    implements EditorNodeExecutor<TransformNodeConfig, ExecutionOutput> {
    readonly type = 'Transform';
    readonly aliases = ['Code'] as const;

    constructor(private readonly deps: Pick<NodeExecutorDeps, 'sandbox' | 'logger'>) { }

    async execute(
        config: TransformNodeConfig,
        input: ExecutionInput,
        errorContext: NodeErrorContext,
    ): Promise<ExecutionOutput> {
        const { code, mapping } = config;

        if (code) {
            try {
                const result = await this.deps.sandbox.execute(code, input);

                if (result && typeof result === 'object' && 'error' in result) {
                    throw new SandboxError({
                        ...errorContext,
                        message: `Sandbox execution error: ${(result as { error: string }).error}`,
                        code: ErrorCode.SANDBOX_EXECUTION_FAILED,
                        userMessage: 'Code execution failed',
                    });
                }

                return result as ExecutionOutput;
            } catch (error) {
                if (error instanceof SandboxError) {
                    throw error;
                }

                const sandboxError = new SandboxError({
                    message: error instanceof Error ? error.message : 'Unknown sandbox error',
                    code: ErrorCode.SANDBOX_EXECUTION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                    userMessage: 'Failed to execute transformation code',
                });

                this.deps.logger.error('Transform node execution failed', {
                    error: sandboxError,
                });

                throw sandboxError;
            }
        }

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
