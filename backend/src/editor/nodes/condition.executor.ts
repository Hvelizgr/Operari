import type {
    ConditionNodeConfig,
    ConditionResult,
    ExecutionInput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { resolveTemplate, getNestedValue } from './_shared';

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
export class ConditionNodeExecutor
    implements EditorNodeExecutor<ConditionNodeConfig, ConditionResult> {
    readonly type = 'Condition';
    readonly aliases = ['If', 'nanorun.if'] as const;

    async execute(
        config: ConditionNodeConfig,
        input: ExecutionInput,
        _errorContext: NodeErrorContext,
    ): Promise<ConditionResult> {
        const { field, operator, value } = config;
        let result = false;

        if (field && operator) {
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
