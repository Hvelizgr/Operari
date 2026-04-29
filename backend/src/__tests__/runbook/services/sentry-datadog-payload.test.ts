import type { PrismaClient } from '@prisma/client';

import { WebhookService } from '../../../runbook/services/webhook.service';

function buildService(): WebhookService {
  return new WebhookService({} as PrismaClient);
}

describe('WebhookService.mapPayloadToVariables (sentry)', () => {
  let svc: WebhookService;
  beforeEach(() => {
    svc = buildService();
  });

  it('parses an issue alert with exception details', () => {
    const vars = svc.mapPayloadToVariables('sentry', 'event_alert', {
      action: 'triggered',
      data: {
        issue: {
          id: '12345',
          title: 'TypeError: Cannot read property of undefined',
          web_url: 'https://sentry.io/issues/12345/',
          status: 'unresolved',
          level: 'error',
          firstSeen: '2026-04-01T00:00:00Z',
          count: 42,
          project: { slug: 'api-backend' },
          tags: [
            { key: 'environment', value: 'production' },
            { key: 'release', value: 'v1.2.0' },
          ],
        },
        event: {
          title: 'TypeError: Cannot read property of undefined',
          environment: 'production',
          exception: {
            values: [
              {
                type: 'TypeError',
                value: "Cannot read property 'name' of undefined",
                module: 'app.services.user',
                stacktrace: {
                  frames: [
                    {
                      filename: 'app/services/user.ts',
                      function: 'getUser',
                      lineno: 42,
                      in_app: true,
                      context_line: 'return user.name;',
                    },
                    {
                      filename: 'app/routes/api.ts',
                      function: 'handler',
                      lineno: 15,
                      in_app: true,
                    },
                  ],
                },
              },
            ],
          },
          user: { id: 'usr-1', email: 'user@example.com', ip_address: '1.2.3.4' },
          transaction: 'GET /api/users/:id',
        },
      },
      project_slug: 'api-backend',
      installation: { uuid: 'org-uuid-1' },
    });

    expect(vars.source).toBe('sentry');
    expect(vars.action).toBe('triggered');
    expect(vars.issue_id).toBe('12345');
    expect(vars.issue_title).toBe('TypeError: Cannot read property of undefined');
    expect(vars.issue_url).toBe('https://sentry.io/issues/12345/');
    expect(vars.issue_status).toBe('unresolved');
    expect(vars.issue_level).toBe('error');
    expect(vars.issue_count).toBe(42);
    expect(vars.exception_type).toBe('TypeError');
    expect(vars.exception_value).toBe("Cannot read property 'name' of undefined");
    expect(vars.exception_module).toBe('app.services.user');
    const frames = vars.stacktrace_frames as any[];
    expect(frames).toHaveLength(2);
    expect(frames[0].filename).toBe('app/services/user.ts');
    expect(frames[0].function).toBe('getUser');
    expect(frames[0].lineno).toBe(42);
    expect(vars.environment).toBe('production');
    expect(vars.release).toBe('v1.2.0');
    expect(vars.project).toBe('api-backend');
    expect(vars.user_email).toBe('user@example.com');
    expect(vars.transaction).toBe('GET /api/users/:id');
    expect(vars.tags).toEqual({ environment: 'production', release: 'v1.2.0' });
  });

  it('parses a metric alert', () => {
    const vars = svc.mapPayloadToVariables('sentry', 'metric_alert', {
      action: 'critical',
      data: {
        metric_alert: {
          title: 'High error rate',
          alert_rule_name: 'high-error-rate',
          value: 95,
          web_url: 'https://sentry.io/alerts/rule/123/',
        },
        description_title: 'Critical',
        value: 95.5,
      },
      project_slug: 'api-backend',
      installation: { uuid: 'org-uuid-1' },
    });

    expect(vars.source).toBe('sentry');
    expect(vars.event).toBe('metric_alert');
    expect(vars.alert_name).toBe('High error rate');
    expect(vars.alert_status).toBe('critical');
    expect(vars.metric_value).toBe(95.5);
    expect(vars.project).toBe('api-backend');
  });

  it('parses a legacy flat payload', () => {
    const vars = svc.mapPayloadToVariables('sentry', undefined, {
      message: 'Something broke',
      level: 'warning',
      project: 'my-project',
      project_slug: 'my-project',
      url: 'https://sentry.io/issues/999/',
    });

    expect(vars.source).toBe('sentry');
    expect(vars.issue_title).toBe('Something broke');
    expect(vars.issue_level).toBe('warning');
    expect(vars.issue_url).toBe('https://sentry.io/issues/999/');
  });

  it('handles missing exception gracefully', () => {
    const vars = svc.mapPayloadToVariables('sentry', 'event_alert', {
      action: 'triggered',
      data: {
        issue: { id: '1', title: 'Error', level: 'error' },
      },
    });

    expect(vars.exception_type).toBeUndefined();
    expect(vars.stacktrace_frames).toBeUndefined();
    expect(vars.issue_title).toBe('Error');
  });
});

