import {
  SecretReferenceError,
  SecretTemplateResolver,
} from '../../../runbook/secrets/secret-template-resolver';
import { resolveTemplate } from '../../../runbook/types/executor.types';
import {
  ConnectedAccountError,
  ConnectedAccountService,
} from '../../../security/connected-account.service';

/**
 * The resolver is the orchestrator-side glue that turns
 * `{{secrets.<id>}}` references in a step config into a plaintext map
 * the executor can read sync. We test it in isolation here; the
 * NodeExecutor wiring is covered in node-executor.dispatcher.test.ts.
 */

function fakeAccountService(
  behavior: Record<
    string,
    { ok: true; token: string } | { ok: false; error: ConnectedAccountError | Error }
  >
): {
  service: ConnectedAccountService;
  calls: Array<{ accountId: string; tenantId: string; actorId: string; reason: string }>;
} {
  const calls: Array<{ accountId: string; tenantId: string; actorId: string; reason: string }> = [];
  const service = {
    async getAccessToken(input: {
      accountId: string;
      tenantId: string;
      actorId: string;
      reason: string;
    }): Promise<string> {
      calls.push({
        accountId: input.accountId,
        tenantId: input.tenantId,
        actorId: input.actorId,
        reason: input.reason,
      });
      const entry = behavior[input.accountId];
      if (!entry) {
        throw new ConnectedAccountError(`not found: ${input.accountId}`, 'NOT_FOUND');
      }
      if (entry.ok) return entry.token;
      throw entry.error;
    },
  } as unknown as ConnectedAccountService;
  return { service, calls };
}

describe('SecretTemplateResolver.extractRefs', () => {
  it('finds refs in flat string fields', () => {
    const refs = SecretTemplateResolver.extractRefs({
      webhookUrl: 'https://hooks.slack.com/services/{{secrets.slack-prod}}',
      message: 'hi',
    });
    expect(refs).toEqual(['slack-prod']);
  });

  it('walks nested objects and arrays', () => {
    const refs = SecretTemplateResolver.extractRefs({
      headers: {
        Authorization: 'Bearer {{secrets.gh-token}}',
        'X-Custom': 'static',
      },
      body: ['{{secrets.dd-api}}', '{{secrets.dd-app}}'],
    });
    expect(refs.sort()).toEqual(['dd-api', 'dd-app', 'gh-token']);
  });

  it('deduplicates repeated refs', () => {
    const refs = SecretTemplateResolver.extractRefs({
      a: '{{secrets.same}} and {{secrets.same}}',
      b: '{{secrets.same}}',
    });
    expect(refs).toEqual(['same']);
  });

  it('returns an empty list when no secret refs are present', () => {
    expect(
      SecretTemplateResolver.extractRefs({
        command: 'echo {{vars.name}}',
        env: { FOO: '{{steps.previous.output.bar}}' },
      })
    ).toEqual([]);
  });

  it('ignores plain text that mentions secrets without the template syntax', () => {
    expect(
      SecretTemplateResolver.extractRefs({
        message: 'do not put secrets in chat',
      })
    ).toEqual([]);
  });

  it('tolerates whitespace inside the template braces', () => {
    const refs = SecretTemplateResolver.extractRefs({
      url: '{{ secrets.with-space }}',
    });
    expect(refs).toEqual(['with-space']);
  });

  it('handles null and undefined values without throwing', () => {
    expect(SecretTemplateResolver.extractRefs(null)).toEqual([]);
    expect(SecretTemplateResolver.extractRefs(undefined)).toEqual([]);
    expect(SecretTemplateResolver.extractRefs({ a: null, b: undefined })).toEqual([]);
  });
});

