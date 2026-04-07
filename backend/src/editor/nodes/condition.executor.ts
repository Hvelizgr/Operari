import type {
    ConditionNodeConfig,
    ConditionResult,
    ExecutionInput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext, NodeExecutorDeps } from './_shared';
import { resolveTemplate, getNestedValue } from './_shared';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

/**
 * Condition node — evaluates either a JS condition (sandbox) or a
 * declarative `field operator value` triple. Behavior preserved exactly
 * from the legacy `executeCondition` method.
 *
 * Operators (declarative path): equals, notEquals, contains, greaterThan,
 * lessThan, isEmpty, isNotEmpty. The original switch used loose equality
 * (`==`/`!=`) for equals/notEquals — preserved on purpose; tightening it
 * would change behavior for existing runbooks that compare "1" to 1.
 */
export class ConditionNodeExecutor
    implements EditorNodeExecutor<ConditionNodeConfig, ConditionResult> {
    readonly type = 'Condition';
    readonly aliases = ['If'] as const;

    constructor(private readonly deps: Pick<NodeExecutorDeps, 'sandbox'>) { }

    async execute(
        config: ConditionNodeConfig,
        input: ExecutionInput,
        errorContext: NodeErrorContext,
    ): Promise<ConditionResult> {
        const { condition, field, operator, value } = config;
        let result = false;

        if (condition) {
            try {
                result = await this.deps.sandbox.evaluateCondition(condition, input);
            } catch (error) {
                throw new NodeExecutionError({
                    ...errorContext,
                    message: `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
                    code: ErrorCode.CONDITION_EVALUATION_FAILED,
                    cause: error instanceof Error ? error : undefined,
                });
            }
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
