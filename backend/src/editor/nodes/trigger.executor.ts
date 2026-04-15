import type { ExecutionInput, TriggerResult } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';

/**
 * Trigger node — entry point of an execution. Stamps the input with
 * `triggered: true` and an ISO timestamp and forwards it.
 *
 * Used for the `Webhook`, `Trigger`, and `Schedule` node types in the
 * editor; they all behave identically at execution time (the difference
 * is in how the run was started, which the runtime already knows).
 */
export class TriggerNodeExecutor
    implements EditorNodeExecutor<Record<string, unknown>, TriggerResult> {
    readonly type = 'Trigger';
    readonly aliases = [
        'Webhook',
        'Schedule',
        'nanorun.webhook',
        'nanorun.cron',
    ] as const;

    async execute(
        _config: Record<string, unknown>,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<TriggerResult> {
        return { ...input, triggered: true, timestamp: new Date().toISOString() };
    }
}
