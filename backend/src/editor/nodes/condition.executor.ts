import type {
  ConditionNodeConfig,
  ConditionResult,
  ExecutionInput,
} from '../../types/runbook.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { getNestedValue, resolveTemplate } from './_shared';

/**
 * Condition node — declarative `field operator value` evaluation.
 *
 * The previous `config.condition` path evaluated arbitrary JavaScript
 * inside the isolated-vm sandbox. That path was removed in the
 * post-pivot cleanup (the in-process sandbox conflicts with the
 * runner-first strategy from P0 #1). For runbook-level conditional
 * gating use `runIf` / `skipIf` on the step (R3.3); for in-step
 * branching use this declarative form.
 *
 * Operators: equals, notEquals, contains, greaterThan, lessThan,
 * isEmpty, isNotEmpty. equals/notEquals use loose equality (`==`/`!=`)
 * — preserved on purpose; tightening it would change behavior for
 * existing runbooks that compare "1" to 1.
 */
const FALSY_STRINGS = new Set(['', 'false', '0', 'no', 'null', 'undefined']);

// A bare `{{path}}` keeps the raw value (so `0` or an empty array stay
// falsy); anything else is rendered as text.
function evaluateExpression(expression: string, input: ExecutionInput): unknown {
  const whole = /^\s*\{\{([^}]+)\}\}\s*$/.exec(expression);
  if (whole) return getNestedValue(input, whole[1].trim());
  return resolveTemplate(expression, input);
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return !FALSY_STRINGS.has(value.trim().toLowerCase());
  return Boolean(value);
}

export class ConditionNodeExecutor implements EditorNodeExecutor<
  ConditionNodeConfig,
  ConditionResult
> {
  readonly type = 'Condition';
  readonly aliases = ['If', 'operari.if'] as const;

  async execute(
    config: ConditionNodeConfig,
    input: ExecutionInput,
    _errorContext: NodeErrorContext
  ): Promise<ConditionResult> {
    const { field, operator, value, condition } = config;
    let result = false;

    if (!operator && typeof condition === 'string' && condition.trim()) {
      result = isTruthy(evaluateExpression(condition, input));
    } else if (field && operator) {
      const fieldValue = getNestedValue(input, field);
      const compareValue = value ? resolveTemplate(value, input) : '';

      switch (operator) {
        case 'equals':
          result = fieldValue == compareValue;
          break;
        case 'notEquals':
          result = fieldValue != compareValue;
          break;
        case 'contains':
          result = String(fieldValue).includes(compareValue);
          break;
        case 'greaterThan':
          result = Number(fieldValue) > Number(compareValue);
          break;
        case 'lessThan':
          result = Number(fieldValue) < Number(compareValue);
          break;
        case 'isEmpty':
          result = !fieldValue || fieldValue === '';
          break;
        case 'isNotEmpty':
          result = !!fieldValue && fieldValue !== '';
          break;
      }
    }

    return { ...input, conditionResult: result };
  }
}
