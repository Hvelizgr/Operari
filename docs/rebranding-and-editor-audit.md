# NanoRun — Rebranding strategy + editor feature audit

**Date:** 2026-04-07
**Source docs:** `IMPLEMENTACION_NANORUN.md` (P0/P1 roadmap), `INVESTIGACION_NANORUN_2026.md` (market research)
**Status:** research, informs upcoming `feat/rebrand-runbook-vocab` and `feat/editor-cleanup` branches

This doc captures (1) the positioning the rebrand is enforcing, (2) the
concrete vocabulary and surface changes, and (3) which editor features
should stay, get repurposed, or be dropped given the runbook automation
direction.

---

## 1. Positioning recap (from INVESTIGACION § 4 + § 14)

**One-liner**: NanoRun is the *Sentry for operational procedures* —
open source, dev-first, visual, AI-native, and actually executable.

**Quadrant the product owns**:

```
                  PROACTIVE (planned procedures)
                              │
   StackStorm (dead)          │       NanoRun ◄── HOLE
   Rundeck (expensive/legacy) │
   ───────────────────────────┼───────────────────────────
   ENTERPRISE                 │                  DEV-FIRST
                              │       incident.io / Rootly
                              │       Resolve.ai / Cleric
                              │
                  REACTIVE (incident response)
```

The "Proactive + Dev-first" cell is empty. Incident management tools
own the reactive side; IDPs (Backstage / Port / Cortex) catalog
services but never execute. Rundeck owns the proactive side but is
priced at $125/seat and feels like 2014.

**Wedge** (INVESTIGACION § 14.3 mandates picking ONE — recommendation:
**deploy runbooks for K8s startups**):

- Persona 1: SRE / platform engineer at 50-300 person company,
  series A-C cloud-native, currently maintains dead Confluence +
  bash scripts + Jenkins jobs. Pain: "every secret rotation eats
  half a day".
- Buys bottom-up. Up to $500-2K/month without escalation.
- Discovers via HN, GitHub trending, peer recommendations.

**Promise**: NanoRun turns ops procedures from *anxious manual rituals*
into *executable, versioned, audit-logged artifacts*.

---

## 2. Vocabulary changes (find / replace)

| Today (n8n heritage) | NanoRun | Why |
|---|---|---|
| `Workflow` (user-visible) | `Runbook` | The product pivot. INVESTIGACION uses "runbook" 80+ times. |
| `Workflow editor` | `Runbook editor` or `Canvas` | "Canvas" implies composition, "editor" implies document |
| `Node` (in UI copy) | `Step` | SREs think in "steps of a runbook" |
| `Connection` / `edge` | `Sequence` or `dependency` | Connections are execution order, not data flow |
| `Run` / `Execution` | `Run` (keep) — `Execution` stays in code | Run is the natural verb + noun |
| `Variables` / `input` | `Inputs` / `runbook variables` | Match the schema YAML in INVESTIGACION § 15.3 |
| `Workflow templates` | `Runbook library` | Library = curated org asset |
| `Workflows` (sidebar) | `Runbooks` | — |
| `NanoFlow` (any residual) | `NanoRun` | Brand pivot |
| `"Build complex workflows"` | `"Visual runbooks for engineers"` | Match README, distance from Zapier |
| `"Drag-and-drop workflow builder"` | `"Stop hiding ops in dead Confluence wikis"` | Persona-pain framing |
| `"2000+ pre-built nodes"` | `"Shell-native, approval-gated, audit-logged"` | Real differentiators |
| `"Save Workflow"` button | `"Save"` | Drop the noun |
| `"Workflow Properties"` panel | `"Runbook Settings"` | Settings is more SRE; properties is ORM-flavored |
| `"Untitled Workflow"` | `"Untitled runbook"` | — |

**Tagline candidates** (in priority order):
1. **"Visual runbooks for engineers."** (already in README, hero)
2. **"Stop running deploys from a Confluence page."** (subtitle / persona-pain)
3. **"The Sentry for operational procedures."** (positioning, not hero)

**Tone for copy** (per persona "tired SRE"):
- **Direct, not cute.** Zero "magic", "delight", "easy". SREs hate that.
- **Concrete.** No "powerful" or "robust" — use numbers and commands:
  "shell scripts that survive a backend restart", "approval gates with
  HMAC-signed Slack callbacks", "audit chain you can verify with
  `nanorun audit verify`".
- **Code-adjacent.** Mono fonts in marketing, real YAML, terminal
  screenshots, not BI dashboards.
- **Anti-Zapier.** Use words like `kubectl`, `helm`, `bash`, `psql`,
  `terraform` in hero copy. Whoever doesn't recognize those isn't the
  buyer.

