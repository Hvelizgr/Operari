import type { ExecutionInput, SwitchNodeConfig, SwitchResult } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { getNestedValue, resolveTemplate } from './_shared';

/**
 * Switch node — multi-way conditional that matches a field value against
 * an ordered list of cases.
 *
 * The matched case index maps to `sourcePort` on outgoing connections.
 * If no case matches, `matchedCase` is -1 (the DAG walker treats
 * connections without sourcePort as the default branch).
 */
export class SwitchNodeExecutor implements EditorNodeExecutor<SwitchNodeConfig, SwitchResult> {
  readonly type = 'Switch';
  readonly aliases = ['nanorun.switch'] as const;

  async execute(
    config: SwitchNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<SwitchResult> {
    const { field, cases = [] } = config;

    if (!field) {
      return { ...input, switchValue: undefined, matchedCase: -1, matchedLabel: null };
    }

    const fieldValue = getNestedValue(input, field);
    const fieldStr = fieldValue !== undefined ? String(fieldValue) : '';

    for (let i = 0; i < cases.length; i++) {
      const caseValue = resolveTemplate(cases[i].value, input);
      // Loose comparison to match "1" == 1 (same as Condition executor)
      if (fieldStr == caseValue) {
        return {
          ...input,
          switchValue: fieldValue,
          matchedCase: i,
          matchedLabel: cases[i].label ?? null,
        };
      }
    }

    return { ...input, switchValue: fieldValue, matchedCase: -1, matchedLabel: null };
  }
}
