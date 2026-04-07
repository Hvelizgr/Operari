import { ConditionNodeExecutor } from '../../../editor/nodes/condition.executor';
import { NodeExecutionError, ErrorCode } from '../../../errors/custom-error';

const buildDeps = () => ({
    sandbox: {
        execute: jest.fn(),
        evaluateCondition: jest.fn(),
    },
});

const errCtx = { nodeId: 'n', nodeName: 'Condition', nodeType: 'Condition' };

describe('ConditionNodeExecutor', () => {
    it('exposes type=Condition and If alias', () => {
        const exec = new ConditionNodeExecutor(buildDeps());
        expect(exec.type).toBe('Condition');
        expect(exec.aliases).toEqual(['If']);
    });

    it('uses the sandbox when a JS condition is provided', async () => {
        const deps = buildDeps();
        deps.sandbox.evaluateCondition.mockResolvedValue(true);
        const exec = new ConditionNodeExecutor(deps);

        const result = await exec.execute(
            { condition: 'input.value > 10' },
            { value: 42 },
            errCtx,
        );

        expect(result.conditionResult).toBe(true);
        expect(deps.sandbox.evaluateCondition).toHaveBeenCalledWith(
            'input.value > 10',
            { value: 42 },
        );
    });

    it('wraps sandbox failures into NodeExecutionError with CONDITION_EVALUATION_FAILED', async () => {
        const deps = buildDeps();
        deps.sandbox.evaluateCondition.mockRejectedValue(new Error('parse error'));
        const exec = new ConditionNodeExecutor(deps);
        try {
            await exec.execute({ condition: '%%' }, {}, errCtx);
            fail('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(NodeExecutionError);
            expect((err as NodeExecutionError).code).toBe(ErrorCode.CONDITION_EVALUATION_FAILED);
        }
    });

    describe('declarative operators', () => {
        const run = async (config: Record<string, unknown>, input: Record<string, unknown>) => {
            const exec = new ConditionNodeExecutor(buildDeps());
            return (await exec.execute(config as never, input, errCtx)).conditionResult;
        };

        it('equals (loose) is true for "5" == 5', async () => {
            expect(await run({ field: 'x', operator: 'equals', value: '5' }, { x: 5 })).toBe(true);
        });

        it('greaterThan compares numerically', async () => {
            expect(await run({ field: 'x', operator: 'greaterThan', value: '10' }, { x: 11 })).toBe(true);
            expect(await run({ field: 'x', operator: 'greaterThan', value: '10' }, { x: 9 })).toBe(false);
        });

        it('contains uses string includes', async () => {
            expect(await run({ field: 'msg', operator: 'contains', value: 'world' }, { msg: 'hello world' })).toBe(true);
        });

        it('isEmpty / isNotEmpty handle missing fields', async () => {
            expect(await run({ field: 'x', operator: 'isEmpty' }, {})).toBe(true);
            expect(await run({ field: 'x', operator: 'isNotEmpty' }, { x: 'a' })).toBe(true);
        });

        it('returns false when no condition or operator is set', async () => {
            expect(await run({}, { anything: 1 })).toBe(false);
        });
    });
});
