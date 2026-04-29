# Operari Grafana dashboard

`operari-runs.json` is a single-pane dashboard for the metrics the Operari
backend exports at `/metrics` (Prometheus scrape format).

## Enable the metrics endpoint

The endpoint is **off by default**. Set the env var on the backend:

```bash
OPERARI_METRICS_ENABLED=true
```

Then `GET /metrics` returns Prometheus text. The endpoint is unauthenticated by
design — gate it with network policy, not bearer tokens (this is the standard
Prometheus convention).

## Series exported

Custom Operari metrics:

| Name                            | Type      | Labels                    |
| ------------------------------- | --------- | ------------------------- |
| `operari_runs_started_total`    | Counter   | tenant, trigger           |
| `operari_runs_finished_total`   | Counter   | tenant, trigger, status   |
| `operari_run_duration_seconds`  | Histogram | tenant, status            |
| `operari_steps_finished_total`  | Counter   | tenant, step_type, status |
| `operari_step_duration_seconds` | Histogram | tenant, step_type, status |

Plus standard Node.js process metrics under the `operari_node_*` prefix
(eventloop lag, CPU, GC, heap, fd count) — registered via prom-client's
`collectDefaultMetrics`.

We deliberately do **not** label by `runbook_id` — a busy tenant has hundreds
of runbooks, and the cross-product blows the cardinality fast. Per-runbook
breakdowns belong in traces (Jaeger / Tempo), not in metrics.

## Scrape config

A minimal Prometheus job:

```yaml
scrape_configs:
  - job_name: operari
    metrics_path: /metrics
    static_configs:
      - targets: ['operari-backend:4000']
```

If you run multiple Operari backends, use a service-discovery target list. The
dashboard's `tenant` template variable auto-populates from the labels Prometheus
sees, so multi-tenant deployments get a per-tenant filter for free.

## Importing the dashboard

In Grafana: **Dashboards → New → Import**, then paste the contents of
`operari-runs.json` or upload the file. Pick your Prometheus data source when
prompted.