**Visual language**:
- Keep dark palette already in the editor — terminal/IDE vibe.
- Mono fonts for identifiers (JetBrains Mono / Geist Mono / IBM Plex
  Mono — same as Vercel / Linear / Cursor).
- Outline icons (Lucide already in use).
- **NOT** Zapier-style colorful gradients.

---

## 3. Naming decisions to lock in

| Question | Recommendation |
|---|---|
| "Step" or "Node" in UI? | **Step** in user-visible copy, keep `Node` in code |
| Editor name? | **Canvas** (matches INVESTIGACION § 4 "visual node-based canvas", matches Linear/Figma vibe) |
| What's a single execution called? | **Run** in copy, **Execution** only in existing code. "Job" = Rundeck legacy, avoid. |
| Step output? | **Output** for the value, **Logs** for stdout/stderr, **Artifact** only when we ship file storage |
| "Approval gate" or "Approval"? | **Approval gate** — more SRE, matches CI/CD vocabulary |
| "Runner" / "Executor" / "Worker"? | **Runner** — already consistent in code, matches GitHub Actions |
| AI thing: "Agent" / "Copilot" / "Assistant"? | **Agent** — matches INVESTIGACION § 9.1. "Copilot" is too GitHub. |
| Wedge | **Deploy runbooks for K8s startups** (per § 14.3) |

---

## 4. Surface area of the rebrand

**~80-100 user-visible strings** spread across **12-15 files**.
Estimated effort: **4-6 hours** find/replace + QA.

| File | ~ count | Notes |
|---|---|---|
| `frontend/messages/en.json` | 8 | i18n strings |
| `frontend/messages/es.json` | 8 | translations |
| `frontend/app/[lang]/content/en.ts` | 20+ | marketing taglines, features, use cases |
| `frontend/app/[lang]/content/es.ts` | 20+ | translations |
| `frontend/components/Editor/TopBar.tsx` | 4 | "Run Workflow" button, title |
| `frontend/components/Editor/EditorSidebar.tsx` | 2 | menu item |
| `frontend/components/Editor/EditorCanvas.tsx` | 8 | aria-labels, default name, save/load |
| `frontend/components/Editor/WorkflowPropertiesPanel.tsx` | 2 | panel title + filename |
| `frontend/components/Node/NodePalette.tsx` | 14 | category names + descriptions |
| `frontend/components/Common/Onboarding.tsx` | 2 | tutorial copy |
| `frontend/components/Workflow/**` | 6 | RunDialog, TemplateGallery, etc. |
| `README.md` | several | hero + features |

**What does NOT get renamed (deliberately)**:
- `Workflow` Prisma model — breaking change for existing data, no value
- `WorkflowNode`, `WorkflowConnection` types in TS — internal, backwards compat
- `/api/workflows` legacy endpoint — coexists with `/api/v1/runbooks`,
  deprecate gradually
- `frontend/components/Editor/` directory name — structural, no payoff

---

## 5. Editor feature audit

The frontend is **70% aligned** with the new direction. The remaining
30% is bloat from n8n heritage. A 1-2 week cleanup pass clears the
way.

### 5.1 ✂️ Drop without remorse (n8n vestiges)

**Categories to delete from `NodePalette.tsx`** — ~28 nodes total:

| Category | Why | Nodes |
|---|---|---|
| **Social Media** | SREs don't tweet from runbooks | Twitter, LinkedIn, Facebook, Instagram, Discord (legacy), Reddit, TikTok, YouTube |
| **Marketing & CRM** | Wrong wedge, wrong persona | HubSpot, Salesforce, Mailchimp, Pipedrive, ActiveCampaign, Klaviyo |
| **E-commerce / Payments** | Same | Shopify, Stripe (as integration node), PayPal, Square |
| **Productivity (non-dev)** | Same | Notion, Airtable, Trello, Google Sheets, Google Docs, Microsoft Excel |
| **Storage (consumer)** | Keep S3 only (artifacts/logs) | Google Drive, Dropbox, OneDrive, Box |

**Individual nodes to drop** even from kept categories:

| Node | Why |
|---|---|
| `n8n-nodes-base.executeWorkflow` | Sub-runbooks add accidental complexity. Use HTTP call to trigger another runbook. |
| `n8n-nodes-base.merge` | Data-flow concept. Runbooks don't fan-out / fan-in. |
| `n8n-nodes-base.function` | Duplicate of `code` |
| `n8n-nodes-base.code` | Conflicts with shell node. Backend has `isolated-vm` sandbox; runbooks should use bash. |
| Data transforms (`Filter`, `JSON Parse`, `Item Lists`, `Split In Batches`, `Rename Keys`) | ETL primitives. Runbooks aren't ETL. Use `shell` + `jq`. |
| `n8n-nodes-base.wait` (trigger-level) | Name conflict with `wait.executor.ts` |
| `n8n-nodes-base.scheduleTrigger` + `cron` overlap | Keep one cron-style |
| `n8n-nodes-base.manualTrigger` | "Run" button covers it |
| `n8n-nodes-base.emailSend` | Notify covers alerting; email rare in incident ops |
| `n8n-nodes-base.controller` (multiplex/split/join) | "Multiplex 100 branches" never appears in real runbooks |
| AI provider nodes (OpenAI, Anthropic, HuggingFace, Stability, LangChain) | The agent is global, not per-step |