describe('WebhookService.mapPayloadToVariables (datadog)', () => {
  let svc: WebhookService;
  beforeEach(() => {
    svc = buildService();
  });

  it('parses a monitor alert with tags and thresholds', () => {
    const vars = svc.mapPayloadToVariables('datadog', undefined, {
      alert_title: 'High CPU on web-01',
      alert_status: 'Triggered',
      alert_type: 'metric alert',
      alert_transition: 'Triggered',
      alert_metric: 'system.cpu.user',
      alert_query: 'avg(last_5m):avg:system.cpu.user{host:web-01} > 90',
      alert_threshold: 90,
      value: 95.3,
      id: 'monitor-123',
      monitor_name: 'High CPU',
      priority: 'P1',
      hostname: 'web-01',
      tags: 'env:production,service:api,severity:critical',
      link: 'https://app.datadoghq.com/monitors/123',
      last_updated: '2026-04-10T12:00:00Z',
      last_updated_ts: 1776000000,
      body: 'CPU is above 90% on web-01 for 5 minutes',
      org: { id: 'org-1', name: 'Acme Corp' },
    });

    expect(vars.source).toBe('datadog');
    expect(vars.alert_title).toBe('High CPU');
    expect(vars.alert_status).toBe('Triggered');
    expect(vars.alert_type).toBe('metric alert');
    expect(vars.alert_transition).toBe('Triggered');
    expect(vars.monitor_id).toBe('monitor-123');
    expect(vars.monitor_query).toBe('avg(last_5m):avg:system.cpu.user{host:web-01} > 90');
    expect(vars.monitor_metric).toBe('system.cpu.user');
    expect(vars.threshold).toBe(90);
    expect(vars.current_value).toBe(95.3);
    expect(vars.priority).toBe('P1');
    expect(vars.hostname).toBe('web-01');
    expect(vars.message).toBe('CPU is above 90% on web-01 for 5 minutes');
    expect(vars.monitor_url).toBe('https://app.datadoghq.com/monitors/123');
    // Tags parsed
    const tags = vars.tags as Record<string, string>;
    expect(tags.env).toBe('production');
    expect(tags.service).toBe('api');
    expect(tags.severity).toBe('critical');
    expect(vars.environment).toBe('production');
    expect(vars.service).toBe('api');
    expect(vars.severity).toBe('critical');
    // Org
    expect(vars.org_name).toBe('Acme Corp');
  });

  it('parses tags from an array', () => {
    const vars = svc.mapPayloadToVariables('datadog', 'alert', {
      alert_title: 'Test',
      tags: ['env:staging', 'service:worker'],
    });

    const tags = vars.tags as Record<string, string>;
    expect(tags.env).toBe('staging');
    expect(tags.service).toBe('worker');
  });

  it('handles minimal payload', () => {
    const vars = svc.mapPayloadToVariables('datadog', undefined, {
      title: 'Simple alert',
      alert_status: 'Recovered',
    });

    expect(vars.source).toBe('datadog');
    expect(vars.alert_title).toBe('Simple alert');
    expect(vars.alert_status).toBe('Recovered');
  });

  it('parses event type payload', () => {
    const vars = svc.mapPayloadToVariables('datadog', undefined, {
      event_title: 'Deploy completed',
      event_msg: 'Deployment v1.2.0 to production completed',
      alert_transition: 'Recovered',
      hostname: 'deploy-server',
      tags: 'env:production',
    });

    expect(vars.event).toBe('Recovered');
    expect(vars.message).toBe('Deployment v1.2.0 to production completed');
    expect(vars.hostname).toBe('deploy-server');
  });

  it('includes raw payload', () => {
    const payload = { title: 'Test', alert_status: 'ok' };
    const vars = svc.mapPayloadToVariables('datadog', undefined, payload);
    expect(vars.raw).toBe(payload);
  });
});

