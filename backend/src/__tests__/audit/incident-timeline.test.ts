import {
  inline,
  renderIncidentTimeline,
  scrubOutput,
  TimelineData,
} from '../../audit/incident-timeline';

const at = (time: string) => new Date(`2026-11-07T${time}Z`);

function data(over: Partial<TimelineData['run']> = {}): TimelineData {
  return {
    run: {
      id: 'run-1',
      status: 'SUCCESS',
      trigger: 'WEBHOOK',
      startedAt: at('10:00:00'),
      completedAt: at('10:05:00'),
      duration: 300000,
      error: null,
      dryRun: false,
      metadata: {
        alert: {
          source: 'alertmanager',
          name: 'DiskFull',
          severity: 'critical',
          startsAt: '2026-11-07T09:59:00.000Z',
          resolvedAt: '2026-11-07T10:06:00.000Z',
        },
      },
      runbook: { slug: 'disk', name: 'Disk full' },
      ...over,
    },
    steps: [
      {
        nodeName: 'Clean logs',
        nodeType: 'shell',
        status: 'SUCCESS',
        startedAt: at('10:04:00'),
        completedAt: at('10:04:30'),
        duration: 30000,
        output: { stdout: 'freed 4G', password: 'hunter2' },
        error: null,
      },
    ],
    events: [
      {
        seq: 7n,
        type: 'approval.requested',
        actorId: 'system',
        payload: { message: 'Clean logs?' },
        hash: 'a'.repeat(64),
        createdAt: at('10:01:00'),
      },
      {
        seq: 8n,
        type: 'approval.granted',
        actorId: 'user:u1',
        payload: { comment: 'go' },
        hash: 'b'.repeat(64),
        createdAt: at('10:03:00'),
      },
      {
        seq: 9n,
        type: 'secret.accessed',
        actorId: 'system',
        payload: { secretId: 's1' },
        hash: 'c'.repeat(64),
        createdAt: at('10:03:30'),
      },
    ],
    eventsTruncated: false,
    actorName: id => (id === 'user:u1' ? 'oncall@x.io' : 'system'),
  };
}

describe('renderIncidentTimeline', () => {
  it('orders the alert, approvals and steps by time, naming who approved', () => {
    const md = renderIncidentTimeline(data(), 'en');
    const order = [
      'Alert fired',
      'Run started',
      'Approval requested: Clean logs?',
      'Approved by oncall@x.io: go',
      'Step Clean logs (shell): SUCCESS',
      'Run ended: SUCCESS',
      'Alert resolved',
    ].map(text => md.indexOf(text));
    expect(order).not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('keeps every audit entry as evidence with its full hash', () => {
    const md = renderIncidentTimeline(data(), 'en');
    expect(md).toContain(`#9 \`2026-11-07T10:03:30.000Z\` secret.accessed \`${'c'.repeat(64)}\``);
  });

  it('masks secrets in step output and warns the reader', () => {
    const md = renderIncidentTimeline(data(), 'en');
    expect(md).toContain('freed 4G');
    expect(md).not.toContain('hunter2');
    expect(md).toContain('review step output');
  });

  it('cannot be broken out of by backticks in output', () => {
    const input = data();
    input.steps[0].output = 'before\n```\n# injected\n```';
    const md = renderIncidentTimeline(input, 'en');
    expect(md).toContain('````text\nbefore\n```\n# injected\n```\n````');
  });

  it('renders a run with no alert in Spanish and leaves postmortem headings', () => {
    const md = renderIncidentTimeline(data({ metadata: null, completedAt: null }), 'es');
    expect(md).toContain('sin terminar');
    expect(md).not.toContain('## Alerta');
    expect(md).toContain('### Causa raíz');
  });

  it('survives a resolved alert without a start time', () => {
    const md = renderIncidentTimeline(
      data({
        metadata: { alert: { name: 'x', source: 'grafana', resolvedAt: '2026-11-07T10:06:00Z' } },
      }),
      'en'
    );
    expect(md).toContain('Alert resolved');
    expect(md).not.toContain('Invalid');
  });
});

describe('scrubOutput', () => {
  it.each([
    ['Authorization: Bearer abcdef123456789', 'abcdef123456789'],
    ['key sk-abcdefghijklmnopqrstuv end', 'sk-abcdefghijklmnopqrstuv'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123', 'ghp_abcdefghijklmnop'],
    ['xoxb-1234567890-abcdefghij', 'xoxb-1234567890'],
    ['AKIAIOSFODNN7EXAMPLE', 'AKIAIOSFODNN7EXAMPLE'],
    ['postgres://admin:s3cret@db:5432/app', 's3cret'],
    ['DB_PASSWORD=s3cret', 's3cret'],
    ['https://hooks.slack.com/services/T0/B0/xyz', 'T0/B0/xyz'],
    ['-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----', 'abc'],
  ])('masks %s', (value, leaked) => {
    expect(scrubOutput(value)).not.toContain(leaked);
  });

  it('walks nested values and leaves ordinary text alone', () => {
    expect(scrubOutput({ list: [{ apiKey: 'x' }], note: 'disk at 91%' })).toEqual({
      list: [{ apiKey: '[redacted]' }],
      note: 'disk at 91%',
    });
  });
});

describe('inline', () => {
  it('keeps user text on one line with Markdown neutralised', () => {
    expect(inline('a\n# b [x](http://e) <img>')).toBe('a \\# b \\[x\\](http://e) \\<img\\>');
  });
});