**Result**: palette shrinks from **72 → ~20 nodes**. Massive noise reduction.

### 5.2 🔄 Repurpose (UI work, not drops)

| Today | Becomes | Effort |
|---|---|---|
| **Notify** (generic webhook) | Native **Slack Notify** + **Discord Notify** + **Generic Webhook** with interactive buttons (approve/escalate/rollback) | Medium |
| **HTTP Request** | HTTP Request **with auth templates** (GitHub Bearer, Datadog API key, Sentry DSN) | Low |
| **Loop** | Split into **Retry** + **Iterate** | Low |
| **Approval** | Rename to **Approval Gate**, build **Approval Inbox** UI (`/approvals`) | Medium |
| **Postgres / MySQL / Redis** | Keep Postgres, drop the others | Low |
| **GitHub** (generic) | **GitHub PR Merge**, **GitHub Status Check**, **GitHub Issue Create** (3 native nodes) | Medium |
| **Code (JS sandbox)** | Drop as first-class, mark advanced-only | Zero (delete) |
| **Frame node** | Keep, rename to "Section" in UI | Low |
| **Snapshots** | Rename to "Versions", add publish-to-prod | Medium |

### 5.3 ✅ Amplify (already aligned, make them shine)

| Feature | File | Action |
|---|---|---|
| **Shell executor + LogTerminal xterm.js** | `Editor/terminal/LogTerminal.tsx`, backend `shell.executor.ts` | Move shell to top of palette. Add "Common Commands" quick-insert (kubectl, helm, aws, restart service). |
| **Approval gate** | backend `approval.executor.ts`, route `v1/approvals.routes.ts` | Build Approval Inbox dashboard + Slack interactive buttons |
| **AI agent** | `agent/orchestrator.ts` | Build side-panel that opens on step failure with the failure context |
| **Webhook receiver with HMAC** | `routes/webhook.routes.ts` (HMAC bug fixed in commit 035f9d2) | UI to generate URLs + show "Triggered by: GitHub push from main, sha abc123" |
| **Run history + audit chain** | backend has it; frontend missing | Build `/runs` with timeline filterable, link to logs, comparison |
| **OTel run=trace, step=span** | `observability/run-tracer.ts` | Each step shows its trace span id, link to Grafana/Jaeger |
| **Templates seed** | `templates/*.yaml` (6 already exist) | Build **Runbook Library** UI listing them as starting points |
| **Snapshots / autosave** | `useSnapshots`, `useAutosave` | Rename to "Versions" + UI for diff between versions |
| **Multi-select + chains** | `useEditorSelection.ts` | Keep — useful for 30-step runbooks |
| **Cycle detection** | `useEditorCanvas.ts` | Rename error to "Step graph contains a cycle — runbooks must be acyclic" |

### 5.4 🆕 Gaps (must build for the wedge)

| Gap | Why blocking | Effort | Priority |
|---|---|---|---|
| **Approval Inbox** (`/[lang]/approvals`) | Backend already emits `approval.requested`; without UI, humans use CLI — friction for non-eng | ~1 day | **P0** |
| **Run history timeline** (`/[lang]/runs/:id`) | Backend has `Execution`, `NodeLog`, audit — need UI page | ~1.5 days | **P0** |
| **Step retry config UI** | Per-step "retry 3x with 5s backoff" | ~4h | **P0** |
| **Secret picker** | Shell nodes need `$SLACK_TOKEN`; `ConnectedAccountService` exists but UI missing | ~6h | **P0** |
| **Run from step X** | "Re-run from the approval I just signed" — backend has replay, UI doesn't expose | ~3h | **P0** |
| **YAML preview/edit toggle** | SREs want git-versioned runbooks (Argo CD style) | ~1 day | **P1** |
| **Pre/post conditions** ("Skip If" / "Run If") | Cleaner than separate IF nodes for guards | ~6h | **P1** |
| **Schedule UI** (cron picker) | Visual cron picker reduces typos | ~4h | **P2** |
| **Run trigger config UI** | Map "Sentry alert → run runbook X" | ~6h | **P2** |
| **Estimated run time** | Show ETA from historical metrics | Low | **P3** |

**Total realistic** to fix the 5 P0 gaps: **5-7 days of frontend**.

### 5.5 Proposed node palette (7 categories, ~20 nodes)

