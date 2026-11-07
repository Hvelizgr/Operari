import { createHash } from 'crypto';

/** Webhook sources whose payload is one or more alerts. */
export const ALERT_SOURCES = [
  'alertmanager',
  'grafana',
  'pagerduty',
  'opsgenie',
  'sentry',
  'datadog',
] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

export function isAlertSource(source: string): source is AlertSource {
  return (ALERT_SOURCES as readonly string[]).includes(source);
}

export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info' | 'unknown';

/**
 * One alert, whatever sent it. A runbook reads the same `vars.alert` fields
 * for every source.
 */
export interface NormalizedAlert {
  source: AlertSource;
  status: 'firing' | 'resolved';
  /** Rule name (Alertmanager `alertname`, PagerDuty/Opsgenie title). */
  name: string;
  title: string;
  severity: AlertSeverity;
  summary?: string;
  description?: string;
  url?: string;
  labels: Record<string, string>;
  /** Stable id of the alert across notifications. */
  fingerprint: string;
  /** When this occurrence started; a new occurrence gets a new value. */
  startsAt?: string;
  endsAt?: string;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined;

function stringMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj(v))) {
    if (val === null || val === undefined) continue;
    out[k] = typeof val === 'string' ? val : JSON.stringify(val);
  }
  return out;
}

export function normalizeSeverity(raw: string | undefined): AlertSeverity {
  switch ((raw ?? '').toLowerCase().trim()) {
    case 'critical':
    case 'crit':
    case 'fatal':
    case 'page':
    case 'high':
    case 'p1':
    case 'disaster':
      return 'critical';
    case 'error':
    case 'major':
    case 'p2':
      return 'error';
    case 'warning':
    case 'warn':
    case 'minor':
    case 'medium':
    case 'low':
    case 'p3':
      return 'warning';
    case 'info':
    case 'informational':
    case 'none':
    case 'p4':
    case 'p5':
      return 'info';
    default:
      return 'unknown';
  }
}

