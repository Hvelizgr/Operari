import {
    StepExecutor,
    ExecutorContext,
    ExecutorResult,
} from '../types/executor.types';

export interface WaitConfig {
    /** Wait duration in milliseconds */
    durationMs: number;
}

/**
 * Wait executor — pauses for a fixed duration.
 *
 * Useful between deploy steps (e.g. wait 30s for pods to settle before
 * running smoke tests) or when polling external systems.
 */
export class WaitExecutor implements StepExecutor<WaitConfig> {
    readonly type = 'wait';

    async execute(config: WaitConfig, context: ExecutorContext): Promise<ExecutorResult> {
        const startTime = Date.now();
        const duration = Math.max(0, Math.min(config.durationMs ?? 1000, 600_000));

        context.emit?.({
            type: 'log',
            text: `Waiting ${duration}ms...`,
            timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, duration));

        return {
            success: true,
            output: { waitedMs: duration },
            duration: Date.now() - startTime,
        };
    }
}

export const waitExecutor = new WaitExecutor();
