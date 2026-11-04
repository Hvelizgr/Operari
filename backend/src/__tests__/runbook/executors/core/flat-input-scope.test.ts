import { ConditionNodeExecutor } from '../../../../runbook/executors/core/condition.executor';

describe('FlatInputStep output', () => {
  it('passes the parents output through but not the run scope copies', async () => {
    const parents = { env: 'prod', hosts: ['a'] };
    const steps = { set: { output: parents } };
    const previousOutputs = { ...steps, ...parents, vars: { region: 'eu' }, steps };
    const res = await new ConditionNodeExecutor().execute({ condition: '{{env}}' } as never, {
      runId: 'r',
      stepId: 'if',
      tenantId: 't',
      variables: { region: 'eu' },
      previousOutputs,
      input: parents,
    });
    expect(res.output).toEqual({ env: 'prod', hosts: ['a'], conditionResult: true });
  });

  it('keeps a parent key even when it shares a name with a scope key', async () => {
    const parents = { vars: 'from parent' };
    const res = await new ConditionNodeExecutor().execute({ condition: 'x' } as never, {
      runId: 'r',
      stepId: 'if',
      tenantId: 't',
      variables: {},
      previousOutputs: { ...parents, steps: {} },
      input: parents,
    });
    expect(res.output).toMatchObject({ vars: 'from parent' });
    expect(res.output).not.toHaveProperty('steps');
  });
});
