import { NodeExecutor } from '../../../editor/node-executor.service';
import { ConditionNodeExecutor } from '../../../editor/nodes/condition.executor';
import { LoopNodeExecutor } from '../../../editor/nodes/loop.executor';
import { SwitchNodeExecutor } from '../../../editor/nodes/switch.executor';
import { EmailExecutor } from '../../../runbook/executors/email.executor';
import { HttpExecutor } from '../../../runbook/executors/http.executor';
import { NotifyExecutor } from '../../../runbook/executors/notify.executor';
import { RunbookExecutor } from '../../../runbook/executors/runbook.executor';
import { SecretTemplateResolver } from '../../../runbook/secrets/secret-template-resolver';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

// Each case is a config exactly as the editor's DynamicNodeForm saves it
// for the seeded node: text fields stay strings, untouched selects are absent.

const errCtx = { nodeId: 'n', nodeName: 'n', nodeType: 'n' };

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
  ...over,
});

const okFetch = () =>
  jest.fn(async () => new Response('ok', { status: 200 })) as unknown as jest.Mock & typeof fetch;

describe('operari.if condition expression', () => {
  const exec = new ConditionNodeExecutor();

  it.each([
    ['{{exitCode}}', { exitCode: 0 }, false],
    ['{{exitCode}}', { exitCode: 2 }, true],
    ['{{status}}', { status: 'false' }, false],
    ['{{items}}', { items: [] }, false],
    ['{{missing}}', {}, false],
    ['deploy-{{env}}', { env: 'prod' }, true],
  ])('%s with %j → %s', async (condition, input, expected) => {
    const out = await exec.execute({ condition }, input, errCtx);
    expect(out.conditionResult).toBe(expected);
  });
});

describe('operari.switch cases stored as text', () => {
  const exec = new SwitchNodeExecutor();

  it('matches against a JSON array of plain values', async () => {
    const out = await exec.execute(
      { field: 'env', cases: '["staging", "prod"]' },
      { env: 'prod' },
      errCtx
    );
    expect(out.matchedCase).toBe(1);
  });

  it('accepts the field wrapped in {{ }}', async () => {
    const out = await exec.execute(
      { field: '{{env}}', cases: '[{"value": "staging", "label": "stg"}]' },
      { env: 'staging' },
      errCtx
    );
    expect(out.matchedCase).toBe(0);
    expect(out.matchedLabel).toBe('stg');
  });
});

describe('operari.loop items stored as text', () => {
  const exec = new LoopNodeExecutor();

  it('reads an array from a {{path}}', async () => {
    const out = await exec.execute({ items: '{{hosts}}' }, { hosts: ['a', 'b'] }, errCtx);
    expect(out).toEqual({ items: ['a', 'b'], count: 2 });
  });

  it('parses a JSON array literal', async () => {
    const out = await exec.execute({ items: '[1, 2, 3]' }, {}, errCtx);
    expect(out.count).toBe(3);
  });
});

describe('notify with the preselected channel left untouched', () => {
  it('sends the Slack payload shape', async () => {
    const fetchMock = okFetch();
    const res = await new NotifyExecutor(fetchMock).execute(
      { webhookUrl: 'https://hooks.slack.com/services/x', message: 'hi' } as never,
      ctx()
    );
    expect(res.success).toBe(true);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );
    expect(body).toEqual({ text: 'hi' });
  });
});

describe('http headers stored as JSON text', () => {
  it('sends them as headers', async () => {
    const fetchMock = okFetch();
    const res = await new HttpExecutor(fetchMock).execute(
      {
        method: 'GET',
        url: 'https://example.com',
        headers: '{"Authorization": "Bearer {{vars.t}}"}',
      },
      ctx({ variables: { t: 'abc' } })
    );
    expect(res.success).toBe(true);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('fails clearly on invalid JSON', async () => {
    const res = await new HttpExecutor(okFetch()).execute(
      { method: 'GET', url: 'https://example.com', headers: '{nope' },
      ctx()
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/headers is not valid JSON/);
  });
});

describe('run runbook configured through the form', () => {
  it('reads the runbookId field instead of failing on a missing ref', async () => {
    const prisma = {
      execution: { findUnique: jest.fn(async () => null) },
    };
    const res = await new RunbookExecutor(prisma as never).execute(
      { runbookId: 'child' } as never,
      ctx()
    );
    expect(res.error).not.toMatch(/ref is required/);
  });
});

describe('email on the platform SMTP', () => {
  it('ignores a tenant-chosen From address', async () => {
    const sendMail = jest.fn(async () => ({ messageId: 'm', accepted: [], rejected: [] }));
    process.env.SMTP_FROM = 'noreply@platform.test';
    try {
      await new EmailExecutor(() => ({ sendMail }) as never).execute(
        { from: 'ceo@bank.example', to: 'a@b.c', subject: 's', body: 'b' },
        ctx()
      );
    } finally {
      delete process.env.SMTP_FROM;
    }
    expect((sendMail.mock.calls[0] as unknown as [{ from: string }])[0].from).toBe(
      'noreply@platform.test'
    );
  });
});

describe('secret refs', () => {
  it('collects bare credential ids as well as {{secrets.x}}', () => {
    expect(
      SecretTemplateResolver.extractRefs({ credentialId: 'acc_1', url: '{{secrets.acc_2}}' }).sort()
    ).toEqual(['acc_1', 'acc_2']);
  });
});

describe('template scope across steps', () => {
  it('lets a downstream step read run inputs and any earlier step output', async () => {
    const executor = new NodeExecutor({} as never);
    const out = await executor.execute(
      {
        id: 'n3',
        type: 'operari.set',
        title: 'set',
        position: { x: 0, y: 0 },
        config: { fields: '{"svc": "{{vars.service}}", "url": "{{steps.n1.output.url}}"}' },
      } as never,
      { fromParent: true },
      't-1',
      undefined,
      false,
      { vars: { service: 'api' }, steps: { n1: { output: { url: 'https://x' } } } }
    );
    expect(out).toEqual({ svc: 'api', url: 'https://x' });
  });
});
