import jexl from 'jexl';
import { ExecutionInput } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

export interface ThresholdNodeConfig {
    valuePath?: string;            // JEXL expression or path to get the value (e.g., "cpu" or "metrics.memory")
    operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'outside';
    threshold?: number;            // Single threshold for gt, gte, lt, lte, eq, neq
    thresholdMin?: number;         // Min threshold for between/outside
    thresholdMax?: number;         // Max threshold for between/outside
    outputOnMatch?: 'continue' | 'branch_true' | 'branch_false';
}

export interface ThresholdResult extends ExecutionInput {
    thresholdMet: boolean;
    actualValue: number | null;
    threshold?: number;
    operator: string;
    comparison: string;
}

export class ThresholdNodeExecutor {
    async execute(config: ThresholdNodeConfig, input: ExecutionInput): Promise<ThresholdResult> {
        const {
            valuePath,
            operator = 'gt',
            threshold,
            thresholdMin,
            thresholdMax,
            outputOnMatch = 'continue'
        } = config;

        if (!valuePath) {
            throw new NodeExecutionError({
                message: 'Value path is required for threshold evaluation',
                nodeId: '',
                nodeName: 'Threshold',
                nodeType: 'Threshold',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
            });
        }

        try {
            // Get the value using JEXL (allows complex paths like "data.metrics.cpu")
            const actualValue = await jexl.eval(valuePath, input);

            if (typeof actualValue !== 'number' || isNaN(actualValue)) {
                return {
                    ...input,
                    thresholdMet: false,
                    actualValue: null,
                    threshold,
                    operator,
                    comparison: `Value at "${valuePath}" is not a valid number`,
                };
            }

            let thresholdMet = false;
            let comparison = '';

            switch (operator) {
                case 'gt':
                    if (threshold === undefined) throw new Error('Threshold value required for gt operator');
                    thresholdMet = actualValue > threshold;
                    comparison = `${actualValue} > ${threshold}`;
                    break;

                case 'gte':
                    if (threshold === undefined) throw new Error('Threshold value required for gte operator');
                    thresholdMet = actualValue >= threshold;
                    comparison = `${actualValue} >= ${threshold}`;
                    break;

                case 'lt':
                    if (threshold === undefined) throw new Error('Threshold value required for lt operator');
                    thresholdMet = actualValue < threshold;
                    comparison = `${actualValue} < ${threshold}`;
                    break;

                case 'lte':
                    if (threshold === undefined) throw new Error('Threshold value required for lte operator');
                    thresholdMet = actualValue <= threshold;
                    comparison = `${actualValue} <= ${threshold}`;
                    break;

                case 'eq':
                    if (threshold === undefined) throw new Error('Threshold value required for eq operator');
                    thresholdMet = actualValue === threshold;
                    comparison = `${actualValue} === ${threshold}`;
                    break;

                case 'neq':
                    if (threshold === undefined) throw new Error('Threshold value required for neq operator');
                    thresholdMet = actualValue !== threshold;
                    comparison = `${actualValue} !== ${threshold}`;
                    break;

                case 'between':
                    if (thresholdMin === undefined || thresholdMax === undefined) {
                        throw new Error('Min and max thresholds required for between operator');
                    }
                    thresholdMet = actualValue >= thresholdMin && actualValue <= thresholdMax;
                    comparison = `${thresholdMin} <= ${actualValue} <= ${thresholdMax}`;
                    break;

                case 'outside':
                    if (thresholdMin === undefined || thresholdMax === undefined) {
                        throw new Error('Min and max thresholds required for outside operator');
                    }
                    thresholdMet = actualValue < thresholdMin || actualValue > thresholdMax;
                    comparison = `${actualValue} < ${thresholdMin} OR ${actualValue} > ${thresholdMax}`;
                    break;

                default:
                    throw new Error(`Unknown operator: ${operator}`);
            }

            return {
                ...input,
                thresholdMet,
                actualValue,
                threshold: threshold ?? thresholdMin,
                operator,
                comparison: `${comparison} = ${thresholdMet}`,
            };
        } catch (error) {
            throw new NodeExecutionError({
                message: `Threshold evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '',
                nodeName: 'Threshold',
                nodeType: 'Threshold',
                code: ErrorCode.CONDITION_EVALUATION_FAILED,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }
}
