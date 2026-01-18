import jexl from 'jexl';
import { ExecutionInput } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

export interface CompareNodeConfig {
    leftValue?: string;            // JEXL expression for left operand
    rightValue?: string;           // JEXL expression for right operand
    operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'matches';
    caseSensitive?: boolean;       // For string comparisons
    outputField?: string;          // Field name to store result (default: 'comparisonResult')
}

export interface CompareResult extends ExecutionInput {
    comparisonResult: boolean;
    leftResolved: any;
    rightResolved: any;
    operator: string;
    comparison: string;
}

export class CompareNodeExecutor {
    async execute(config: CompareNodeConfig, input: ExecutionInput): Promise<CompareResult> {
        const {
            leftValue,
            rightValue,
            operator = 'eq',
            caseSensitive = true,
            outputField = 'comparisonResult'
        } = config;

        if (!leftValue || !rightValue) {
            throw new NodeExecutionError({
                message: 'Both left and right values are required for comparison',
                nodeId: '',
                nodeName: 'Compare',
                nodeType: 'Compare',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
            });
        }

        try {
            // Resolve both values using JEXL
            const leftResolved = await jexl.eval(leftValue, input);
            const rightResolved = await jexl.eval(rightValue, input);

            let comparisonResult = false;
            let comparison = '';

            // Helper for case-insensitive string comparison
            const normalizeString = (val: any): string => {
                const str = String(val);
                return caseSensitive ? str : str.toLowerCase();
            };

            switch (operator) {
                case 'eq':
                    if (typeof leftResolved === 'string' && typeof rightResolved === 'string') {
                        comparisonResult = normalizeString(leftResolved) === normalizeString(rightResolved);
                    } else {
                        comparisonResult = leftResolved === rightResolved;
                    }
                    comparison = `${JSON.stringify(leftResolved)} === ${JSON.stringify(rightResolved)}`;
                    break;

                case 'neq':
                    if (typeof leftResolved === 'string' && typeof rightResolved === 'string') {
                        comparisonResult = normalizeString(leftResolved) !== normalizeString(rightResolved);
                    } else {
                        comparisonResult = leftResolved !== rightResolved;
                    }
                    comparison = `${JSON.stringify(leftResolved)} !== ${JSON.stringify(rightResolved)}`;
                    break;

                case 'gt':
                    comparisonResult = leftResolved > rightResolved;
                    comparison = `${leftResolved} > ${rightResolved}`;
                    break;

                case 'gte':
                    comparisonResult = leftResolved >= rightResolved;
                    comparison = `${leftResolved} >= ${rightResolved}`;
                    break;

                case 'lt':
                    comparisonResult = leftResolved < rightResolved;
                    comparison = `${leftResolved} < ${rightResolved}`;
                    break;

                case 'lte':
                    comparisonResult = leftResolved <= rightResolved;
                    comparison = `${leftResolved} <= ${rightResolved}`;
                    break;

                case 'contains':
                    comparisonResult = normalizeString(leftResolved).includes(normalizeString(rightResolved));
                    comparison = `"${leftResolved}" contains "${rightResolved}"`;
                    break;

                case 'startsWith':
                    comparisonResult = normalizeString(leftResolved).startsWith(normalizeString(rightResolved));
                    comparison = `"${leftResolved}" startsWith "${rightResolved}"`;
                    break;

                case 'endsWith':
                    comparisonResult = normalizeString(leftResolved).endsWith(normalizeString(rightResolved));
                    comparison = `"${leftResolved}" endsWith "${rightResolved}"`;
                    break;

                case 'matches':
                    try {
                        const regex = new RegExp(String(rightResolved), caseSensitive ? '' : 'i');
                        comparisonResult = regex.test(String(leftResolved));
                        comparison = `"${leftResolved}" matches /${rightResolved}/${caseSensitive ? '' : 'i'}`;
                    } catch (e) {
                        throw new Error(`Invalid regex pattern: ${rightResolved}`);
                    }
                    break;

                default:
                    throw new Error(`Unknown comparison operator: ${operator}`);
            }

            const result: CompareResult = {
                ...input,
                comparisonResult,
                leftResolved,
                rightResolved,
                operator,
                comparison: `${comparison} = ${comparisonResult}`,
            };

            // Also set the custom output field if different
            if (outputField !== 'comparisonResult') {
                (result as any)[outputField] = comparisonResult;
            }

            return result;
        } catch (error) {
            throw new NodeExecutionError({
                message: `Comparison failed: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '',
                nodeName: 'Compare',
                nodeType: 'Compare',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }
}
