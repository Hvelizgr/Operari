import { Registry as PromRegistry } from 'prom-client';

import { buildMetrics } from '../../observability/metrics';

describe('Operari Prometheus metrics', () => {
  it('emits operari_runs_started_total with tenant + trigger labels on a run start', async () => {
    const registry = new PromRegistry();
    const metrics = buildMetrics(registry);

    metrics.recordRunStarted({ tenantId: 't1', trigger: 'manual' });
    metrics.recordRunStarted({ tenantId: 't1', trigger: 'manual' });
    metrics.recordRunStarted({ tenantId: 't2', trigger: 'webhook' });

    const text = await registry.metrics();
    expect(text).toContain('operari_runs_started_total{tenant="t1",trigger="manual"} 2');
    expect(text).toContain('operari_runs_started_total{tenant="t2",trigger="webhook"} 1');
  });

  it('records run duration in the labelled histogram on finish', async () => {
    const registry = new PromRegistry();
    const metrics = buildMetrics(registry);

    metrics.recordRunFinished({
      tenantId: 't1',
      trigger: 'manual',
      success: true,
      durationSeconds: 12,
    });
    metrics.recordRunFinished({
      tenantId: 't1',
      trigger: 'webhook',
      success: false,
      durationSeconds: 0.5,
    });

    const text = await registry.metrics();
    expect(text).toContain(
      'operari_runs_finished_total{tenant="t1",trigger="manual",status="success"} 1'
    );
    expect(text).toContain(
      'operari_runs_finished_total{tenant="t1",trigger="webhook",status="failed"} 1'
    );
    // Histogram bucket le=30 covers 12s on a successful run.
    expect(text).toMatch(
      /operari_run_duration_seconds_bucket\{le="30",tenant="t1",status="success"\} 1/
    );
    // Histogram bucket le=1 covers the 0.5s failed run.
    expect(text).toMatch(
      /operari_run_duration_seconds_bucket\{le="1",tenant="t1",status="failed"\} 1/
    );
  });

  it('records steps with step_type label so dashboards can filter by executor kind', async () => {
    const registry = new PromRegistry();
    const metrics = buildMetrics(registry);

    metrics.recordStepFinished({
      tenantId: 't1',
      stepType: 'shell',
      success: true,
      durationSeconds: 0.1,
    });
    metrics.recordStepFinished({
      tenantId: 't1',
      stepType: 'operari.httpRequest',
      success: false,
      durationSeconds: 5,
    });

    const text = await registry.metrics();
    expect(text).toContain(
      'operari_steps_finished_total{tenant="t1",step_type="shell",status="success"} 1'
    );
    expect(text).toContain(
      'operari_steps_finished_total{tenant="t1",step_type="operari.httpRequest",status="failed"} 1'
    );
  });

  it('exposes the standard node process metrics under operari_node_*', async () => {
    const registry = new PromRegistry();
    buildMetrics(registry);

    const text = await registry.metrics();
    // collectDefaultMetrics installs all of these. We pin a couple of
    // representative names so a future prom-client upgrade that
    // renames the defaults shows up here.
    expect(text).toContain('operari_node_process_cpu_user_seconds_total');
    expect(text).toContain('operari_node_process_resident_memory_bytes');
    expect(text).toContain('operari_node_nodejs_eventloop_lag_seconds');
  });

  it('returns the registry contentType so the route can set the right header', () => {
    const registry = new PromRegistry();
    const metrics = buildMetrics(registry);
    expect(metrics.registry.contentType).toMatch(/text\/plain/);
    expect(metrics.registry.contentType).toMatch(/version=/);
  });
});
