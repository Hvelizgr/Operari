<div align="center">

# NanoRun

### Visual runbooks for engineers.

**Stop hiding deploys, migrations, and incident response in dead Confluence wikis.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![SDK: MIT](https://img.shields.io/badge/SDK-MIT-green.svg)](./packages/sdk/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)]()

[Quickstart](#quickstart) • [Why?](#why) • [How it works](#how-it-works) • [Self-host](#self-host) • [SDK](#sdk--cli) • [Templates](./templates)

</div>

---

## Why?

Today, your team's runbooks live in:

- 📄 **Dead Confluence wikis** nobody reads
- 🤯 **The head of one senior engineer** (bus factor: 1)
- 💀 **Bash scripts** only one person understands
- 📋 **Notion docs** that haven't been updated in 8 months

When something needs to happen at 3am, the on-call engineer Googles, copies commands into the terminal, prays, and breaks production.

**NanoRun fixes this.** Every operational procedure becomes a visual graph that:

- 🎨 **Visual** — drag-and-drop steps, see the flow at a glance
- ⚡ **Executable** — each step runs real commands (`kubectl`, `aws`, `gh`, anything)
- 🤖 **AI-assisted** — get help when you're stuck (coming soon)
- 👥 **Collaborative** — your whole team sees what's happening in real time
- 📜 **Audited** — every execution is logged automatically (compliance for free)
- 🪝 **Triggerable** — manual, schedule, webhook from Sentry/GitHub/Datadog, or via CLI/SDK

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│  1. You build a runbook visually in the editor           │
│                                                          │
│      [Pull main] → [Run tests] → [Approve] → [Deploy]    │
│           │             │            │           │      │
│        shell         shell      approval     shell       │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  2. You trigger it from anywhere                         │
│                                                          │
│   • UI:       click "Run" in the editor                  │
│   • CLI:      $ nanorun run deploy-frontend              │
│   • SDK:      await client.trigger('deploy-frontend')    │
│   • Webhook:  Sentry/GitHub/Datadog → POST /webhooks/... │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  3. NanoRun executes each step on the runner             │
│                                                          │
│   ✓ Pull main         (5ms)                              │
│   ✓ Run tests         (12s)                              │
│   ⏸ Waiting approval  ← team gets Slack ping             │
│   ✓ Deploy            (45s)                              │
│                                                          │
│   Live stdout/stderr streams to the editor + audit log   │
└──────────────────────────────────────────────────────────┘
```

---

## Quickstart

### Self-host with Docker (recommended)

```bash
git clone https://github.com/your-org/nanorun.git
cd nanorun
cp backend/.env.example backend/.env
# edit backend/.env — set DATABASE_URL and JWT_SECRET

docker compose up -d
```

Open `http://localhost:3000/en/editor` and create your first runbook.

### Or run locally without Docker

Requires **Node 18+** and a **PostgreSQL** database.

```bash
git clone https://github.com/your-org/nanorun.git
cd nanorun
npm install
cp backend/.env.example backend/.env
# edit backend/.env

cd backend && npx prisma db push && cd ..
npm run dev
```

The editor opens at `http://localhost:3000/en/editor` and the API at `http://localhost:4000`.

---

## SDK & CLI

NanoRun ships with an official Node.js SDK and a CLI you can install separately.

### SDK

```bash
npm install @nanorun/sdk
```

```ts
import { NanoRun } from '@nanorun/sdk';

const client = new NanoRun({ apiKey: process.env.NANORUN_API_KEY! });

// Trigger and wait for completion
const run = await client.run('deploy-frontend', {
  variables: { env: 'production', version: '2.1.4' },
});

console.log(`Status: ${run.status}, Duration: ${run.duration}ms`);
```

[Full SDK docs →](./packages/sdk/README.md)

### CLI

```bash
npm install -g @nanorun/cli

nanorun login
nanorun list
nanorun run deploy-frontend -v env=production
```

```
• Running runbook: deploy-frontend
  Variables: {"env":"production"}

  Run ID:  abc123-...
  Console: http://localhost:3000/en/editor?runId=abc123

  ✓ Pull main          (shell, 5ms)
  ✓ Run tests          (shell, 12s)
  ✓ Build              (shell, 45s)
  ✓ Deploy to Vercel   (shell, 33s)
  ✓ Notify Slack       (notify, 200ms)

SUCCESS  Total: 1m30s
```

[Full CLI docs →](./packages/cli/README.md)

---

## Use cases

- **🚀 Deploys** — visual deploy procedures with approval gates and rollback
- **🗄️ DB migrations** — backup → check → approve → migrate → verify
- **🔑 Secret rotation** — rotate AWS keys with automatic propagation to Vercel/GitHub
- **🚨 Incident response** — runbooks triggered automatically from Sentry/Datadog alerts
- **👋 Onboarding** — provision GitHub access, AWS, Slack invite for new devs
- **🧹 Cleanup jobs** — scheduled runbooks for AWS resource cleanup, log rotation, etc.

Browse 5+ ready-to-use templates in [`templates/`](./templates).

---

## How NanoRun compares

| | NanoRun | PagerDuty Process Automation | StackStorm | GitHub Actions | Confluence runbooks |
|---|---|---|---|---|---|
| **Visual editor** | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| **Executable steps** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **AI assistant** | 🚧 (Q2 2026) | ❌ | ❌ | ❌ | ❌ |
| **Real-time collab** | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| **Open source** | ✅ AGPL | ❌ | ✅ Apache | ❌ | ❌ |
| **Pricing** | Free + cloud | $125/user/mo | Free | Per minute | Per user |
| **Setup time** | 5 min | Days | Hours | Minutes | Already there 💀 |
| **Audit trail** | ✅ Built-in | ✅ | ⚠️ | ⚠️ | ❌ |

---

## Architecture

```
nanorun/
├── backend/                 ← Express + Prisma + Socket.IO + isolated-vm
│   └── src/
│       ├── runbook/         ← Step executors (shell, approval, notify, wait, ...)
│       ├── routes/v1/       ← Public API (Bearer auth)
│       └── editor/          ← Workflow execution engine
│
├── frontend/                ← Next.js 15 + React 19 + Tailwind
│   └── components/Editor/   ← Visual canvas with drag-drop
│
├── packages/
│   ├── sdk/                 ← @nanorun/sdk (npm, MIT)
│   └── cli/                 ← @nanorun/cli (npm, MIT)
│
└── templates/               ← Production-ready runbook templates
```

**Tech stack:**
- **Backend**: Express, Prisma, PostgreSQL, Socket.IO, isolated-vm, OpenTelemetry
- **Frontend**: Next.js 15, React 19, Tailwind, Framer Motion
- **Packages**: SDK + CLI in TypeScript with zero runtime deps (besides commander)

---

## Roadmap

**Alpha (now)**
- ✅ Visual runbook editor
- ✅ Shell, approval, notify, wait executors
- ✅ REST API v1 with Bearer auth
- ✅ Node.js SDK + CLI
- ✅ Webhook receiver with HMAC validation
- ✅ Real-time execution streaming via Socket.IO
- ✅ Multi-tenant + audit trail
- ✅ 5 production-ready templates

**Beta (Q2 2026)**
- 🚧 AI assistant (Mastra-powered) for runbook generation and debugging
- 🚧 More executors: kubectl, aws, terraform, gh, docker
- 🚧 Frontend admin UI for API keys + webhooks
- 🚧 Slug-based runbook URLs
- 🚧 Marketplace for community templates
- 🚧 Python SDK
- 🚧 Cloud-hosted free tier

**v1.0 (Q3 2026)**
- 🚧 SSO + RBAC
- 🚧 Backstage / Port plugin
- 🚧 Metrics dashboard

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

- **Server** (`backend/`): [AGPL-3.0](./LICENSE)
- **SDK** (`packages/sdk/`): [MIT](./packages/sdk/LICENSE)
- **CLI** (`packages/cli/`): [MIT](./packages/cli/LICENSE)
- **Templates** (`templates/`): [MIT](./templates/LICENSE)

The AGPL on the server prevents cloud providers from offering NanoRun as a service without contributing back. The SDK, CLI, and templates are MIT so you can integrate them anywhere without restrictions.

---

<div align="center">

**Built by engineers tired of dead Confluence wikis.**

[Report a bug](https://github.com/your-org/nanorun/issues) • [Request a feature](https://github.com/your-org/nanorun/issues) • [Discord](#)

</div>
