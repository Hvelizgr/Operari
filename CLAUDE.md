# Operari — project map

Open-source runbook automation for SREs and platform engineers.
Visual canvas + executable steps + audit trail. Single pane of glass for the on-call team at 3am.

The full story (what works, what doesn't, license split, deploy paths) lives in [README.md](./README.md).
This file is the _orientation map_: where things are and how the pieces relate.

---

## Map (by purpose, not by technology)

```text
operari/
├── core — the product itself
│   ├── runbook editor       visual canvas + YAML round-trip
│   ├── execution engine     local / docker / fly runners
│   ├── audit chain          SHA-256 hash-chained event log
│   └── ai assist            failure diagnosis side-panel
│
├── team helpers — same UI shell, different jobs
│   ├── runbook canvas       /editor         (G R)
│   ├── sql editor           /sql-editor     (G S)
│   └── api tester           /http-tester    (G A)
│
├── cross-cutting — under every feature
│   ├── auth + multi-tenant  JWT/cookie, RBAC, MFA, OAuth (Google/GitHub)
│   ├── secrets vault        libsodium + audit on every read
│   ├── observability        OTel spans + Redis log streams
│   └── billing + quotas     Stripe checkout + plan gates
│
├── integrations — outbound
│   ├── connected accounts   postgres, github, slack, datadog
│   ├── webhooks             receivers + outbound triggers
│   └── ai providers         Anthropic + OpenAI via Vercel AI SDK
│
└── delivery
    ├── backend/             Express + Prisma + Postgres + Redis
    ├── frontend/            Next.js 15 + React 19 + Tailwind
    ├── packages/            @operari/{sdk,cli,shared} (sdk+cli are MIT)
    └── deploy/              docker-compose / fly / railway templates
```

---

## Where to look

| You want to...                         | Look in                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Add a step type executor               | [backend/src/runbook/executors/](./backend/src/runbook/executors/)                                                            |
| Add a UI route                         | [frontend/app/\[lang\]/](./frontend/app/%5Blang%5D/)                                                                          |
| Add a backend HTTP route               | [backend/src/routes/](./backend/src/routes/) (web UI) or [backend/src/routes/v1/](./backend/src/routes/v1/) (SDK/CLI API key) |
| Understand a non-obvious design choice | [docs/adr/](./docs/adr/)                                                                                                      |
| Wire a new event type                  | search for `audit.record(` in [backend/src/](./backend/src/)                                                                  |
| Add a node to the canvas palette       | [frontend/components/Node/NodePalette.tsx](./frontend/components/Node/NodePalette.tsx)                                        |

---

## Conventions worth knowing

- **Auth transport** — Web UI uses cookies + CSRF (`credentials: 'include'`); SDK/CLI uses `Authorization: Bearer`. Both go through the same `authenticate()` middleware.
- **Routes split** — `/api/*` is JWT/cookie (UI). `/api/v1/*` is API-key only (SDK/CLI). Don't mix them.
- **i18n** — No central dictionary. Each component does `const t = lang === 'es' ? {...} : {...}` inline. EN/ES are the only two.
- **State** — No global frontend store. `useEditorCanvas` is monolithic and lives only on `/editor`. Cross-route handoffs go through localStorage with `operari:*` keys.
- **`WorkflowNode` ≠ `RunbookStep`** — `WorkflowNode` (in `@operari/shared`) is the **canvas UI** representation: position, ports, drag state. `RunbookStep` (in Prisma) is the **persisted** entity: id, config, retry policy. The post-pivot rebrand renamed the entity but kept the canvas concept as "workflow" because "the workflow editor renders the runbook" still reads cleanly. Don't try to unify them.
- **Live log streaming gate** — `/runs/:id`'s live-tail event log only fills if `OPERARI_DURABLE_ENGINE=true` is set. Both compose files default that to true; bare `node start` setups don't. When the timeline looks empty during a RUNNING run, check this flag first — the SSE endpoint exists, the frontend consumes it, but the engine writes events through the gated `ExecutionEventStore`.
- **Tests** — Jest both sides. Backend tests mock Prisma + AuthService; frontend uses RTL + jsdom. Never use `--no-coverage` in CI.
- **Commits** — Conventional Commits, lowercase scope + subject, body explains the _why_. No Co-Author trailer in this repo.
- **Comments** — Default to none. Add only when the _why_ is non-obvious (hidden constraint, surprising behaviour, workaround for a specific bug). Never describe _what_ the code does.

---

## What this file is not

- **Not a roadmap** — that lives in the README's "Roadmap" section.
- **Not API docs** — those live at `/api/docs` (Swagger UI) when the backend is running.
- **Not architecture decisions** — those go in [docs/adr/](./docs/adr/) as ADR files. This is the _shape_; ADRs are the _why_.

When you change the shape (new top-level module, new helper page, new cross-cutting concern), update the map above. When you don't, leave it alone.
