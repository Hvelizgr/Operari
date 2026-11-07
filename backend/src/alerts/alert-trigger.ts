import type { Prisma, PrismaClient } from '@prisma/client';

import { recordWebhookEvent } from '../utils/webhook-dedup';
import {
  type AlertSource,
  normalizeAlerts,
  type NormalizedAlert,
  occurrenceKey,
} from './normalize';

/** More firing alerts than this in one delivery are recorded but start no run. */
export const MAX_RUNS_PER_DELIVERY = 10;

const DEDUP_SOURCE = 'alert';

export interface AlertWebhook {
  id: string;
  tenantId: string;
  runbookId: string;
  source: AlertSource;
  userId: string;
}

export interface AlertTriggerResult {
  alerts: number;
  started: Array<{ fingerprint: string; runId: string }>;
  duplicates: number;
  resolved: number;
  skipped: number;
}

export type StartRun = (input: Record<string, unknown>) => Promise<{ id: string }>;

/** Source-specific variables runbooks already read, such as `issue_title`. */
export type ExtraVariables = (payload: unknown) => Record<string, unknown>;

/**
 * Starts one run per new occurrence of a firing alert. Alertmanager and
 * Grafana repeat a firing alert on every group interval, and PagerDuty
 * retries deliveries; the occurrence key (webhook, fingerprint, start
 * time) is claimed with a unique insert, so each occurrence starts
 * exactly one run however often it is sent. A resolution starts nothing;
 * it is stamped on the runs that alert started.
 */
export async function triggerAlertRuns(
  prisma: PrismaClient,
  webhook: AlertWebhook,
  payload: unknown,
  startRun: StartRun,
  now: () => Date = () => new Date(),
  extraVariables: ExtraVariables = () => ({})
): Promise<AlertTriggerResult> {
  const alerts = normalizeAlerts(webhook.source, payload);
  const result: AlertTriggerResult = {
    alerts: alerts.length,
    started: [],
    duplicates: 0,
    resolved: 0,
    skipped: 0,
  };

  for (const alert of alerts.filter(a => a.status === 'firing')) {
    if (result.started.length >= MAX_RUNS_PER_DELIVERY) {
      result.skipped++;
      continue;
    }
    const key = occurrenceKey(webhook.id, alert);
    const claim = await recordWebhookEvent(prisma, {
      source: DEDUP_SOURCE,
      eventId: key,
      tenantId: webhook.tenantId,
    });
    if (claim.duplicate) {
      result.duplicates++;
      continue;
    }
    let run: { id: string };
    try {
      const extra = extraVariables(payload);
      run = await startRun({
        ...extra,
        source: webhook.source,
        event: extra.event ?? 'firing',
        alert: { ...(extra.alert as object | undefined), ...alert },
        payload,
      });
    } catch (err) {
      // Give the occurrence back so the sender's retry starts it.
      await prisma.webhookEvent
        .deleteMany({ where: { source: DEDUP_SOURCE, eventId: key } })
        .catch(() => undefined);
      throw err;
    }
    result.started.push({ fingerprint: alert.fingerprint, runId: run.id });
    await prisma.execution
      .update({
        where: { id: run.id },
        data: { metadata: { alert: alertMeta(alert) } as Prisma.InputJsonValue },
      })
      .catch(() => undefined);
  }

  for (const alert of alerts.filter(a => a.status === 'resolved')) {
    const runs = await prisma.execution.findMany({
      where: {
        tenantId: webhook.tenantId,
        runbookId: webhook.runbookId,
        metadata: { path: ['alert', 'fingerprint'], equals: alert.fingerprint },
      },
      select: { id: true, metadata: true },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });
    for (const run of runs) {
      const meta = (run.metadata ?? {}) as Record<string, unknown>;
      const prev = (meta.alert ?? {}) as Record<string, unknown>;
      if (prev.resolvedAt) continue;
      await prisma.execution.update({
        where: { id: run.id },
        data: {
          metadata: {
            ...meta,
            alert: { ...prev, resolvedAt: alert.endsAt ?? now().toISOString() },
          } as Prisma.InputJsonValue,
        },
      });
      result.resolved++;
    }
  }
  return result;
}

function alertMeta(alert: NormalizedAlert) {
  return {
    source: alert.source,
    fingerprint: alert.fingerprint,
    name: alert.name,
    severity: alert.severity,
    startsAt: alert.startsAt ?? null,
  };
}
