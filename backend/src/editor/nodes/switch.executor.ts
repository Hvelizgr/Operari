import type { ExecutionInput, SwitchNodeConfig, SwitchResult } from '../../types/runbook.types';
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
// The editor form stores cases as JSON text; accept plain values or
// `{ value, label }` objects in it.
function parseCases(raw: unknown): Array<{ value: string; label?: string }> {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = raw.trim() ? JSON.parse(raw) : [];
    } catch {
      list = raw
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map(c =>
    c && typeof c === 'object'
      ? {
          value: String((c as { value?: unknown }).value ?? ''),
          label: (c as { label?: string }).label,
        }
      : { value: String(c) }
  );
}

export class SwitchNodeExecutor implements EditorNodeExecutor<SwitchNodeConfig, SwitchResult> {
  readonly type = 'Switch';
  readonly aliases = ['operari.switch'] as const;

  async execute(
    config: SwitchNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<SwitchResult> {
    const { field } = config;
    const cases = parseCases(config.cases);

    if (!field) {
      return { ...input, switchValue: undefined, matchedCase: -1, matchedLabel: null };
    }

    const fieldValue = getNestedValue(input, field.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, ''));
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
