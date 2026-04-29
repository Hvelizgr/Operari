import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  type Registry,
  Registry as PromRegistry,
} from 'prom-client';

/**
 * Prometheus metrics surface for Operari.
 *
 * Why prom-client instead of the @opentelemetry/sdk-metrics + Prom
 * exporter combo: prom-client is a tight, single-purpose library with
 * a stable text format and zero ramp-up. The OTel metrics SDK is
 * still finding its shape, the Prom exporter pulls in the SDK
 * machinery, and no one running Operari today has asked for
 * OTLP-pushed metrics — they want a /metrics endpoint Grafana can
 * scrape and a dashboard JSON file to import.
 *
 * The metric names follow the prom-client convention: snake_case,
 * `_total` suffix for counters, `_seconds` for time histograms.
 * The `operari_` prefix protects against future name collisions
 * with default Node metrics or with any metrics a self-hoster's
 * own services emit when scraped from the same Prometheus.
 *
 * Cardinality budget: every label combination generates a separate
 * series. We deliberately do NOT emit `runbook_id` or `runbook_slug`
 * as a label because a busy tenant can have hundreds of runbooks,
 * and the cross-product with `tenant.id` blows the cardinality very
 * quickly. Per-runbook breakdowns belong in traces (Jaeger/Tempo),
 * not in metrics.
 */

export interface RunMetrics {
  recordRunStarted(input: { tenantId: string; trigger: string; runnerType?: string }): void;
  recordRunFinished(input: {
    tenantId: string;
    trigger: string;
    success: boolean;
    durationSeconds: number;
  }): void;
  recordStepFinished(input: {
    tenantId: string;
    stepType: string;
    success: boolean;
    durationSeconds: number;
  }): void;
  /**
   * Counts every webhook receipt. `status` mirrors the receipt
   * status enum (accepted / rejected_signature / rejected_inactive /
   * error) so dashboards can pivot on signature rejection rates and
   * separately on engine errors. `source` is the runbook trigger
   * provider (sentry / datadog / github / custom).
   */
  recordWebhookReceived(input: { tenantId: string; source: string; status: string }): void;
}

interface BuiltMetrics extends RunMetrics {
  registry: Registry;
}

let cached: BuiltMetrics | null = null;

/**
 * Singleton because the prom-client registry is shared process-wide
 * and double-registering a metric name throws. Tests that need
 * isolation can call `buildMetrics(new PromRegistry())` directly.
 */
export function getMetrics(): BuiltMetrics {
  if (cached) return cached;
  cached = buildMetrics(new PromRegistry());
  return cached;
}

export function resetMetricsForTesting(): void {
  cached = null;
}

export function buildMetrics(registry: Registry): BuiltMetrics {
  // Process / runtime metrics — eventloop lag, CPU, GC, heap, fd
  // count. The whole reason a self-hoster wants a /metrics endpoint
  // in the first place; the Operari-specific metrics below add to
  // that, they don't replace it.
  collectDefaultMetrics({ register: registry, prefix: 'operari_node_' });

  const runsStarted = new Counter({
    name: 'operari_runs_started_total',
    help: 'Total runs started, labelled by tenant + trigger source.',
    labelNames: ['tenant', 'trigger'],
    registers: [registry],
  });

  const runsFinished = new Counter({
    name: 'operari_runs_finished_total',
    help: 'Total runs finished, labelled by tenant + trigger + final status (success/failed).',
    labelNames: ['tenant', 'trigger', 'status'],
    registers: [registry],
  });

  const runDuration = new Histogram({
    name: 'operari_run_duration_seconds',
    help: 'Run wallclock duration in seconds, labelled by tenant + status.',
    labelNames: ['tenant', 'status'],
    // 1s, 5s, 30s, 2m, 10m, 30m, 2h. Wider than typical web request
    // buckets because runbooks frequently include `wait` steps and
    // approval gates that legitimately span hours.
    buckets: [1, 5, 30, 120, 600, 1800, 7200],
    registers: [registry],
  });

  const stepsFinished = new Counter({
    name: 'operari_steps_finished_total',
    help: 'Total steps finished, labelled by tenant + step_type + status.',
    labelNames: ['tenant', 'step_type', 'status'],
    registers: [registry],
  });

  const stepDuration = new Histogram({
    name: 'operari_step_duration_seconds',
    help: 'Step wallclock duration in seconds, labelled by tenant + step_type + status.',
    labelNames: ['tenant', 'step_type', 'status'],
    // Tighter buckets than runs — a single step that takes 2 hours is
    // usually an approval gate, which is captured separately in the
    // run-level histogram above.
    buckets: [0.05, 0.25, 1, 5, 30, 120, 600],
    registers: [registry],
  });

  const webhookReceived = new Counter({
    name: 'operari_webhook_received_total',
    help: 'Total webhook deliveries received, labelled by tenant + source + receipt status (accepted / rejected_signature / rejected_inactive / error).',
    labelNames: ['tenant', 'source', 'status'],
    registers: [registry],
  });

  return {
    registry,
    recordRunStarted({ tenantId, trigger }) {
      runsStarted.labels({ tenant: tenantId, trigger }).inc(1);
    },
    recordRunFinished({ tenantId, trigger, success, durationSeconds }) {
      const status = success ? 'success' : 'failed';
      runsFinished.labels({ tenant: tenantId, trigger, status }).inc(1);
      runDuration.labels({ tenant: tenantId, status }).observe(durationSeconds);
    },
    recordStepFinished({ tenantId, stepType, success, durationSeconds }) {
      const status = success ? 'success' : 'failed';
      stepsFinished.labels({ tenant: tenantId, step_type: stepType, status }).inc(1);
      stepDuration
        .labels({ tenant: tenantId, step_type: stepType, status })
        .observe(durationSeconds);
    },
    recordWebhookReceived({ tenantId, source, status }) {
      webhookReceived.labels({ tenant: tenantId, source, status }).inc(1);
    },
  };
}

/**
 * No-op metrics used by RunTracer when metrics are disabled. Saves
 * the every-step `if (metrics)` checks and keeps the call sites
 * unconditional.
 */
export const NULL_METRICS: RunMetrics = {
  recordRunStarted() {},
  recordRunFinished() {},
  recordStepFinished() {},
  recordWebhookReceived() {},
};