// ---------------------------------------------------------------------------
// Cross-provider normalized envelope
// ---------------------------------------------------------------------------

describe('WebhookService.mapPayloadToVariables — cross-provider alert envelope', () => {
  let svc: WebhookService;
  beforeEach(() => {
    svc = buildService();
  });

  it('emits an alert.* envelope on Sentry issue payloads', () => {
    const vars = svc.mapPayloadToVariables('sentry', 'event_alert', {
      action: 'triggered',
      data: {
        issue: {
          title: 'NullPointerException',
          web_url: 'https://sentry.io/issues/9999/',
          level: 'fatal',
          tags: [{ key: 'environment', value: 'production' }],
          project: { slug: 'api' },
        },
        event: { title: 'NullPointerException' },
      },
    });
    const alert = vars.alert as Record<string, unknown>;
    expect(alert).toBeDefined();
    expect(alert.source).toBe('sentry');
    expect(alert.title).toBe('NullPointerException');
    expect(alert.url).toBe('https://sentry.io/issues/9999/');
    // Sentry "fatal" → normalized "critical"
    expect(alert.severity).toBe('critical');
    expect(alert.environment).toBe('production');
  });

  it('maps Sentry levels to the canonical severity scale', () => {
    const cases: Array<[string, string]> = [
      ['fatal', 'critical'],
      ['error', 'error'],
      ['warning', 'warning'],
      ['info', 'info'],
      ['debug', 'info'],
    ];
    for (const [level, expected] of cases) {
      const vars = svc.mapPayloadToVariables('sentry', 'event_alert', {
        data: { issue: { title: 't', level } },
      });
      expect((vars.alert as Record<string, unknown>).severity).toBe(expected);
    }
  });

  it('emits an alert.* envelope on Datadog monitor payloads', () => {
    const vars = svc.mapPayloadToVariables('datadog', undefined, {
      alert_title: 'High error rate on payments',
      alert_status: 'Triggered',
      alert_transition: 'Triggered',
      priority: 'P1',
      link: 'https://app.datadoghq.com/monitors/123',
      tags: ['env:production', 'service:payments'],
      body: 'errors_5m above 10%',
    });
    const alert = vars.alert as Record<string, unknown>;
    expect(alert).toBeDefined();
    expect(alert.source).toBe('datadog');
    expect(alert.title).toBe('High error rate on payments');
    expect(alert.url).toBe('https://app.datadoghq.com/monitors/123');
    // Datadog P1 → normalized "critical"
    expect(alert.severity).toBe('critical');
    expect(alert.environment).toBe('production');
    expect(alert.summary).toBe('errors_5m above 10%');
  });

  it('falls back to tag-based severity when Datadog priority is unset', () => {
    const vars = svc.mapPayloadToVariables('datadog', undefined, {
      alert_title: 't',
      tags: ['severity:high'],
    });
    expect((vars.alert as Record<string, unknown>).severity).toBe('error');
  });

  it('returns severity=unknown when neither side gives us a hint', () => {
    const vars = svc.mapPayloadToVariables('datadog', undefined, {
      alert_title: 't',
      tags: [],
    });
    expect((vars.alert as Record<string, unknown>).severity).toBe('unknown');
  });
});
