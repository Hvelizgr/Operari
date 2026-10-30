import type { ExecutionInput, LoopNodeConfig, LoopResult } from '../../types/runbook.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { getNestedValue, resolveTemplate } from './_shared';

/**
 * Loop node — resolves an items array, either inline (`config.items`)
 * or by reading a path on the input (`config.itemsPath`), and reports
 * count + items downstream. Iteration itself is the runtime's job;
 * this node only normalizes the source.
 *
 * Behavior preserved exactly from the legacy `executeLoop` method.
 */
// The editor form stores `items` as text: either `{{path.to.array}}` or a
// JSON array literal.
function resolveItems(expression: string, input: ExecutionInput): unknown {
  const whole = /^\s*\{\{([^}]+)\}\}\s*$/.exec(expression);
  if (whole) return getNestedValue(input, whole[1].trim());
  try {
    return JSON.parse(resolveTemplate(expression, input));
  } catch {
    return [];
  }
}

export class LoopNodeExecutor implements EditorNodeExecutor<LoopNodeConfig, LoopResult> {
  readonly type = 'Loop';
  readonly aliases = ['Iterator', 'operari.loop'] as const;

  async execute(
    config: LoopNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<LoopResult> {
    const { items, itemsPath } = config;
    const loopItems = itemsPath
      ? getNestedValue(input, itemsPath)
      : typeof items === 'string'
        ? resolveItems(items, input)
        : items || [];
    return {
      items: Array.isArray(loopItems) ? loopItems : [],
      count: Array.isArray(loopItems) ? loopItems.length : 0,
    };
  }
}