| Category | Nodes | Backend status |
|---|---|---|
| **Triggers** (3) | Webhook, Cron, Manual (UI button) | webhook ✅ |
| **Core** (5) | Shell, HTTP Request, Set Variable, IF/Condition, Switch | shell ✅, http ✅, condition ✅, transform ✅ |
| **Flow Control** (3) | Loop / Retry, Error Handler, Wait/Delay | loop ✅, wait ✅, delay ✅ |
| **Human in Loop** (2) | Approval Gate, Notify (Slack/Discord) | approval ✅, notify ✅ |
| **DevOps Integrations** (4) | GitHub, Docker, Postgres, AWS S3 | http-based ⏳ |
| **AI** (1) | Agent Step (Claude/GPT prompt) | mastra → AI SDK ✅ |
| **Organization** (2) | Frame/Section, Note | frame ✅, note ✅ |
| **TOTAL** | **~20 nodes** | from 72 today |

---

## 6. Execution plan

### Fase R0 — Visible rebrand (1 day, ~6h)

Branch: `feat/rebrand-runbook-vocab`

1. Find/replace `workflow` → `runbook` in `messages/`, `content/`, user-visible components
2. Rebrand `TopBar`, `EditorSidebar`, `EditorCanvas`, `WorkflowPropertiesPanel`, `NodePalette`
3. Marketing components (`Footer`, `Navbar`, landing) — taglines + hero copy
4. README hero (verify already aligned)
5. **Single commit**, easy rollback

### Fase R1 — Editor cleanup (1-2 days, ~12h)

Branch: `feat/editor-cleanup`

1. Delete 28+ social/marketing/payment/productivity nodes from `NodePalette.tsx`
2. Delete obsolete categories
3. Drop `executeWorkflow`, `function`, `code`, `manualTrigger`, `merge`, `controller`, etc.
4. Reorganize palette into the 7 proposed categories
5. Move Shell to top, add quick-insert for `kubectl` / `helm` / `aws`
6. Smoke test: load existing runbooks, confirm referenced nodes still exist

### Fase R2 — Approval Inbox + Run History (3-5 days, ~25h)

Branch: `feat/approval-inbox-and-run-history`

1. `/[lang]/approvals` page: table of pending approvals, WebSocket for real-time
2. One-click approve/reject (endpoints already exist)
3. `/[lang]/runs` page: timeline filterable
4. Per-run detail page with steps, durations, logs (consume `GET /executions/:id/logs`)
5. Diff between two runs of the same runbook

### Fase R3 — YAML toggle + step config (5-8 days, ~40h)

Branch: `feat/yaml-and-step-config`

1. Visual ↔ YAML toggle (Monaco editor)
2. Per-step retry config UI (count, backoff, max-delay)
3. Per-step `runIf` / `skipIf`
4. Secret picker component reading `ConnectedAccountService.list()`
5. E2E tests

### Fase R4 — AI assist side-panel (5-10 days, ~50h)

Branch: `feat/ai-assist-panel`

1. Side panel that opens on step failure
2. Connection to `agent/orchestrator.ts`
3. Context window: stdout/stderr + last 5 step outputs
4. SSE streaming response
5. Action buttons: "Apply suggested fix", "Open documentation", "Mark as known issue"

---

## 7. Decisions to lock before any code

1. **Confirm wedge**: K8s deploys vs DB migrations vs both. INVESTIGACION
   says pick ONE. Without this the rebrand is "cleanup" but not
   "positioning".
2. **Verify domains + USPTO**: `nanorun.dev` / `.io` / `.com`. Listed
   as TODO before Show HN in INVESTIGACION § 14.
3. **Confirm license**: AGPL server + MIT SDK (already in README ✅).
4. **Discovery interviews**: 30 SRE / Platform engineer interviews
   per § 18.2. Non-negotiable. Without these the wedge is *guessed*,
   not validated. Start in parallel with Fase R0/R1.

## 8. Risks

- **R1**: Rebrand copy without palette cleanup → "runbooks" message
  but Twitter node visible → confused brand.
- **R2**: Big features (AI panel) without palette cleanup → carry
  obsolete code paths nobody uses.
- **R3**: Full rebrand without discovery interviews → invest weeks in
  a direction the market hasn't validated.

## 9. Tactical recommendation

**This week**:
1. Verify domains + trademark (blocking)
2. Run first 5-10 discovery interviews (don't wait for all 30)
3. In parallel: execute **Fase R0** (rebranding copy) + **Fase R1**
   (palette cleanup) — atomic, reversible

**Next 2 weeks**:
- Start Fase R2 (Approval Inbox + Run History)
- Adjust wedge based on first interviews

**Month 1-2**:
- Fase R3 + R4
- Brutal "Show HN: NanoRun" README
- v0.1 launch on HN
