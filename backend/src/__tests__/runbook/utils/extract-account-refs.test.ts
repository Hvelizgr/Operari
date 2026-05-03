import { extractAccountRefs } from '../../../runbook/utils/extract-account-refs';

describe('extractAccountRefs', () => {
  it('returns empty when config has no refs', () => {
    expect(extractAccountRefs({})).toEqual([]);
    expect(extractAccountRefs(null)).toEqual([]);
    expect(extractAccountRefs(undefined)).toEqual([]);
    expect(extractAccountRefs({ url: 'https://example.com', method: 'GET' })).toEqual([]);
  });

  it('extracts {{secrets.X}} templates anywhere in the tree', () => {
    const config = {
      url: 'https://api.example.com',
      headers: {
        Authorization: 'Bearer {{secrets.acc-prod-1}}',
        'X-Trace': '{{secrets.acc-tracing-7}} extra',
      },
      body: 'plain text',
    };
    expect(extractAccountRefs(config).sort()).toEqual(['acc-prod-1', 'acc-tracing-7']);
  });

  it('extracts well-known credential field names with raw account ids', () => {
    expect(
      extractAccountRefs({
        credentialId: 'acc-pg-prod',
        operation: 'query',
        sql: 'SELECT 1',
      })
    ).toEqual(['acc-pg-prod']);
    expect(extractAccountRefs({ kubeconfigSecret: 'acc-k8s-staging' })).toEqual([
      'acc-k8s-staging',
    ]);
    expect(
      extractAccountRefs({
        sshTunnel: { sshCredentialId: 'acc-ssh-prod' },
      })
    ).toEqual(['acc-ssh-prod']);
  });

  it('dedupes refs that appear in both channels', () => {
    const config = {
      credentialId: 'acc-shared',
      headers: { 'X-Audit': '{{secrets.acc-shared}}' },
    };
    expect(extractAccountRefs(config)).toEqual(['acc-shared']);
  });

  it('ignores fields that look like account fields but hold non-string values', () => {
    expect(extractAccountRefs({ credentialId: 42, accountId: null })).toEqual([]);
  });

  it('walks arrays and nested objects', () => {
    const config = {
      steps: [
        { credentialId: 'acc-1' },
        { headers: { Authorization: '{{secrets.acc-2}}' } },
        { nested: { deep: { accountId: 'acc-3' } } },
      ],
    };
    expect(extractAccountRefs(config).sort()).toEqual(['acc-1', 'acc-2', 'acc-3']);
  });

  it('caps overly long strings to avoid treating prose as account ids', () => {
    const sentence = 'this is a long descriptive sentence that should not pass as an id';
    expect(extractAccountRefs({ credentialId: sentence })).toEqual([]);
  });
});
