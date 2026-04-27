# ADR 0005 — Rebrand to Cairn

**Status**: Accepted
**Date**: 2026-04-10

## Context

The project started as **NanoFlow** — a generic n8n-style workflow editor. In
early 2026 we pivoted to **runbook automation for SREs and platform engineers**
(see ADR 0002 and the post-pivot cleanup audit). The rebrand to **NanoRun**
started but never finished: the repo still carries 77 references to `nanoflow`
alongside 278 references to `nanorun` in the same files, and neither name tells
the product's story.

Two names were competing for the same space and neither one was pulling its
weight:

- **NanoFlow** — legacy name from the pre-pivot era. Implies a generic "flow"
  tool (Jira Flow, Microsoft Flow, n8n). Does not convey runbooks, SRE, or
  durable execution.
- **NanoRun** — literal but flat. "Run" is the most overloaded word in devops
  (CI runs, test runs, k8s runs). Does not differentiate from Rundeck.

## Decision

Rebrand to **Cairn**.

A _cairn_ is a pile of stones left by climbers to mark the safe path on a
mountain. When you are lost in a whiteout at altitude, you follow the cairns.

That is exactly what a runbook is: **a marker left by someone who walked this
path before so the next operator does not get lost during an incident**. The
metaphor is not decorative — it is the product's core value proposition in one
word:

- A cairn is **durable**. Weather passes, cairns remain. Mirrors our durable
  execution engine (ADR 0003): runs survive restart, resume from the last
  completed step.
- A cairn is **shared**. Climbers leave them for strangers. Runbooks are
  shared knowledge between on-call shifts.
- A cairn is **tested**. Every cairn you see was placed by someone who
  survived. Every good runbook encodes a past incident's lessons.

Secondary benefits:

- **Short and memorable**: 5 letters, pronounceable in English and Spanish
  (`kairn`). Clean CLI: `cairn run deploy-prod`.
- **Uncluttered namespace**: no major software project uses this name as of
  this ADR. Checked npm, PyPI, and GitHub org availability.
- **Unique metaphor in the devops space**: Rundeck, StackStorm, incident.io,
  Temporal, Airflow — none evoke the "trail marker" idea. This gives us a
  distinctive positioning hook.
- **Earth-tone palette**: differentiates visually from the sea of purple/blue
  dev tool brands (Linear, Railway, Stripe, Fly.io, Vercel). See the palette
  section below.

## Naming rules

- Lowercase in code and URLs: `cairn`, `@cairn/sdk`, `cairn.dev`
- Capitalized in prose and UI chrome: "Cairn"
- CLI binary: `cairn`
- NPM scope: `@cairn/*`
- Python package: `cairn`
- Docker image: `cairn/server`, `cairn/runner`
- GitHub org: `cairn-run` (reserved if `cairn` is taken)

## Color palette

Single source of truth. Every downstream theme token (light/dark/high-contrast)
derives from this palette. Do not introduce new colors outside this list.

| Role       | Token               | Hex       | Notes                               |
| ---------- | ------------------- | --------- | ----------------------------------- |
| Primary    | `--cairn-stone`     | `#78716C` | Core brand color. Slate stone.      |
| Accent     | `--cairn-moss`      | `#65A30D` | Primary interactive. Deep moss.     |
| Secondary  | `--cairn-sky`       | `#0EA5E9` | Secondary links / info. Alpine sky. |
| Background | `--cairn-granite`   | `#0C0A09` | Default dark background.            |
| Surface    | `--cairn-graphite`  | `#1C1917` | Panels, cards, toolbars.            |
| Border     | `--cairn-weathered` | `#44403C` | Borders, dividers.                  |
| Text       | `--cairn-snow`      | `#FAFAF9` | Default text on dark.               |
| Text muted | `--cairn-fog`       | `#A8A29E` | Secondary text.                     |
| Success    | `--cairn-lichen`    | `#22C55E` | Run succeeded, healthy.             |
| Warning    | `--cairn-gold`      | `#F59E0B` | Paused, waiting, warning.           |
| Error      | `--cairn-sunset`    | `#DC2626` | Run failed, error.                  |
| Info       | `--cairn-ice`       | `#38BDF8` | Pending, queued.                    |

Light mode inverts background/surface/text but keeps the accent/status hues.

## Migration strategy

Mechanical rename across the codebase in atomic commits, in this order:

1. Decision doc and theme tokens (this ADR + `globals.css` palette)
2. User-facing strings: landing page, editor chrome, messages en/es
3. Package names: `@nanoflow/*` and `@operari/*` → `@cairn/*`
4. Python SDK: `nanorun` → `cairn`
5. Docker compose, env vars, CI workflow names
6. Docs: README, CONTRIBUTING, SECURITY, ADRs, templates
7. Internal code comments and localStorage keys

### Things we do NOT rename

- Prisma migration filenames (historical, changing them breaks the hash chain)
- Git history and existing commits
- The repo directory on disk (`NanoFlow/`) — GitHub rename is a separate step
- Third-party API names in tests (Stripe, WorkOS, Sentry, Datadog are still
  named themselves)
- Variables in vendored/external code

### LocalStorage key migration

The editor stores user state in keys like `nanoflow-workflow-<id>` and
`nanoflow-autosave-enabled`. On rename, users would lose their local snapshots.
Mitigation: the editor reads both the new `cairn-*` key and the legacy
`nanoflow-*` / `nanorun-*` keys for one release cycle, then drops the legacy
path. Documented in the migration commit.

## Consequences

- One large refactor pass. Expected size: ~150 files touched, mostly
  mechanical substitutions.
- External URLs that include the old name (docs, npm package pages, landing
  page meta) need redirects. List tracked as a follow-up issue.
- This is the last rename. If Cairn does not stick, we rename the company, not
  the product.
