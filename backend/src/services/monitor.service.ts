import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../config/logger.config';
import { MonitorAlertService } from './monitor-alert.service';

/**
 * MonitorService — periodic watchdog over runbook health.
 *
 * Three check types in v0.1:
 *   - last_success_within: must have a SUCCESS run in the last N minutes
 *   - no_run_within:       must have ANY run in the last N minutes
 *   - failure_rate_above:  fail if more than `threshold` (0..1) of runs
 *                          in last `windowMinutes` failed
 *
 * Evaluated by a 1-minute polling worker started in server.ts. The
 * worker is intentionally simple (a setInterval) — Monitors are not on
 * a hot path and a per-tenant cron is overkill at this stage.
 */
export type MonitorCheckType = 'last_success_within' | 'no_run_within' | 'failure_rate_above';

export interface MonitorCheckConfig {
  windowMinutes: number;
  threshold?: number; // 0..1, only for failure_rate_above
}

export interface MonitorInput {
  name: string;
  description?: string | null;
  workflowId: string;
  checkType: MonitorCheckType;
  checkConfig: MonitorCheckConfig;
  isEnabled?: boolean;
}

export class MonitorService {
  private readonly alertService: MonitorAlertService;

  constructor(
    private prisma: PrismaClient,
    alertService?: MonitorAlertService
  ) {
    this.alertService = alertService ?? new MonitorAlertService();
  }