describe('SecretTemplateResolver.resolve', () => {
  it('returns an empty map when there are no secret references', async () => {
    const { service, calls } = fakeAccountService({});
    const resolver = new SecretTemplateResolver(service);

    const out = await resolver.resolve({
      config: { command: 'echo {{vars.name}}' },
      tenantId: 't',
      runId: 'r',
      stepId: 's',
    });

    expect(out).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('fetches each unique referenced account exactly once', async () => {
    const { service, calls } = fakeAccountService({
      'slack-prod': { ok: true, token: 'xoxb-PROD' },
      'gh-bot': { ok: true, token: 'ghp-BOT' },
    });
    const resolver = new SecretTemplateResolver(service);

    const out = await resolver.resolve({
      config: {
        webhookUrl: 'https://hooks.slack.com/{{secrets.slack-prod}}',
        headers: {
          Authorization: 'Bearer {{secrets.gh-bot}}',
          Backup: '{{secrets.slack-prod}}',
        },
      },
      tenantId: 't1',
      runId: 'run-42',
      stepId: 'notify-1',
    });

    expect(out).toEqual({
      'slack-prod': 'xoxb-PROD',
      'gh-bot': 'ghp-BOT',
    });
    expect(calls).toHaveLength(2);
  });

  it('passes runId and stepId through to the audit actor and reason', async () => {
    const { service, calls } = fakeAccountService({
      'gh-bot': { ok: true, token: 'ghp-BOT' },
    });
    const resolver = new SecretTemplateResolver(service);

    await resolver.resolve({
      config: { token: '{{secrets.gh-bot}}' },
      tenantId: 'tenant-x',
      runId: 'run-99',
      stepId: 'deploy-step',
    });

    expect(calls[0]).toEqual({
      accountId: 'gh-bot',
      tenantId: 'tenant-x',
      actorId: 'run:run-99',
      reason: 'runbook-step:deploy-step',
    });
  });

  it('throws SecretReferenceError when the account does not exist', async () => {
    const { service } = fakeAccountService({});
    const resolver = new SecretTemplateResolver(service);

    await expect(
      resolver.resolve({
        config: { url: '{{secrets.does-not-exist}}' },
        tenantId: 't',
        runId: 'r',
        stepId: 's',
      })
    ).rejects.toMatchObject({
      name: 'SecretReferenceError',
      accountId: 'does-not-exist',
      stepId: 's',
      message: expect.stringContaining('does not exist'),
    });
  });

  it('throws SecretReferenceError on cross-tenant access', async () => {
    const { service } = fakeAccountService({
      'foreign-acct': {
        ok: false,
        error: new ConnectedAccountError('cross-tenant', 'CROSS_TENANT'),
      },
    });
    const resolver = new SecretTemplateResolver(service);

    await expect(
      resolver.resolve({
        config: { token: '{{secrets.foreign-acct}}' },
        tenantId: 't',
        runId: 'r',
        stepId: 's',
      })
    ).rejects.toMatchObject({
      name: 'SecretReferenceError',
      accountId: 'foreign-acct',
      message: expect.stringContaining('belongs to another tenant'),
    });
  });

  it('rethrows non-ConnectedAccountError exceptions untouched', async () => {
    const boom = new Error('redis is on fire');
    const { service } = fakeAccountService({
      'gh-bot': { ok: false, error: boom },
    });
    const resolver = new SecretTemplateResolver(service);

    await expect(
      resolver.resolve({
        config: { token: '{{secrets.gh-bot}}' },
        tenantId: 't',
        runId: 'r',
        stepId: 's',
      })
    ).rejects.toBe(boom);
  });
});

describe('resolveTemplate — secrets branch', () => {
  const ctx = {
    runId: 'r',
    stepId: 's',
    variables: {},
    previousOutputs: {},
    tenantId: 't',
    secrets: { 'gh-bot': 'ghp-BOT', 'slack-prod': 'xoxb-PROD' },
  };

  it('substitutes secrets.<id> from context.secrets', () => {
    expect(resolveTemplate('Bearer {{secrets.gh-bot}}', ctx)).toBe('Bearer ghp-BOT');
  });

  it('handles multiple secrets in one string', () => {
    expect(resolveTemplate('{{secrets.gh-bot}} and {{secrets.slack-prod}}', ctx)).toBe(
      'ghp-BOT and xoxb-PROD'
    );
  });

  it('returns empty string for unknown secret ids (same as vars)', () => {
    expect(resolveTemplate('{{secrets.missing}}', ctx)).toBe('');
  });

  it('returns empty string when context.secrets is undefined', () => {
    expect(resolveTemplate('{{secrets.gh-bot}}', { ...ctx, secrets: undefined })).toBe('');
  });

  it('does not interfere with vars or steps interpolation', () => {
    expect(
      resolveTemplate('{{vars.name}} {{secrets.gh-bot}} {{steps.s1.out}}', {
        ...ctx,
        variables: { name: 'world' },
        previousOutputs: { s1: { out: 'OK' } },
      })
    ).toBe('world ghp-BOT OK');
  });
});
