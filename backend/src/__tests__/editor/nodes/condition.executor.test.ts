import { ConditionNodeExecutor } from '../../../editor/nodes/condition.executor';

const errCtx = { nodeId: 'n', nodeName: 'Condition', nodeType: 'Condition' };

describe('ConditionNodeExecutor', () => {
  it('exposes type=Condition and If alias', () => {
    const exec = new ConditionNodeExecutor();
    expect(exec.type).toBe('Condition');
    expect(exec.aliases).toEqual(['If', 'nanorun.if']);
  });

  describe('declarative operators', () => {
    const run = async (config: Record<string, unknown>, input: Record<string, unknown>) => {
      const exec = new ConditionNodeExecutor();
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
      expect(
        await run({ field: 'msg', operator: 'contains', value: 'world' }, { msg: 'hello world' })
      ).toBe(true);
    });

    it('isEmpty / isNotEmpty handle missing fields', async () => {
      expect(await run({ field: 'x', operator: 'isEmpty' }, {})).toBe(true);
      expect(await run({ field: 'x', operator: 'isNotEmpty' }, { x: 'a' })).toBe(true);
    });

    it('returns false when no operator is set', async () => {
      expect(await run({}, { anything: 1 })).toBe(false);
    });
  });
});