  list(tenantId: string) {
    return this.prisma.monitor.findMany({
      where: { tenantId },
      include: {
        workflow: { select: { id: true, slug: true, name: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.monitor.findFirst({
      where: { id, tenantId },
      include: {
        workflow: { select: { id: true, slug: true, name: true } },
      },
    });
  }

  listEvents(tenantId: string, monitorId: string, limit = 50) {
    return this.prisma.monitorEvent.findMany({
      where: { monitorId, monitor: { tenantId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async create(tenantId: string, input: MonitorInput) {
    const wf = await this.prisma.runbook.findFirst({
      where: { id: input.workflowId, tenantId },
      select: { id: true },
    });
    if (!wf) throw new Error('workflow_not_found_in_tenant');
    return this.prisma.monitor.create({
      data: {
        tenantId,
        workflowId: input.workflowId,
        name: input.name,
        description: input.description ?? null,
        checkType: input.checkType,
        checkConfig: input.checkConfig as unknown as Prisma.InputJsonValue,
        isEnabled: input.isEnabled ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, patch: Partial<MonitorInput>) {
    const existing = await this.prisma.monitor.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;
    return this.prisma.monitor.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.checkType !== undefined && { checkType: patch.checkType }),
        ...(patch.checkConfig !== undefined && {
          checkConfig: patch.checkConfig as unknown as Prisma.InputJsonValue,
        }),
        ...(patch.isEnabled !== undefined && { isEnabled: patch.isEnabled }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.monitor.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;
    await this.prisma.monitor.delete({ where: { id } });
    return existing;
  }

  /**
   * Evaluate a single monitor against the live execution data and
   * return the new status. Pure-ish — only reads, no writes here.
   * The worker takes the result and decides whether to persist a
   * status transition + MonitorEvent.
   */
  async evaluate(monitor: {
    id: string;
    tenantId: string;
    workflowId: string;
    checkType: string;
    checkConfig: unknown;
  }): Promise<{ status: 'OK' | 'FIRING'; reason: string }> {
    const cfg = (monitor.checkConfig ?? {}) as MonitorCheckConfig;
    const windowMinutes = Math.max(1, cfg.windowMinutes ?? 60);
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    if (monitor.checkType === 'last_success_within') {
      const lastSuccess = await this.prisma.execution.findFirst({
        where: {
          tenantId: monitor.tenantId,
          workflowId: monitor.workflowId,
          status: 'SUCCESS',
          startedAt: { gte: since },
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });
      return lastSuccess
        ? { status: 'OK', reason: `success_within_${windowMinutes}m` }
        : {
            status: 'FIRING',
            reason: `no_success_in_last_${windowMinutes}m`,
          };
    }

    if (monitor.checkType === 'no_run_within') {
      const anyRun = await this.prisma.execution.findFirst({
        where: {
          tenantId: monitor.tenantId,
          workflowId: monitor.workflowId,
          startedAt: { gte: since },
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });
      return anyRun
        ? { status: 'OK', reason: `run_within_${windowMinutes}m` }
        : {
            status: 'FIRING',
            reason: `no_run_in_last_${windowMinutes}m`,
          };
    }

    if (monitor.checkType === 'failure_rate_above') {
      const threshold = cfg.threshold ?? 0.5;
      const groups = await this.prisma.execution.groupBy({
        by: ['status'],
        where: {
          tenantId: monitor.tenantId,
          workflowId: monitor.workflowId,
          startedAt: { gte: since },
        },
        _count: { _all: true },
      });
      const total = groups.reduce((s, g) => s + g._count._all, 0);
      if (total === 0) {
        return { status: 'OK', reason: 'no_runs_in_window' };
      }
      const failed = groups.find(g => g.status === 'FAILED')?._count._all ?? 0;
      const rate = failed / total;
      if (rate > threshold) {
        return {
          status: 'FIRING',
          reason: `failure_rate=${rate.toFixed(2)}>${threshold}`,
        };
      }
      return {
        status: 'OK',
        reason: `failure_rate=${rate.toFixed(2)}<=${threshold}`,
      };
    }

    return { status: 'OK', reason: `unknown_check_type:${monitor.checkType}` };
  }

  /**
   * Evaluate all enabled monitors. Called by the worker on a 1-minute
   * tick. Persists status + appends a MonitorEvent only when the
   * status flips, so the events table stays sparse.
   */
  async evaluateAll(): Promise<void> {
    const monitors = await this.prisma.monitor.findMany({
      where: { isEnabled: true },
    });

    // Prefetch tenant-default alert channels for every tenant that
    // owns a firing-eligible monitor in this batch. One findMany keeps
    // the tick O(tenants) instead of O(monitors) — a tenant with 50
    // monitors still only triggers one lookup.
    const tenantDefaults = await this.resolveTenantAlertDefaults(monitors);

    for (const m of monitors) {
      try {
        const result = await this.evaluate(m);
        const flipped = result.status !== m.status;
        await this.prisma.monitor.update({
          where: { id: m.id },
          data: {
            status: result.status,
            lastCheckAt: new Date(),
            lastReason: result.reason,
            ...(flipped &&
              result.status === 'FIRING' && {
                lastFiredAt: new Date(),
              }),
          },
        });
        if (flipped) {
          await this.prisma.monitorEvent.create({
            data: {
              monitorId: m.id,
              status: result.status,
              reason: result.reason,
            },
          });
          // Only the OK → FIRING edge triggers a human-facing alert.
          // A FIRING → OK flip writes the MonitorEvent (UI recovery
          // banner) but we don't page the operator for a self-heal.
          if (result.status === 'FIRING') {
            // Coalesce per-monitor overrides with tenant-wide defaults.
            // Per-monitor wins; absent per-monitor → tenant default; no
            // tenant default → null, MonitorAlertService no-ops that
            // channel cleanly.
            const fallback = tenantDefaults.get(m.tenantId);
            const effectiveWebhook = m.alertWebhookUrl ?? fallback?.webhookUrl ?? null;
            const effectiveEmail = m.alertEmail ?? fallback?.email ?? null;
            void this.alertService
              .fire({
                monitor: {
                  id: m.id,
                  name: m.name,
                  alertWebhookUrl: effectiveWebhook,
                  alertEmail: effectiveEmail,
                  workflowId: m.workflowId,
                },
                reason: result.reason,
              })
              .catch(err => {
                logger.error({ err, monitorId: m.id }, 'Monitor alert dispatch threw');
              });
          }
        }
      } catch (err) {
        logger.error({ err, monitorId: m.id }, 'Monitor evaluation failed');
      }
    }
  }

  /**
   * Prefetch one active TenantAlertChannel row per tenant that owns
   * a monitor in this tick. The tick is short-lived so we don't cache
   * across calls — configuration changes land on the next tick.
   *
   * Returns a Map keyed by tenantId; tenants without any active
   * channel are absent (caller uses `?? null` fallback on each
   * channel field).
   */
  private async resolveTenantAlertDefaults(
    monitors: Array<{ tenantId: string }>
  ): Promise<Map<string, { webhookUrl: string | null; email: string | null }>> {
    const tenantIds = Array.from(new Set(monitors.map(m => m.tenantId)));
    if (tenantIds.length === 0) return new Map();

    const rows = await this.prisma.tenantAlertChannel.findMany({
      where: { tenantId: { in: tenantIds }, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    // Keep the oldest active row per tenant — that's the "stable
    // default". An admin staging a replacement creates a new row and
    // flips isActive on the old one when ready, so "oldest active"
    // means "the one the operator chose to keep live".
    const out = new Map<string, { webhookUrl: string | null; email: string | null }>();
    for (const row of rows) {
      if (!out.has(row.tenantId)) {
        out.set(row.tenantId, { webhookUrl: row.webhookUrl, email: row.email });
      }
    }
    return out;
  }
}
