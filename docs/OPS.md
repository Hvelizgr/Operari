# Operating Operari in production

Production-day-1 checklist for operating the Operari backend. Covers uptime monitoring, log aggregation, error tracking, and the endpoints you will want to point every one of those tools at.

The backend is a plain Node + Express process. Nothing here assumes Kubernetes — anything that runs a Docker container works.

---

## Health endpoints

Two endpoints, two different jobs. Point the right tool at the right one.

### `GET /live` — liveness

Pure "the process is responsive". Never touches the database or Redis. Always returns `200` as long as the event loop is alive.

```json
{
  "status": "ok",
  "timestamp": "2026-04-17T20:00:00.000Z",
  "version": "git-abc123",
  "uptimeSeconds": 8421
}
```

**Use this for:**

- Kubernetes `livenessProbe` (a failure restarts the pod)
- External uptime monitors (UptimeRobot, Better Stack, Checkly) that should page you only when the process is actually dead — not when the DB is down
- Load balancer "is this instance alive" checks that should NOT remove a healthy instance during a transient postgres blip

### `GET /health` — readiness

Checks the two stateful dependencies — **postgres** and **redis** — with a 1.5s timeout each. Redis is reported separately and never fails the overall probe (it's optional in self-host).

```json
{
  "status": "ok",
  "timestamp": "2026-04-17T20:00:00.000Z",
  "version": "git-abc123",
  "uptimeSeconds": 8421,
  "deps": {
    "postgres": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

Returns `503` when postgres is unreachable (status becomes `degraded`).

**Use this for:**

- Kubernetes `readinessProbe` (a failure removes the pod from the Service load-balancer but does NOT restart it — the right behavior during a DB failover)
- Deep monitors that should alert when Operari can't serve traffic, not just when the process is wedged

### Suggested Kubernetes probes

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 4001
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /health
    port: 4001
  periodSeconds: 5
  failureThreshold: 2
```

### Suggested UptimeRobot / Better Stack / Checkly config

Most of the time you want both:

| Monitor                                   | URL       | Alert on |
| ----------------------------------------- | --------- | -------- |
| "process up" — pages someone at 3am       | `/live`   | Non-200  |
| "service healthy" — pages the on-call DBA | `/health` | Non-200  |

Rate-limited? Good news: `/live` and `/health` bypass the rate limiter, so a 30s check interval across multiple monitors won't consume your per-IP budget.

---

## Log aggregation

The backend uses [pino](https://getpino.io) in JSON mode by default (pretty-printing only in development). Every log line is already a single JSON object with stable fields: `time`, `level`, `msg`, `req`, `requestId`, `userId`, `tenantId`. That's the shape every log aggregator wants.

### Redaction

The logger redacts sensitive paths before emitting. See `REDACT_PATHS` in `backend/src/config/logger.config.ts`. Covered:

- `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key` request headers
- Webhook signatures: `X-Webhook-Signature`, `X-Hub-Signature-256`, `X-Stripe-Signature`
- Any log object key named `password`, `passwordHash`, `newPassword`, `currentPassword`, `token`, `secret`, `apiKey`, `api_key`, `totpCode`, `signature`

Add a path when you find a new sensitive field — one line in that array, no code changes at call sites.

### Ship pino → your aggregator

All of these assume you run the container with stdout captured. None require code changes.

#### Axiom

```bash
docker run --rm \
  --log-driver=axiom \
  --log-opt axiom-dataset=operari-prod \
  --log-opt axiom-token=$AXIOM_TOKEN \
  operari-backend
```

Or stream via `pino-axiom`:

```bash
node dist/server.js | npx pino-axiom --dataset operari-prod
```

#### Grafana Loki (self-host)

Add a Promtail sidecar that tails the container's stdout and ships to a Loki endpoint:

```yaml
scrape_configs:
  - job_name: operari
    static_configs:
      - targets: [localhost]
        labels:
          job: operari-backend
          __path__: /var/log/operari/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            requestId: requestId
```

#### Datadog

Datadog Agent picks up container stdout automatically when the `DD_LOGS_ENABLED=true` env is set on the agent. Pino's JSON format is first-class — no parser config needed.

#### AWS CloudWatch

`awslogs` Docker log driver:

```bash
docker run \
  --log-driver=awslogs \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-group=operari-backend \
  operari-backend
```

### Minimal query recipes

Every log line has `requestId`. When a user reports an error, grab the `requestId` from the response's `X-Request-Id` header (set by `requestLogger` middleware) and search:

```
requestId:"ea7c…"   # every log line for that request
userId:"usr_…"       # every request from one user
level:error          # every error in the last hour
tenantId:"tnt_…" level:error   # per-tenant error rate
```

---

## Error tracking (Sentry)

See `backend/src/config/sentry.config.ts`. No-op by default; activates when `SENTRY_DSN` is set.

```bash
# .env — set these in prod only
SENTRY_DSN=https://public@sentry.io/project-id
SENTRY_ENV=production
SENTRY_TRACES_SAMPLE_RATE=0.1   # 10% of transactions traced
APP_VERSION=git-abc123          # set from CI; shows up as Release in Sentry
```

PII scrubbing is already enabled (`sendDefaultPii: false`) and a `beforeSend` hook strips signature headers + password/token body keys before events leave the process.

**Release tagging:** `APP_VERSION` is the same value `/health` and `/live` return under `version`, so a release grouped in Sentry correlates 1:1 with whatever the uptime monitor saw at that timestamp.

---

## Recommended monitors at launch

One-hour setup, covers 95% of real incidents:

1. **UptimeRobot** / **Better Stack** → `/live`, 1-min interval, SMS + email alert
2. **UptimeRobot** / **Better Stack** → `/health`, 5-min interval, email alert (alerts you to DB issues without pager-duty noise)
3. **Sentry** → set the project alert to "new issue" and "regression" (that's the default)
4. **Log aggregator** → a saved query for `level:error` rate (alert when the 5-min rate jumps 3x baseline)
5. **Stripe dashboard** → webhook failure alerts (Stripe native)

Add real dashboards once you have customers. Pre-launch, those five monitors catch everything.
