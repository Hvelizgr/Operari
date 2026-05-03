# Operari

**Open-source runbook automation for SREs and platform engineers.**
Visual, executable, dev-first. Stop maintaining deploy procedures in Confluence.

[![License: AGPL v3](https://img.shields.io/badge/server-AGPL_v3-blue.svg)](./LICENSE)
[![SDK: MIT](https://img.shields.io/badge/sdk_+_cli-MIT-green.svg)](./packages/sdk/LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests: 1375 passing](https://img.shields.io/badge/tests-1375_passing-brightgreen.svg)](#status)
[![Status: pre-launch alpha](https://img.shields.io/badge/status-pre--launch_alpha-orange.svg)](#status)

> Operari is in **pre-launch alpha**. The status section below tells you exactly
> what works and what doesn't — no roadmap-ware. The repo started as
> Operari (an n8n-style generic workflow editor) and pivoted to Operari
> in April 2026; some folder names still carry the legacy. The pivot is
> documented in [`docs/rebranding-and-editor-audit.md`](./docs/rebranding-and-editor-audit.md)
> and [`docs/post-pivot-cleanup-audit.md`](./docs/post-pivot-cleanup-audit.md).
>
> Recent ship log: [`CHANGELOG.md`](./CHANGELOG.md). Operations + uptime + log
> aggregation recipes: [`docs/OPS.md`](./docs/OPS.md).

---

## The 60-second pitch

Today the procedures your team runs at 3am — deploys, migrations, secret
rotation, incident response, post-mortems — live in some combination of:

- A Confluence page nobody updated in 8 months
- A bash script only one person understands
- A Notion doc, three Slack threads, and one engineer's head

Rundeck costs $125/user/month and is enterprise-heavy. StackStorm is
abandonware. Backstage catalogs services but doesn't _execute_ anything.
incident.io is post-incident, not pre. There is no dev-first, open-source,
visual-and-executable runbook tool aimed at SREs at small-to-mid teams.

Operari is that tool. A runbook is a versioned graph of steps. Each step
runs a real command in a sandboxed runner (`kubectl`, `aws`, `gh`, `bash`).
Steps support retries, conditional gates, secret references, human
approval, and an AI side-panel that diagnoses when something fails. The
whole thing round-trips between the visual canvas and a YAML you can
commit to git.

---

## What works today

This list is conservative and hand-verified against the test suite, not the roadmap.

**Editing**

- Visual canvas with drag/drop, undo/redo, autosave, command palette, keyboard shortcuts
- YAML round-trip — view any runbook as canonical YAML, edit it, save back, never lose state
- Per-step retry policy (count, fixed/exponential backoff, max delay)
- Per-step `runIf` / `skipIf` template gates
- Secret picker that references credentials by id (`{{secrets.<account>}}`); the runbook engine pre-resolves each reference at run time through the connected-account vault, with one `secret.accessed` audit event per unique secret per step
- Schedule UI with eight cron presets plus a validated custom expression
- Trigger config: webhook URLs and one-time secrets per runbook for GitHub / Sentry / Datadog / custom

**Execution**

- ~17 step types with real executors today: `shell`, `ssh`, `operari.httpRequest`, `operari.database` (Postgres health / introspect / read-only query, with optional SSH tunnel via bastion), `kubectl` (kubeconfig from a connected-account secret, materialised to a per-run tempfile then unlinked), `approval`, `notify`, `wait`, `operari.cron` (trigger), `operari.webhook` (trigger), `github.commitFile`, `runbook` (sub-runbook composition with sync/async modes, cycle detection, 5-level depth cap), plus the legacy editor executors promoted to the palette (`Email`, `Switch`, `Loop` / `operari.loop`, `Condition` / `operari.if`, `Transform`, `StoreGet`, `StoreSet`), and `custom.frame` / `custom.note` for visual organization. Earlier drafts of this README listed 20 types — that was vapor inherited from the n8n-era. The remaining n8n vapor (`docker`, `awsS3`, `agent`, `set`) still has no backend executor and stays out of the palette to avoid promising what we cannot run.
- Sandboxed runners with three backends: local process, Docker container, Fly.io machine
- Real-time stdout / stderr streaming over Socket.IO + durable Redis stream backing
- Human approval gates that suspend the run and resume on `grant`/`reject`
- Replay from any step in any historical run
- Run cancellation with propagation to the runner

**Operating**

- Approval inbox at `/inbox` with status filters and inline grant/reject
- Run history at `/runs` with status filters, ETA from past runs, cursor pagination
- Run detail timeline at `/runs/:id` with per-step output, error blocks, replay-from-step button, and a live-tail event log (SSE backed by Redis Streams + a durable Postgres mirror) that auto-follows mid-run and pauses on manual scroll
- AI assist side-panel that takes the failed step's stdout/stderr/exit-code as prompt context and streams a diagnosis. The orchestrator has read-only tool access to recent runs, step logs, full run details, error search, and the runbook list — Vercel AI SDK `tools` parameter wired in `backend/src/agent/orchestrator.ts`. Two write tools (`grant_approval`, `reject_approval`) are gated behind `OPERARI_AGENT_WRITE_TOOLS=true`
- Hash-chained immutable audit log (SHA-256) with a CLI to verify the chain (`operari audit verify`)
- RBAC with custom roles, role assignments, and audit events on grant/revoke
- OpenTelemetry: every run is a trace, every step is a span

**Auth + multi-tenancy**

- Pluggable AuthProvider — JWT for self-host, WorkOS for cloud, single env flip to swap
- Email/password register + login with bcrypt 12 rounds, generic error messages (no user enumeration), and a 5-req/min rate limit layered both per-IP and per-email so distributed credential stuffing also gets blocked
- Social login via Google + GitHub OAuth 2. Account linking by verified email — one user can have password + Google + GitHub against the same inbox. Providers are fully optional; without creds the `/api/auth/{provider}` route returns 501 and the frontend hides the button
- Connected accounts (GitHub today): a separate OAuth flow at `/api/connected-accounts/github/oauth/{start,callback}` lets a logged-in user link their GitHub account so the runbook engine can post commit statuses, write files via `github.commitFile`, and list repo metadata. The token is encrypted at rest with the per-tenant key, every read emits a `secret.accessed` audit event, and the user can disconnect from Settings → Connected accounts at any time
- Dual-transport session: `Authorization: Bearer` for SDK/CLI clients, HttpOnly `SameSite=Lax` cookie for the web UI. Cookie's `Secure` flag auto-detects request protocol so local HTTP and prod HTTPS both work without a config flip
- Password reset flow — 30-minute single-use tokens, SHA-256-hashed at rest, invalidates prior reset tokens on both request and consumption
- Email verification — 7-day tokens, auto-sent at register, dismissible banner in the dashboard until clicked. OAuth users land pre-verified
- MFA/TOTP (RFC 6238) — `node:crypto`-based implementation with window±30s clock drift. Enroll flow returns a scannable `otpauth://` URL; disable requires both current password and a valid code
- Session revocation via Redis JTI denylist — logout actually invalidates the token mid-TTL. Graceful degrade to stateless JWT when Redis is absent
- HIBP breached-password check on register + reset + change-password — k-anonymity call that never sends the password itself. Fail-open so a HIBP outage never blocks signups
- Team invites — admins send 7-day single-use links; invitees join the inviter's tenant directly (not a fresh one). Acceptance auto-verifies email since the link itself proves ownership
- Multi-tenant from the schema up; cross-tenant access is rejected at the service boundary
- Encrypted-at-rest credentials via libsodium (`SecretCipher` + `SecretReader` + audit on every read)

**API surface**

- REST v1 at `/api/v1/{runbooks,runs,approvals,keys,webhooks,audit}` with API-key auth and per-key scopes
- Auth endpoints at `/api/auth/{register,login,logout,refresh,me,forgot-password,reset-password,change-password,verify-email,send-verification}` plus `/api/auth/{google,github}` for social login and `/api/auth/mfa/{enroll,verify-enroll,disable}` for TOTP
- Billing endpoints at `/api/billing/{summary,usage,checkout,portal,webhook}`
- Invites endpoints at `/api/invites/{,:id,lookup/:token,accept}`
- Templates endpoints at `/api/templates/{,:slug}`
- TypeScript SDK at `packages/sdk` with `/steps` subpath for custom plugin authors
- CLI at `packages/cli` (login, whoami, list, run, status, audit verify, approval grant/reject)
- OpenAPI spec at `/api/openapi.json` and Swagger UI at `/api/docs`

**Execution composition (new)**

- `runbook` step type — invoke another runbook as a sub-run. Runtime enforces tenant isolation, cycle detection (walks the `parentExecutionId` chain), and a 5-level depth cap. Sync mode polls child status + surfaces errors; async mode fires and forgets
- Error workflow trigger — each runbook declares `onErrorRunbookId`; a FAILED run auto-dispatches the handler with the error payload (`runId`, `runbookName`, `message`). Refuses to chain when the failed run was itself ERROR-triggered, so a buggy handler cannot loop

**Plugins (custom step types)**

- `@operari/sdk/steps` exports `defineStep({ type, configSchema, execute })`. Plugin authors ship npm packages whose `package.json` declares `operari.steps`; the runtime scans `OPERARI_PLUGINS_DIR` at boot and registers every declared entry
- Type collisions with core step types (`shell`, `approval`, `operari.*`) are rejected; a broken plugin never crashes boot — the offending entry is skipped with a log line

**Billing + quotas (new)**

- Stripe Checkout + Billing Portal + webhook (`customer.subscription.*`) wired via a thin `fetch` client — no Stripe Node SDK dependency
- Plan quotas: FREE tier caps at 3 active runbooks + 100 runs/month (env-overridable); TEAM/BUSINESS/ENTERPRISE get unlimited. `getTenantUsage()` drives a settings "Plan & billing" usage bar
- `requirePlan('TEAM' | 'BUSINESS' | 'ENTERPRISE')` middleware returns 402 Payment Required with an `upgrade` hint
- Pricing page CTAs route logged-in users straight into checkout; logged-out users go through register with the plan handoff preserved

**Templates (new)**

- Public, unauthenticated `/templates` gallery + `/templates/:slug` detail pages. Indexable for SEO. 20 curated YAMLs shipped today, including pedagogical ones for `Switch` / `Loop` / `Condition + Approval` so operators can drop a working sample of each control-flow construct onto the canvas
- "Use this runbook" button: logged-in users get a one-click import (YAML → canvas-native nodes via the existing serializer); logged-out users go through register with the template slug preserved

**Operator experience (new)**

- Temporal-style live execution event log at `/runs/:id` — typed rows, filterable by event type, server-sent-events tail, follow-tail with auto-pause on manual scroll + jump-to-latest pill, auto-expand on failed steps, inline retry-from-step. Reads from a durable `ExecutionEvent` table and a mirror Redis Stream for multi-instance delivery
- Operator dashboard at `/dashboard` with pulse KPIs, live runs, attention banner (failing/stuck/pending), 7-day trend bars, top runbooks with 20-cell status sparklines, a "what changed in 24h" delta card (new runbooks + runs-vs-prior delta + monitors fired + new approvals), health summary, and a last-update ticker that keeps the page honest about staleness
- `⌘K` global command palette + G-prefix navigation (G H dashboard, G R runbooks, G I inbox, G S SQL) + `?` shortcut cheat sheet modal
- Activation chain: empty-state CTA on dashboard creates a demo runbook, editor opens with `?welcome=1`, `⌘+Enter` onboarding hint surfaces until first run, one-shot confetti burst on first successful completion, localStorage-gated so seasoned users never see it again
- Email templates are real HTML with inline-styled table layout (password reset, verify email, invite, monitor alert, contact forward) — bilingual EN/ES, URL-sanitised CTAs, HTML-escaped user content
- Motion pass: framer-motion + anime.js on overlays, banners, lists; `prefers-reduced-motion` honored across every site
- Mobile responsive at 390px (on-call-phone default) for `/approvals` and `/runs/:id`
- Multi-instance fanout: Socket.IO Redis adapter for room-scoped emits across nodes; SSE event stream is inherently multi-instance safe via Redis Streams

**Tests**

- 1168 backend Jest tests (`cd backend && npm test`)
- 207 frontend Jest tests (`cd frontend && npm test`)
- Playwright e2e specs for Inbox / Runs / YAML view (require running app)
- 5 ADRs documenting non-trivial design decisions in `docs/adr/`

---

## What does NOT work yet

This is the part Show HN will dig into anyway, so it's better up here than buried.

| Area                            | State                                                                                                     | Tracked in           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------- |
| **Public demo instance**        | None. You have to self-host to try it                                                                     | —                    |
| **Loom / video walkthrough**    | None                                                                                                      | —                    |
| **Verified domain + trademark** | The repo is at `Hvelizgr/Operari`; the `Operari` mark and the `.dev/.io/.com` domains are not yet secured | Pre-launch checklist |
| **Production design partners**  | Zero                                                                                                      | —                    |

If any of these are deal-breakers for you, Operari is not yet the tool you
need. Star the repo and check back in 4-6 weeks.

---

## Status

|                       |                              |
| --------------------- | ---------------------------- |
| Stage                 | pre-launch alpha             |
| Branch                | `main`                       |
| Backend tests         | 1168 / 1168 passing          |
| Frontend tests        | 207 / 207 passing            |
| Type-check (backend)  | clean                        |
| Type-check (frontend) | clean                        |
| Self-hostable today   | yes — `docker compose up -d` |
| Cloud beta            | not yet                      |

---

## Try it locally

### With docker compose (recommended)

Requires **Docker 24+** with Compose V2.

```bash
git clone https://github.com/Hvelizgr/Operari.git operari
cd operari
cp .env.example .env

# Generate the two required secrets and paste them into .env:
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Optional: drop your Anthropic key into .env so the AI assist drawer works
# ANTHROPIC_API_KEY=sk-ant-...

docker compose up -d
```

The first up takes ~2-3 minutes (image build + prisma migrate + node-type seed).
Open `http://localhost:3000/en/editor` once the `operari-backend` container is healthy.

The compose stack runs five containers: `operari-postgres`, `operari-redis`,
`operari-migrate` (one-shot, applies migrations + seed and exits), `operari-backend`,
`operari-frontend`. The optional `operari-jaeger` joins via the `traces` profile:

```bash
docker compose --profile traces up -d
# then open http://localhost:16686 and set ENABLE_TRACING=true in your .env
```

### Without docker

Requires **Node 18+**, **PostgreSQL 14+**, **Redis 6+** running locally.

```bash
git clone https://github.com/Hvelizgr/Operari.git operari
cd operari

# 1. Backend
cd backend
cp .env.example .env
# edit .env: DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY (32+ char hex)
npm install
npx prisma migrate deploy
npm run db:seed      # populates the curated 20-node catalog
npm run dev          # listens on :4000

# 2. Frontend
cd ../frontend
npm install
npm run dev          # listens on :3000
```

Then open `http://localhost:3000/en/editor` and create a runbook, or import
a template from [`templates/`](./templates).

### Deploy to production

Three documented paths in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md):

- **VPS + docker compose + Caddy** — one server, auto TLS via Let's Encrypt. `docker-compose.prod.yml` + `caddy/Caddyfile` ship with the repo.
- **Fly.io** — managed Postgres + Redis, per-region machines. Templates in `deploy/fly/`.
- **Railway** — zero-config experimentation. Template + variable mapping in `deploy/railway/README.md`.

Same Docker images build from this repo for every path. Full environment variable reference is in [`.env.example`](./.env.example).

---

## What a runbook looks like

YAML round-trip is canonical. Here's the kubernetes rolling deploy from
`templates/k8s-rolling-deploy.yaml`:

```yaml
# yaml-language-server: $schema=http://localhost:4000/runbook.schema.json
version: 1
name: K8s Rolling Deploy
slug: k8s-rolling-deploy
description: Update image tag, watch rollout, run smoke tests, rollback on failure.
category: deploy

steps:
  - id: pre_check
    type: shell
    name: Pre-deploy health check
    config:
      command: kubectl get deployment {{vars.deployment}} -n {{vars.namespace}} -o wide
    next: set_image

  - id: set_image
    type: shell
    name: Update image
    config:
      command: |
        kubectl set image deployment/{{vars.deployment}} \
          {{vars.deployment}}={{vars.image}} \
          -n {{vars.namespace}} --record
    retry:
      count: 2
      backoff: exponential
      delayMs: 1000
    next: watch_rollout

  - id: watch_rollout
    type: shell
    name: Watch rollout status
    config:
      command: kubectl rollout status deployment/{{vars.deployment}} -n {{vars.namespace}} --timeout=300s
    next: approve_traffic_shift

  - id: approve_traffic_shift
    type: approval
    name: Approve traffic shift
    config:
      message: 'Pods are healthy. Shift production traffic?'
    next: notify

  - id: notify
    type: notify
    name: Slack #releases
    config:
      channel: slack
      webhookUrl: '{{vars.slack_webhook}}'
      message: 'Deploy of {{vars.image}} to {{vars.namespace}} complete.'
```

Trigger it from the CLI:

```bash
operari run k8s-rolling-deploy \
  --var namespace=prod \
  --var deployment=api \
  --var image=registry/api:v2.1.4
```

Or from a webhook your CI fires after `main` merges:

```bash
curl -X POST https://your-operari.example.com/api/webhooks/<token> \
  -H 'X-Signature: sha256=<hmac>' \
  -d '{"image":"registry/api:v2.1.4","namespace":"prod","deployment":"api"}'
```

---

## VS Code integration

Operari ships a JSON Schema for the runbook spec at
`http://localhost:4000/runbook.schema.json` (served from your local
backend, or any deployment). Point the [VS Code YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
at it and every `*.runbook.yaml` file in your repo gets autocomplete,
inline validation, and field-level documentation as you type.

Add to your workspace `settings.json`:

```json
{
  "yaml.schemas": {
    "http://localhost:4000/runbook.schema.json": ["**/*.runbook.yaml", "templates/*.yaml"]
  }
}
```

Or pin the schema per file with a header comment:

```yaml
# yaml-language-server: $schema=http://localhost:4000/runbook.schema.json
version: 1
name: my runbook
...
```

The schema is hand-maintained against [`backend/src/runbook/yaml/runbook-spec.ts`](./backend/src/runbook/yaml/runbook-spec.ts)
and pinned by a jest matrix test that validates every shipped template
against it. If the schema and the spec drift apart, the test goes red.

---

## How Operari compares

Honest version. ✅ = built and tested. 🟡 = partial / stub. ❌ = not done.
"Cost" is the public list price for the cheapest paid tier; free tiers vary.

|                                     | Operari     | Rundeck (PD)     | StackStorm | incident.io         | Backstage                |
| ----------------------------------- | ----------- | ---------------- | ---------- | ------------------- | ------------------------ |
| Visual canvas                       | ✅          | ❌               | ❌         | 🟡                  | ❌                       |
| YAML source-of-truth                | ✅          | 🟡               | ✅         | ❌                  | 🟡                       |
| Sandboxed shell execution           | ✅          | ✅               | ✅         | ❌                  | ❌                       |
| Per-step retry / runIf              | ✅          | ✅               | 🟡         | ❌                  | ❌                       |
| Human approval gates                | ✅          | ✅               | 🟡         | ✅                  | ❌                       |
| Replay from step                    | ✅          | 🟡               | ❌         | ❌                  | ❌                       |
| AI agent on step failure            | ✅          | ❌               | ❌         | ✅                  | ❌                       |
| Webhook triggers                    | ✅          | ✅               | ✅         | ✅                  | 🟡                       |
| Audit log (immutable, hash-chained) | ✅          | ✅               | 🟡         | ✅                  | 🟡                       |
| RBAC + multi-tenant                 | ✅          | ✅               | 🟡         | ✅                  | 🟡                       |
| OSS license                         | AGPL        | Apache (legacy)  | Apache     | ❌                  | Apache                   |
| Cheapest paid tier                  | n/a (alpha) | $125 / user / mo | free       | ~$20-40 / user / mo | "free" + ~$150K eng cost |
| Aimed at SRE / platform eng         | ✅          | ✅               | ✅         | 🟡 (incident-side)  | ✅                       |

Operari is the only entry in the top-left quadrant of "proactive procedures

- dev-first + open source + visual + AI". The full reasoning is in
  [`INVESTIGACION_OPERARI_2026.md`](./docs/) (gitignored, internal).

---

## Architecture

```
operari/
├── backend/
│   └── src/
│       ├── runbook/             ← canonical: spec, serializer, executors, runners
│       │   ├── yaml/            ← RunbookSpec + round-trip serializer
│       │   ├── executors/       ← step executors (shell, http, approval, notify, wait)
│       │   ├── runners/         ← local / docker / fly sandbox backends
│       │   └── services/        ← api-key, webhook, approval
│       ├── editor/              ← legacy Operari editor layer (consolidation deferred — see ADR 0004)
│       │   ├── nodes/           ← per-node-type executors
│       │   └── execution/       ← ExecutionService, socket.io live logs
│       ├── routes/
│       │   ├── runbook.routes.ts        ← editor CRUD (JWT)
│       │   ├── runs.routes.ts           ← run history list / detail
│       │   ├── approvals.routes.ts      ← approval inbox
│       │   ├── runbook-assist.routes.ts ← R4 AI side-panel SSE endpoint
│       │   ├── connected-accounts.routes.ts
│       │   ├── webhooks-admin.routes.ts
│       │   └── v1/                      ← public API key surface
│       ├── agent/               ← Vercel AI SDK orchestrator (ADR 0001)
│       ├── audit/               ← hash-chained event log + verifier
│       ├── rbac/                ← roles + assignments
│       ├── security/            ← SecretCipher / SecretReader / ConnectedAccountService
│       ├── billing/             ← pluggable meter (Stripe Meter Events)
│       ├── observability/       ← OTel run tracer + Redis log stream
│       └── prisma/              ← schema + migrations + curated node seed
│
├── frontend/                    ← Next.js 15 + React 19 + Tailwind
│   ├── app/[lang]/
│   │   ├── editor/              ← canvas
│   │   ├── inbox/               ← approval inbox
│   │   ├── runs/                ← run history list + detail page
│   │   └── (marketing)/         ← landing
│   ├── components/
│   │   ├── Editor/              ← canvas, topbar, YAML modal, AI assist drawer
│   │   ├── Node/                ← node palette, config panel, secret picker, retry editor
│   │   ├── Inbox/               ← approval inbox
│   │   └── Runs/                ← run history + detail
│   └── utils/runbookYaml.ts     ← in-browser mirror of the backend serializer
│
├── packages/
│   ├── shared/                  ← @operari/shared (types shared by frontend + backend)
│   ├── sdk/                     ← @operari/sdk (npm, MIT)
│   └── cli/                     ← @operari/cli (npm, MIT)
│
├── templates/                   ← 20 production-shaped runbooks (k8s, db, cache, secrets, …)
└── docs/
    ├── adr/                     ← architectural decision records
    ├── audit-event-coverage.md
    ├── rebranding-and-editor-audit.md
    └── post-pivot-cleanup-audit.md
```

**Stack**

- **Backend** Express, Prisma, PostgreSQL, Socket.IO, Redis Streams, OpenTelemetry, libsodium, Vercel AI SDK (Anthropic + OpenAI)
- **Frontend** Next.js 15, React 19, Tailwind, framer-motion, lucide-react, js-yaml
- **Packages** TypeScript SDK + CLI, both MIT

---

## License split

The split is intentional: AGPL on the server prevents cloud providers from
SaaS-ing Operari without contributing back; MIT on the client tooling means
you can integrate Operari into anything without restrictions.

| Path            | License   |
| --------------- | --------- |
| `backend/`      | AGPL-3.0  |
| `frontend/`     | AGPL-3.0  |
| `packages/sdk/` | MIT       |
| `packages/cli/` | MIT       |
| `templates/`    | MIT       |
| `docs/`         | CC-BY-4.0 |

---

## Roadmap

Honest, time-boxed, conservative.

**Now → 4 weeks (pre-launch)**

- One real webhook integration end-to-end (GitHub or Sentry, not both)
- ~~JSON Schema validation in the in-app YAML save modal~~ — shipped
  (`frontend/utils/runbookSchemaValidator.ts` + the matching server-side
  guard in the YAML save route, with a drift-guard test that pins the
  bundled offline copy to the canonical schema)
- 90-second loom walkthrough
- README polish and Show HN draft
- 30 discovery interviews with platform engineers (not optional)

**4 → 12 weeks (post-launch alpha)**

- 5 design partners using Operari in earnest
- Python SDK
- ~~AI agent gets read-only tools (`get_recent_runs`, `get_step_logs`, `search_step_history`)~~ — shipped (`list_recent_runs`, `get_run_details`, `get_step_logs`, `search_runs_by_error`, `list_runbooks` + opt-in `grant_approval` / `reject_approval`)
- ~~Live log streaming on the run detail timeline~~ — shipped via the
  durable execution event log (`backend/src/runbook/engine/execution-event.store.ts`)
  with a Redis Stream mirror for live-tail SSE and a Postgres row for
  durability. The frontend `ExecutionEventLog` component opens an
  `EventSource` for RUNNING runs and falls back to 2s polling. The
  feature is gated behind `OPERARI_DURABLE_ENGINE=true`, which the
  shipped `docker-compose.yml` and `docker-compose.prod.yml` default to
  on. Operators booting the backend without compose need to set the
  env var explicitly — see `.env.example`.
- ~~Grafana dashboard JSON shipped with the repo~~ — shipped at
  `deploy/grafana/operari-runs.json`. Backed by a Prometheus scrape
  endpoint at `/metrics` (gated by `OPERARI_METRICS_ENABLED=true`)
  exposing run/step counters, run-duration + step-duration histograms,
  and standard Node.js process metrics under the `operari_node_*`
  prefix.
- ~~5 more production-shaped templates from real customer scenarios~~ —
  shipped: `recover-cache-stampede`, `rotate-tls-certificate`,
  `kill-runaway-postgres-query`, `failover-traffic-cloudflare`,
  `scale-out-on-traffic-spike`, `quarantine-suspicious-ip` (six,
  not five — the 3am page comes in many shapes).

**3 → 6 months (cloud beta)**

- ~~Hosted free tier with GitHub OAuth login~~ — shipped
- ~~Email verification on signup + MFA/TOTP~~ — shipped
- ~~Stripe checkout UX wired to the existing `StripeBillingMeter`~~ — Checkout, Billing Portal, webhook handler, and plan-quota enforcement shipped; actual deploy of the hosted tier is the next blocker
- ~~RBAC invite UI~~ — shipped as team invites (`/api/invites/*` + settings Team panel)
- Runner isolation for multi-tenant cloud (Fly Machines per run, Firecracker, or gVisor) — still outstanding
- WorkOS SSO (adapter is already scaffolded in `backend/src/auth/workos-auth-provider.ts`, just needs the WorkOS org + creds)
- Audit chain inspector UI
- Declarative plugin manifest (JSON schema → auto-generated config form) — the `defineStep` SDK shipped; the zero-code UX is the next lever

**Anything not on this list is not on the roadmap.** No marketplace, no
real-time collab, no MCP server, no service catalog. If a customer asks
for them, they go on the list. Until then, they don't exist.

---

## Contributing

Contributions welcome. The shortest path:

1. Read the relevant ADR in [`docs/adr/`](./docs/adr/)
2. Open an issue describing the change before starting work, especially
   for anything in `runbook/` or `editor/`
3. PRs need passing tests and `tsc --noEmit` clean on both sides
4. Commits follow Conventional Commits (commitlint enforces lowercase
   subject + footer-leading-blank)
5. Co-authored commits without explicit attribution claims

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the longer version.

---

## Why open source

Two reasons.

**Distribution.** Sentry, PostHog, Supabase, Grafana, Cal.com — every
successful dev-tool of the last decade went open source first because
the alternative is paying for outbound sales nobody answers. SREs find
tools through GitHub stars, HackerNews, and ex-colleagues, in that order.

**Trust.** A runbook tool needs root-equivalent credentials to do its
job. Closed-source tooling that holds those credentials is a hard sell.
AGPL on the server means you can audit the codebase that runs your
deploys, run it on your own hardware, and know the audit chain is real
because you can verify it yourself.

The cloud version (eventually) is for teams that don't want to operate
their own Postgres + Redis + runners. It's the same code with the
operational headaches absorbed.

---

## Background

Operari started as **Operari**, a generic n8n-style workflow editor.
In April 2026 the project pivoted to focus on operational runbooks for
SREs and platform engineers — a much narrower wedge with a clearer
audience and a less crowded market. The pivot is documented commit-by-commit
in [`docs/rebranding-and-editor-audit.md`](./docs/rebranding-and-editor-audit.md)
and the post-pivot cleanup is in [`docs/post-pivot-cleanup-audit.md`](./docs/post-pivot-cleanup-audit.md).
Some folder names (`backend/src/editor/`, the `Workflow` Prisma model)
still carry the legacy and will be renamed when the consolidation in
[ADR 0004](./docs/adr/0004-consolidate-executor-hierarchies.md) lands.

If you're evaluating the project, those three documents tell you more
than this README does about what Operari is and isn't.
