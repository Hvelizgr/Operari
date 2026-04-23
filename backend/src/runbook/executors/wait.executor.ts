import { ExecutorContext, ExecutorResult, StepExecutor } from '../types/executor.types';

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

    // Dry-run: no wall-clock delay. A dry run of a 10-step runbook
    // with three 30s waits should finish in under a second, not
    // 90 seconds of staring at a spinner.
    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would wait ${duration}ms`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: { dryRun: true, waitedMs: 0, wouldWaitMs: duration },
        duration: 0,
      };
    }

    context.emit?.({
      type: 'log',
      text: `Waiting ${duration}ms...`,
      timestamp: new Date(),
    });

    await new Promise(resolve => setTimeout(resolve, duration));

    return {
      success: true,
      output: { waitedMs: duration },
      duration: Date.now() - startTime,
    };
  }
}

export const waitExecutor = new WaitExecutor();
