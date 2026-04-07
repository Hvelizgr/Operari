import type { DelayNodeConfig, DelayResult, ExecutionInput } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';

/**
 * Delay node — sleeps for `config.duration` ms, defaults to 1s.
 *
 * Pure-logic, no deps. Behavior preserved exactly from the legacy
 * `executeDelay` method in node-executor.service.ts.
 */
export class DelayNodeExecutor implements EditorNodeExecutor<DelayNodeConfig, DelayResult> {
    readonly type = 'Delay';
    readonly aliases = ['Wait'] as const;

    async execute(
        config: DelayNodeConfig,
        _input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<DelayResult> {
        const { duration = 1000 } = config;
        await new Promise<void>((resolve) => setTimeout(resolve, duration));
        return { delayed: true, duration };
    }
}
