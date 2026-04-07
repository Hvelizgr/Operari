# NanoRun

**Open-source runbook automation for SREs and platform engineers.**
Visual, executable, dev-first. Stop maintaining deploy procedures in Confluence.

[![License: AGPL v3](https://img.shields.io/badge/server-AGPL_v3-blue.svg)](./LICENSE)
[![SDK: MIT](https://img.shields.io/badge/sdk_+_cli-MIT-green.svg)](./packages/sdk/LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests: 518 passing](https://img.shields.io/badge/tests-518_passing-brightgreen.svg)](#status)
[![Status: pre-launch alpha](https://img.shields.io/badge/status-pre--launch_alpha-orange.svg)](#status)

> NanoRun is in **pre-launch alpha**. The status section below tells you exactly
> what works and what doesn't — no roadmap-ware. The repo started as
> NanoFlow (an n8n-style generic workflow editor) and pivoted to NanoRun
> in April 2026; some folder names still carry the legacy. The pivot is
> documented in [`docs/rebranding-and-editor-audit.md`](./docs/rebranding-and-editor-audit.md)
> and [`docs/post-pivot-cleanup-audit.md`](./docs/post-pivot-cleanup-audit.md).

---

## The 60-second pitch

Today the procedures your team runs at 3am — deploys, migrations, secret
rotation, incident response, post-mortems — live in some combination of:

- A Confluence page nobody updated in 8 months
- A bash script only one person understands
- A Notion doc, three Slack threads, and one engineer's head

Rundeck costs $125/user/month and is enterprise-heavy. StackStorm is
abandonware. Backstage catalogs services but doesn't *execute* anything.
incident.io is post-incident, not pre. There is no dev-first, open-source,
visual-and-executable runbook tool aimed at SREs at small-to-mid teams.

NanoRun is that tool. A runbook is a versioned graph of steps. Each step
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
- Secret picker that references credentials by id (`{{secrets.<account>}}`); the value never touches the editor
- Schedule UI with eight cron presets plus a validated custom expression
- Trigger config: webhook URLs and one-time secrets per runbook for GitHub / Sentry / Datadog / custom

**Execution**
- 20 curated step types: shell, http, approval, notify, wait, switch, loop, github, docker, postgres, awsS3, agent, plus organizational nodes
- Sandboxed runners with three backends: local process, Docker container, Fly.io machine
- Real-time stdout / stderr streaming over Socket.IO + durable Redis stream backing
- Human approval gates that suspend the run and resume on `grant`/`reject`
- Replay from any step in any historical run
- Run cancellation with propagation to the runner

**Operating**
- Approval inbox at `/inbox` with status filters and inline grant/reject
- Run history at `/runs` with status filters, ETA from past runs, cursor pagination
- Run detail timeline at `/runs/:id` with per-step output, error blocks, replay-from-step button
- AI assist side-panel that diagnoses failed steps using stdout/stderr/exit-code context
- Hash-chained immutable audit log (SHA-256) with a CLI to verify the chain (`nanorun audit verify`)
- RBAC with custom roles, role assignments, and audit events on grant/revoke
- OpenTelemetry: every run is a trace, every step is a span

**Auth + multi-tenancy**
- Pluggable AuthProvider — JWT for self-host, WorkOS for cloud, single env flip to swap
- Multi-tenant from the schema up; cross-tenant access is rejected at the service boundary
- Encrypted-at-rest credentials via libsodium (`SecretCipher` + `SecretReader` + audit on every read)

**API surface**
- REST v1 at `/api/v1/{runbooks,runs,approvals,keys,webhooks,audit}` with API-key auth and per-key scopes
- TypeScript SDK at `packages/sdk`
- CLI at `packages/cli` (login, whoami, list, run, status, audit verify, approval grant/reject)
- OpenAPI spec at `/api/openapi.json` and Swagger UI at `/api/docs`

**Tests**
- 471 backend Jest tests (`cd backend && npm test`)
- 47 frontend Jest tests (`cd frontend && npm test`)
- Playwright e2e specs for Inbox / Runs / YAML view (require running app)
- 4 ADRs documenting non-trivial design decisions in `docs/adr/`

---

## What does NOT work yet

This is the part Show HN will dig into anyway, so it's better up here than buried.

| Area | State | Tracked in |
|---|---|---|
| **GitHub App OAuth + status checks** | Connected accounts model exists, OAuth dance not wired | P1 #9 in `IMPLEMENTACION_NANORUN.md` |
| **Slack notifications actually sending** | `notify` step exists in the catalog but doesn't call a real Slack webhook yet | Tier 0 #4 in [`post-pivot-cleanup-audit.md`](./docs/post-pivot-cleanup-audit.md) |
| **Sentry / Datadog payload parsing** | Webhook receiver verifies HMAC and routes to runbooks; provider-specific parsing is stubbed | P1 #9 |
| **AI agent tools** | The orchestrator streams responses; it does NOT yet have read access to past runs / step logs as tools. Today it only sees what the side-panel sends in the prompt | Backlog item, no eta |
| **Database step** | Hardened to allow `migrate`/`health`/`backup` only, but still a passthrough stub. Real Prisma wiring is not in | Backlog |
| **Public demo instance** | None. You have to self-host to try it | — |
| **Loom / video walkthrough** | None | — |
| **Verified domain + trademark** | The repo is at `Hvelizgr/NanoFlow`; the `NanoRun` mark and the `.dev/.io/.com` domains are not yet secured | Pre-launch checklist |
| **Production design partners** | Zero | — |

If any of these are deal-breakers for you, NanoRun is not yet the tool you
need. Star the repo and check back in 4-6 weeks.

---

## Status

| | |
|---|---|
| Stage | pre-launch alpha |
| Branch | `feat/p0-hardening` (open PR to `main`) |
| Backend tests | 471 / 471 passing |
| Frontend tests | 47 / 47 passing |
| Type-check (backend) | clean |
| Type-check (frontend) | clean |
| Commits ahead of main | ~50 |
| Self-hostable today | yes, with manual setup |
| Cloud beta | not yet |

---

## Try it locally

### With docker compose (recommended)

Requires **Docker 24+** with Compose V2.

```bash
git clone https://github.com/Hvelizgr/NanoFlow.git nanorun
cd nanorun
cp .env.example .env

# Generate the two required secrets and paste them into .env:
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Optional: drop your Anthropic key into .env so the AI assist drawer works
# ANTHROPIC_API_KEY=sk-ant-...

docker compose up -d
```

The first up takes ~2-3 minutes (image build + prisma migrate + node-type seed).
Open `http://localhost:3000/en/editor` once the `nanorun-backend` container is healthy.

The compose stack runs five containers: `nanorun-postgres`, `nanorun-redis`,
`nanorun-migrate` (one-shot, applies migrations + seed and exits), `nanorun-backend`,
`nanorun-frontend`. The optional `nanorun-jaeger` joins via the `traces` profile:

```bash
docker compose --profile traces up -d
# then open http://localhost:16686 and set ENABLE_TRACING=true in your .env
```

### Without docker

Requires **Node 18+**, **PostgreSQL 14+**, **Redis 6+** running locally.

```bash
git clone https://github.com/Hvelizgr/NanoFlow.git nanorun
cd nanorun

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

---

## What a runbook looks like

YAML round-trip is canonical. Here's the kubernetes rolling deploy from
`templates/k8s-rolling-deploy.yaml`:

```yaml
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
      message: "Pods are healthy. Shift production traffic?"
    next: notify

  - id: notify
    type: notify
    name: Slack #releases
    config:
      channel: "{{secrets.slack_webhook}}"
      message: "Deploy of {{vars.image}} to {{vars.namespace}} complete."
```

Trigger it from the CLI:

```bash
nanorun run k8s-rolling-deploy \
  --var namespace=prod \
  --var deployment=api \
  --var image=registry/api:v2.1.4
```

Or from a webhook your CI fires after `main` merges:

```bash
curl -X POST https://your-nanorun.example.com/api/webhooks/<token> \
  -H 'X-Signature: sha256=<hmac>' \
  -d '{"image":"registry/api:v2.1.4","namespace":"prod","deployment":"api"}'
```

---

## How NanoRun compares

Honest version. ✅ = built and tested. 🟡 = partial / stub. ❌ = not done.
"Cost" is the public list price for the cheapest paid tier; free tiers vary.

| | NanoRun | Rundeck (PD) | StackStorm | incident.io | Backstage |
|---|---|---|---|---|---|
| Visual canvas | ✅ | ❌ | ❌ | 🟡 | ❌ |
| YAML source-of-truth | ✅ | 🟡 | ✅ | ❌ | 🟡 |
| Sandboxed shell execution | ✅ | ✅ | ✅ | ❌ | ❌ |
| Per-step retry / runIf | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Human approval gates | ✅ | ✅ | 🟡 | ✅ | ❌ |
| Replay from step | ✅ | 🟡 | ❌ | ❌ | ❌ |
| AI agent on step failure | ✅ | ❌ | ❌ | ✅ | ❌ |
| Webhook triggers | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Audit log (immutable, hash-chained) | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| RBAC + multi-tenant | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| OSS license | AGPL | Apache (legacy) | Apache | ❌ | Apache |
| Cheapest paid tier | n/a (alpha) | $125 / user / mo | free | ~$20-40 / user / mo | "free" + ~$150K eng cost |
| Aimed at SRE / platform eng | ✅ | ✅ | ✅ | 🟡 (incident-side) | ✅ |

NanoRun is the only entry in the top-left quadrant of "proactive procedures
+ dev-first + open source + visual + AI". The full reasoning is in
[`INVESTIGACION_NANORUN_2026.md`](./docs/) (gitignored, internal).

---

## Architecture

```
nanorun/
├── backend/
│   └── src/
│       ├── runbook/             ← canonical: spec, serializer, executors, runners
│       │   ├── yaml/            ← RunbookSpec + round-trip serializer
│       │   ├── executors/       ← step executors (shell, http, approval, notify, wait)
│       │   ├── runners/         ← local / docker / fly sandbox backends
│       │   └── services/        ← api-key, webhook, approval
│       ├── editor/              ← legacy NanoFlow editor layer (consolidation deferred — see ADR 0004)
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
│   ├── sdk/                     ← @nanorun/sdk (npm, MIT)
│   └── cli/                     ← @nanorun/cli (npm, MIT)
│
├── templates/                   ← 5 production-shaped runbooks
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
SaaS-ing NanoRun without contributing back; MIT on the client tooling means
you can integrate NanoRun into anything without restrictions.

| Path | License |
|---|---|
| `backend/` | AGPL-3.0 |
| `frontend/` | AGPL-3.0 |
| `packages/sdk/` | MIT |
| `packages/cli/` | MIT |
| `templates/` | MIT |
| `docs/` | CC-BY-4.0 |

---

## Roadmap

Honest, time-boxed, conservative.

**Now → 4 weeks (pre-launch)**

- Slack notify that actually sends
- One real webhook integration end-to-end (GitHub or Sentry, not both)
- JSON Schema validation on YAML save
- 90-second loom walkthrough
- README polish and Show HN draft
- 30 discovery interviews with platform engineers (not optional)

**4 → 12 weeks (post-launch alpha)**

- 5 design partners using NanoRun in earnest
- Python SDK
- AI agent gets read-only tools (`get_recent_runs`, `get_step_logs`, `search_step_history`)
- Live log streaming on the run detail timeline
- Grafana dashboard JSON shipped with the repo
- 5 more production-shaped templates from real customer scenarios

**3 → 6 months (cloud beta)**

- Hosted free tier with GitHub OAuth login
- Stripe metered billing wired to run lifecycle
- WorkOS SSO
- RBAC invite UI
- Audit chain inspector

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

NanoRun started as **NanoFlow**, a generic n8n-style workflow editor.
In April 2026 the project pivoted to focus on operational runbooks for
SREs and platform engineers — a much narrower wedge with a clearer
audience and a less crowded market. The pivot is documented commit-by-commit
in [`docs/rebranding-and-editor-audit.md`](./docs/rebranding-and-editor-audit.md)
and the post-pivot cleanup is in [`docs/post-pivot-cleanup-audit.md`](./docs/post-pivot-cleanup-audit.md).
Some folder names (`backend/src/editor/`, the `Workflow` Prisma model)
still carry the legacy and will be renamed when the consolidation in
[ADR 0004](./docs/adr/0004-consolidate-executor-hierarchies.md) lands.

If you're evaluating the project, those three documents tell you more
than this README does about what NanoRun is and isn't.
