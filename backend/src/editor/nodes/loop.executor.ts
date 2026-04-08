import type {
    LoopNodeConfig,
    LoopResult,
    ExecutionInput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { getNestedValue } from './_shared';

/**
 * Loop node — resolves an items array, either inline (`config.items`)
 * or by reading a path on the input (`config.itemsPath`), and reports
 * count + items downstream. Iteration itself is the runtime's job;
 * this node only normalizes the source.
 *
 * Behavior preserved exactly from the legacy `executeLoop` method.
 */
export class LoopNodeExecutor
    implements EditorNodeExecutor<LoopNodeConfig, LoopResult> {
    readonly type = 'Loop';
    readonly aliases = ['Iterator', 'nanorun.loop'] as const;

    async execute(
        config: LoopNodeConfig,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<LoopResult> {
        const { items, itemsPath } = config;
        const loopItems = itemsPath ? getNestedValue(input, itemsPath) : items || [];
        return {
            items: Array.isArray(loopItems) ? loopItems : [],
            count: Array.isArray(loopItems) ? loopItems.length : 0,
        };
    }
}
