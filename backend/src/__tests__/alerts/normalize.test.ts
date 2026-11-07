import { normalizeAlerts, normalizeSeverity, occurrenceKey } from '../../alerts/normalize';

const alertmanager = {
  version: '4',
  status: 'firing',
  receiver: 'operari',
  externalURL: 'http://am:9093',
  alerts: [
    {
      status: 'firing',
      labels: { alertname: 'DiskFull', instance: 'web-1', severity: 'critical' },
      annotations: { summary: 'Disk 95% on web-1', description: '/var is almost full' },
      startsAt: '2026-11-05T10:00:00Z',
      endsAt: '0001-01-01T00:00:00Z',
      generatorURL: 'http://prom/graph?g0.expr=disk',
      fingerprint: 'abc123',
    },
    {
      status: 'resolved',
      labels: { alertname: 'HighLoad', instance: 'web-2' },
      annotations: {},
      startsAt: '2026-11-05T09:00:00Z',
      endsAt: '2026-11-05T09:30:00Z',
    },
  ],
};

describe('normalizeAlerts', () => {
  it('reads every alert in an Alertmanager group', () => {
    const [disk, load] = normalizeAlerts('alertmanager', alertmanager);
    expect(disk).toEqual({
      source: 'alertmanager',
      status: 'firing',
      name: 'DiskFull',
      title: 'Disk 95% on web-1',
      severity: 'critical',
      summary: 'Disk 95% on web-1',
      description: '/var is almost full',
      url: 'http://prom/graph?g0.expr=disk',
      labels: { alertname: 'DiskFull', instance: 'web-1', severity: 'critical' },
      fingerprint: 'abc123',
      startsAt: '2026-11-05T10:00:00Z',
      endsAt: undefined,
    });
    expect(disk.labels.instance).toBe('web-1');
    expect(load).toMatchObject({ status: 'resolved', name: 'HighLoad', severity: 'unknown' });
    expect(load.endsAt).toBe('2026-11-05T09:30:00Z');
    // No fingerprint in the payload: derived from the labels, stably.
    expect(load.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(normalizeAlerts('alertmanager', alertmanager)[1].fingerprint).toBe(load.fingerprint);
  });

  it('prefers the Grafana panel link', () => {
    const [a] = normalizeAlerts('grafana', {
      alerts: [
        {
          status: 'firing',
          labels: { alertname: 'Latency', severity: 'warning' },
          annotations: {},
          fingerprint: 'g1',
          dashboardURL: 'https://g/d/1',
          panelURL: 'https://g/d/1?viewPanel=2',
        },
      ],
    });
    expect(a).toMatchObject({
      source: 'grafana',
      url: 'https://g/d/1?viewPanel=2',
      severity: 'warning',
    });
  });

  it('maps PagerDuty v3 incident events and ignores the rest', () => {
    const event = (type: string) => ({
      event: {
        id: 'ev1',
        event_type: type,
        occurred_at: '2026-11-05T10:00:00Z',
        data: {
          id: 'PINC1',
          type: 'incident',
          title: 'API 5xx',
          urgency: 'high',
          html_url: 'https://acme.pagerduty.com/incidents/PINC1',
          service: { summary: 'api' },
          priority: { summary: 'P1' },
        },
      },
    });
    expect(normalizeAlerts('pagerduty', event('incident.triggered'))[0]).toMatchObject({
      status: 'firing',
      fingerprint: 'PINC1',
      severity: 'critical',
      labels: { service: 'api', priority: 'P1', urgency: 'high' },
      startsAt: '2026-11-05T10:00:00Z',
    });
    expect(normalizeAlerts('pagerduty', event('incident.resolved'))[0].status).toBe('resolved');
    expect(normalizeAlerts('pagerduty', event('incident.acknowledged'))).toEqual([]);
  });

  it('maps Opsgenie Create and Close', () => {
    const body = (action: string) => ({
      action,
      alert: {
        alertId: 'og-1',
        alias: 'disk-web-1',
        message: 'Disk full',
        priority: 'P2',
        tags: ['disk', 'web'],
        details: { host: 'web-1' },
        createdAt: 1762336800000,
      },
    });
    expect(normalizeAlerts('opsgenie', body('Create'))[0]).toMatchObject({
      status: 'firing',
      fingerprint: 'disk-web-1',
      severity: 'error',
      labels: { host: 'web-1', tags: 'disk,web', priority: 'P2' },
    });
    expect(normalizeAlerts('opsgenie', body('Close'))[0].status).toBe('resolved');
    expect(normalizeAlerts('opsgenie', body('Acknowledge'))).toEqual([]);
  });

  it('tolerates junk', () => {
    expect(normalizeAlerts('alertmanager', null)).toEqual([]);
    expect(normalizeAlerts('pagerduty', { event: { event_type: 'incident.triggered' } })).toEqual(
      []
    );
  });
});

it('normalizeSeverity understands the usual spellings', () => {
  expect(['P1', 'page', 'crit'].map(normalizeSeverity)).toEqual([
    'critical',
    'critical',
    'critical',
  ]);
  expect(normalizeSeverity('warn')).toBe('warning');
  expect(normalizeSeverity(undefined)).toBe('unknown');
});

it('occurrenceKey separates occurrences and stays within the column', () => {
  const a = normalizeAlerts('alertmanager', alertmanager)[0];
  expect(occurrenceKey('wh', a)).toBe('wh:abc123:2026-11-05T10:00:00Z');
  expect(occurrenceKey('wh', { ...a, startsAt: '2026-11-06T00:00:00Z' })).not.toBe(
    occurrenceKey('wh', a)
  );
  expect(occurrenceKey('wh', { ...a, fingerprint: 'x'.repeat(300) }).length).toBeLessThanOrEqual(
    190
  );
});

describe('sentry', () => {
  const issue = {
    id: '42',
    title: 'TypeError in checkout',
    level: 'fatal',
    firstSeen: '2026-11-01T00:00:00Z',
    lastSeen: '2026-11-07T00:00:00Z',
    web_url: 'https://sentry.io/issues/42',
  };

  it('keeps the same occurrence for repeats of one issue', () => {
    const [a] = normalizeAlerts('sentry', { action: 'created', data: { issue } });
    const [b] = normalizeAlerts('sentry', { action: 'triggered', data: { issue } });
    expect(a).toMatchObject({ status: 'firing', severity: 'critical', fingerprint: 'issue:42' });
    expect(b.fingerprint).toBe(a.fingerprint);
    expect(b.startsAt).toBe(a.startsAt);
  });

  it('treats a regression as a new occurrence', () => {
    const [created] = normalizeAlerts('sentry', { action: 'created', data: { issue } });
    const [regressed] = normalizeAlerts('sentry', { action: 'unresolved', data: { issue } });
    expect(regressed.fingerprint).toBe(created.fingerprint);
    expect(regressed.startsAt).not.toBe(created.startsAt);
  });

  it('marks a resolution', () => {
    const [alert] = normalizeAlerts('sentry', { action: 'resolved', data: { issue } });
    expect(alert.status).toBe('resolved');
  });

  it('ignores actions that are not alerts', () => {
    expect(normalizeAlerts('sentry', { action: 'assigned', data: { issue } })).toEqual([]);
    expect(normalizeAlerts('sentry', { action: 'ignored', data: { issue } })).toEqual([]);
  });

  it('reads a metric alert', () => {
    const payload = {
      action: 'critical',
      data: {
        description_title: 'Latency above 2s',
        web_url: 'https://sentry.io/alerts/9',
        metric_alert: { id: 9, title: 'Slow API', date_started: '2026-11-07T10:00:00Z' },
      },
    };
    const [alert] = normalizeAlerts('sentry', payload);
    expect(alert).toMatchObject({
      title: 'Slow API',
      severity: 'critical',
      summary: 'Latency above 2s',
      fingerprint: 'metric:9',
    });
  });

  it('returns nothing for a body it cannot place', () => {
    expect(normalizeAlerts('sentry', {})).toEqual([]);
  });
});

describe('datadog', () => {
  const monitor = {
    id: '77',
    alert_title: 'CPU high on web',
    alert_transition: 'Triggered',
    alert_cycle_key: 'cycle-1',
    alert_scope: 'host:web-1',
    priority: 'P1',
    link: 'https://app.datadoghq.com/monitors/77',
  };

  it('treats a re-trigger in one cycle as the same occurrence', () => {
    const [a] = normalizeAlerts('datadog', monitor);
    const [b] = normalizeAlerts('datadog', { ...monitor, alert_transition: 'Re-Triggered' });
    expect(a).toMatchObject({ status: 'firing', severity: 'critical' });
    expect([b.fingerprint, b.startsAt]).toEqual([a.fingerprint, a.startsAt]);
  });

  it('treats a new cycle as a new occurrence', () => {
    const [a] = normalizeAlerts('datadog', monitor);
    const [b] = normalizeAlerts('datadog', { ...monitor, alert_cycle_key: 'cycle-2' });
    expect(b.fingerprint).toBe(a.fingerprint);
    expect(b.startsAt).not.toBe(a.startsAt);
  });

  it('keeps hosts of one monitor apart', () => {
    const [a] = normalizeAlerts('datadog', monitor);
    const [b] = normalizeAlerts('datadog', { ...monitor, alert_scope: 'host:web-2' });
    expect(b.fingerprint).not.toBe(a.fingerprint);
  });

  it('marks a recovery', () => {
    const [alert] = normalizeAlerts('datadog', { ...monitor, alert_transition: 'Recovered' });
    expect(alert.status).toBe('resolved');
  });

  it('prefers a severity tag over the priority', () => {
    const [alert] = normalizeAlerts('datadog', { ...monitor, tags: 'env:prod,severity:warning' });
    expect(alert.severity).toBe('warning');
  });
});
