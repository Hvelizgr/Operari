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