function labelFingerprint(labels: Record<string, string>): string {
  const sorted = Object.keys(labels)
    .sort()
    .map(k => `${k}=${labels[k]}`)
    .join('\n');
  return createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

/** Alertmanager webhook (v4); Grafana unified alerting sends the same shape plus URLs. */
function fromAlertmanager(source: 'alertmanager' | 'grafana', payload: Obj): NormalizedAlert[] {
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const externalUrl = str(payload.externalURL);
  return alerts.map(raw => {
    const a = obj(raw);
    const labels = stringMap(a.labels);
    const annotations = stringMap(a.annotations);
    const name = labels.alertname ?? str(payload.title) ?? 'alert';
    const endsAt = str(a.endsAt);
    return {
      source,
      status: str(a.status) === 'resolved' ? 'resolved' : 'firing',
      name,
      title: annotations.summary ?? name,
      severity: normalizeSeverity(labels.severity ?? labels.priority),
      summary: annotations.summary,
      description: annotations.description ?? annotations.message,
      url:
        str(a.panelURL) ??
        str(a.dashboardURL) ??
        str(a.generatorURL) ??
        annotations.runbook_url ??
        externalUrl,
      labels,
      fingerprint: str(a.fingerprint) ?? labelFingerprint(labels),
      startsAt: str(a.startsAt),
      // Alertmanager sends 0001-01-01 for alerts that have not ended.
      endsAt: endsAt && !endsAt.startsWith('0001') ? endsAt : undefined,
    };
  });
}

/** PagerDuty webhooks v3: one event per delivery. */
function fromPagerDuty(payload: Obj): NormalizedAlert[] {
  const event = obj(payload.event);
  const type = str(event.event_type) ?? '';
  const status =
    type === 'incident.triggered' || type === 'incident.reopened'
      ? 'firing'
      : type === 'incident.resolved'
        ? 'resolved'
        : null;
  if (!status) return [];
  const data = obj(event.data);
  const id = str(data.id);
  if (!id) return [];
  const title = str(data.title) ?? 'PagerDuty incident';
  const priority = str(obj(data.priority).summary);
  const service = str(obj(data.service).summary);
  return [
    {
      source: 'pagerduty',
      status,
      name: title,
      title,
      severity: normalizeSeverity(
        priority ?? (str(data.urgency) === 'high' ? 'critical' : 'warning')
      ),
      summary: title,
      url: str(data.html_url),
      labels: {
        ...(service ? { service } : {}),
        ...(priority ? { priority } : {}),
        ...(str(data.urgency) ? { urgency: str(data.urgency)! } : {}),
        ...(str(data.number) ? { number: str(data.number)! } : {}),
      },
      fingerprint: id,
      // Each trigger or reopen is its own occurrence; retries of the
      // same delivery repeat occurred_at.
      startsAt: status === 'firing' ? str(event.occurred_at) : undefined,
      endsAt: status === 'resolved' ? str(event.occurred_at) : undefined,
    },
  ];
}

/** Opsgenie outgoing webhook integration. */
function fromOpsgenie(payload: Obj): NormalizedAlert[] {
  const action = str(payload.action) ?? '';
  const status = action === 'Create' ? 'firing' : action === 'Close' ? 'resolved' : null;
  if (!status) return [];
  const alert = obj(payload.alert);
  const id = str(alert.alertId);
  if (!id) return [];
  const title = str(alert.message) ?? 'Opsgenie alert';
  const tags = Array.isArray(alert.tags) ? alert.tags.filter(t => typeof t === 'string') : [];
  const created = Number(alert.createdAt);
  return [
    {
      source: 'opsgenie',
      status,
      name: title,
      title,
      severity: normalizeSeverity(str(alert.priority)),
      summary: title,
      description: str(alert.description),
      labels: {
        ...stringMap(alert.details),
        ...(tags.length ? { tags: tags.join(',') } : {}),
        ...(str(alert.priority) ? { priority: str(alert.priority)! } : {}),
        ...(str(alert.entity) ? { entity: str(alert.entity)! } : {}),
      },
      fingerprint: str(alert.alias) ?? id,
      startsAt:
        Number.isFinite(created) && created > 0 ? new Date(created).toISOString() : undefined,
    },
  ];
}

/** The alerts in a delivery; empty for events that are not a firing or a resolution. */
/**
 * Issue alerts carry the issue under `data.issue`, rule alerts under
 * `data.event`, metric alerts under `data.metric_alert`. Actions such as
 * `assigned` or `ignored` are not alerts.
 */
function fromSentry(payload: Obj): NormalizedAlert[] {
  const data = obj(payload.data);
  const action = str(payload.action);
  const metric = obj(data.metric_alert);
  if (Object.keys(metric).length > 0) {
    const id = str(metric.id);
    if (!id) return [];
    const title = str(metric.title) ?? str(metric.alert_rule_name) ?? 'Sentry metric alert';
    return [
      {
        source: 'sentry',
        status: action === 'resolved' ? 'resolved' : 'firing',
        name: str(obj(metric.alert_rule).name) ?? title,
        title,
        severity: normalizeSeverity(action === 'warning' ? 'warning' : 'critical'),
        summary: str(data.description_title),
        url: str(data.web_url) ?? str(metric.web_url),
        labels: {},
        fingerprint: `metric:${id}`,
        startsAt: str(metric.date_started),
      },
    ];
  }

  const issue = obj(data.issue);
  const event = obj(data.event);
  const id = str(issue.id) ?? str(event.issue_id);
  if (!id) return [];
  const firing = ['created', 'triggered', 'unresolved', undefined].includes(action);
  if (!firing && action !== 'resolved') return [];
  const title = str(issue.title) ?? str(event.title) ?? 'Sentry issue';
  return [
    {
      source: 'sentry',
      status: action === 'resolved' ? 'resolved' : 'firing',
      name: title,
      title,
      severity: normalizeSeverity(str(issue.level) ?? str(event.level) ?? 'error'),
      summary: str(issue.culprit) ?? str(event.culprit),
      url: str(issue.web_url) ?? str(issue.permalink) ?? str(event.web_url),
      labels: {},
      fingerprint: `issue:${id}`,
      // A regression reopens the issue, which is a new occurrence of it.
      startsAt:
        action === 'unresolved'
          ? (str(issue.lastSeen) ?? str(issue.firstSeen))
          : (str(issue.firstSeen) ?? str(event.datetime)),
    },
  ];
}

/** `alert_cycle_key` is the same for every notification of one trigger/recover cycle. */
function fromDatadog(payload: Obj): NormalizedAlert[] {
  const id = str(payload.id) ?? str(payload.alert_id) ?? str(payload.monitor_id);
  const title = str(payload.monitor_name) ?? str(payload.alert_title) ?? str(payload.title);
  if (!id && !title) return [];
  const transition = (str(payload.alert_transition) ?? '').toLowerCase();
  const scope = str(payload.alert_scope) ?? str(payload.scope) ?? str(payload.hostname) ?? '';
  const name = title ?? 'Datadog alert';
  const tags = String(payload.tags ?? '');
  const severityTag = /(?:^|,)\s*(?:alert_)?severity:([^,]+)/.exec(tags)?.[1];
  return [
    {
      source: 'datadog',
      status: transition === 'recovered' ? 'resolved' : 'firing',
      name,
      title: name,
      severity: normalizeSeverity(severityTag?.trim() ?? str(payload.priority) ?? 'warning'),
      summary: str(payload.body) ?? str(payload.text),
      url: str(payload.link) ?? str(payload.url),
      labels: scope ? { scope } : {},
      fingerprint: `${id ?? name}:${scope}`,
      startsAt: str(payload.alert_cycle_key) ?? str(payload.last_updated) ?? str(payload.date),
    },
  ];
}

export function normalizeAlerts(source: AlertSource, payload: unknown): NormalizedAlert[] {
  const p = obj(payload);
  switch (source) {
    case 'alertmanager':
    case 'grafana':
      return fromAlertmanager(source, p);
    case 'pagerduty':
      return fromPagerDuty(p);
    case 'opsgenie':
      return fromOpsgenie(p);
    case 'sentry':
      return fromSentry(p);
    case 'datadog':
      return fromDatadog(p);
  }
}

/** Dedup key for one occurrence of an alert on one webhook. */
export function occurrenceKey(webhookId: string, alert: NormalizedAlert): string {
  const raw = `${webhookId}:${alert.fingerprint}:${alert.startsAt ?? ''}`;
  return raw.length <= 190 ? raw : `${webhookId}:${createHash('sha256').update(raw).digest('hex')}`;
}
