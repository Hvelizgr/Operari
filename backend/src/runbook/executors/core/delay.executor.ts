import type { DelayNodeConfig, DelayResult, ExecutionInput } from '../../../types/runbook.types';
import { FlatInputStep } from './_flat-input';
import type { NodeErrorContext } from './_shared';

/**
 * Delay node — sleeps for `config.duration` ms, defaults to 1s.
 *
 * Pure-logic, no deps. Behavior preserved exactly from the legacy
 * `executeDelay` method in node-executor.service.ts.
 */
export class DelayNodeExecutor extends FlatInputStep<DelayNodeConfig> {
  readonly type = 'Delay';
  readonly aliases = ['Wait'] as const;

  async run(
    config: DelayNodeConfig,
    _input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<DelayResult> {
    const { duration = 1000 } = config;
    await new Promise<void>(resolve => setTimeout(resolve, duration));
    return { delayed: true, duration };
  }
}
