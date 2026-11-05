import { createHash } from 'crypto';

/** Webhook sources whose payload is one or more alerts. */
export const ALERT_SOURCES = ['alertmanager', 'grafana', 'pagerduty', 'opsgenie'] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

export function isAlertSource(source: string): source is AlertSource {
  return (ALERT_SOURCES as readonly string[]).includes(source);
}

export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info' | 'unknown';

/**
 * One alert, whatever sent it. `title`, `url`, `severity` and `summary`
 * match the envelope the Sentry and Datadog parsers already put in
 * vars.alert, so a runbook reads the same fields for every source.
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
  }
}

/** Dedup key for one occurrence of an alert on one webhook. */
export function occurrenceKey(webhookId: string, alert: NormalizedAlert): string {
  const raw = `${webhookId}:${alert.fingerprint}:${alert.startsAt ?? ''}`;
  return raw.length <= 190 ? raw : `${webhookId}:${createHash('sha256').update(raw).digest('hex')}`;
}
