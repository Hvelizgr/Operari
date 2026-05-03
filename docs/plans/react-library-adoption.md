# React library adoption plan

**Status:** proposed
**Date:** 2026-05-02
**Author:** session research (Operari frontend audit)

This is a roadmap for adopting React-ecosystem libraries that fill
concrete pain points observed across the editor / SQL editor / API
tester / dashboard / runs surfaces. It is **not** an ADR — every item
here is reversible, opt-in per surface, and ordered by ROI rather
than by architectural commitment.

## Context

The frontend already has a solid foundation: Next.js 15 App Router,
React 19, Zustand 5 (+ zundo for history), React Flow 12,
framer-motion, Tailwind, react-window, xterm, socket.io-client,
ai-sdk, ajv, dagre, html-to-image, react-markdown. The gap is **not**
visualisation or state — it's the ergonomic layer:

1. Manual `fetch + useState + useEffect` triple for every data load
   (~20 hooks across the app).
2. Hand-rolled popovers, dialogs, dropdowns, tooltips, context menus
   — accessibility ad-hoc, focus traps inconsistent.
3. Forms (`RequestForm`, `RunbookInputsPanel`, login/signup, MFA,
   settings) all manage state per field with no validation library.
4. SQL editor is a `<textarea>` with regex highlighting. YAML view
   modal similar. Step `command` fields plain textarea.
5. Inspect bubbles (BaseStepNode) + ResponseViewer (HttpTester) emit
   `<pre>{JSON.stringify}</pre>` — no collapse, no search, no copy
   by path.
6. Dashboard sparklines are hand-rolled divs proportional to
   `durationMs`. No proper tooltips or trend lines.
7. Inspector / canvas / RunConsole splits are fixed sizes.
8. Keyboard shortcuts (`?`, `Ctrl+Enter`, `Esc`) are 3 separate
   listeners with manual input gating.
9. Reordering inputs / headers / breakpoints is up/down buttons.
10. Transient feedback (run started, save failed, breakpoint hit)
    is inline error pills only — no toast system.

## Filters applied

- ❌ Conflicts with Tailwind (MUI / Chakra / Mantine).
- ❌ Conflicts with Next.js App Router (react-router-dom).
- ❌ Conflicts with declared product non-goals (real-time collab →
  no yjs / liveblocks / replicache).
- ❌ Duplicates existing capability (zustand alternatives, framer
  alternatives).
- ❌ Deprecated (react-beautiful-dnd, react-dnd, formik in new code).
- ✅ Headless (composes with Tailwind).
- ✅ Tree-shakeable (Turbopack benefits).
- ✅ Active maintenance + downloads.

## Catalogue (35+ libraries evaluated)

### A. Data fetching & cache

| Lib                              | Tier | Lands at                                                                                              |
| -------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `@tanstack/react-query`          | 1 ⭐ | `useExecutionSocket`, `useStepStats`, `useLoadRunbook`, accounts, schema metadata, dashboard overview |
| `@tanstack/react-query-devtools` | 1    | Pairs with #1, dev only                                                                               |
| `@microsoft/fetch-event-source`  | 2    | Future SSE client for `/api/runs/:id/events/stream` (durable engine)                                  |

### B. Headless UI primitives (Radix family)

| Lib                             | Tier |
| ------------------------------- | ---- |
| `@radix-ui/react-dialog`        | 1 ⭐ |
| `@radix-ui/react-popover`       | 1 ⭐ |
| `@radix-ui/react-tooltip`       | 1 ⭐ |
| `@radix-ui/react-dropdown-menu` | 1    |
| `@radix-ui/react-tabs`          | 2    |
| `@radix-ui/react-select`        | 2    |
| `@radix-ui/react-context-menu`  | 2    |
| `@radix-ui/react-scroll-area`   | 3    |
| `vaul` (drawer for mobile)      | 2    |

Decision: pick **Radix** over `react-aria-components` (heavier) and
`@headlessui/react` (less complete coverage).

### C. Command palettes & search

| Lib    | Tier | Lands at                                  |
| ------ | ---- | ----------------------------------------- |
| `cmdk` | 1 ⭐ | Replace `SearchPalette` (G R / G S / G A) |

### D. Forms & validation

| Lib                   | Tier              |
| --------------------- | ----------------- |
| `react-hook-form`     | 1 ⭐              |
| `zod`                 | 1 ⭐              |
| `@hookform/resolvers` | 1                 |
| `@rjsf/core`          | 2 (research more) |

### E. Code editors

| Lib                                                                        | Tier            | Lands at                                                        |
| -------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| `@uiw/react-codemirror` + `@codemirror/lang-sql` + `@codemirror/lang-yaml` | 1 ⭐            | Replace `SQLCodeEditor`, `YamlViewModal`, shell `command` field |
| `@monaco-editor/react`                                                     | 2 (alternative) | Diff mode included; ~1.5MB                                      |

### F. Syntax highlighting (read-only)

| Lib                    | Tier                    | Lands at                                                   |
| ---------------------- | ----------------------- | ---------------------------------------------------------- |
| `shiki`                | 1                       | HelpDrawer code blocks (server-rendered), audit event JSON |
| `prism-react-renderer` | 2 (lighter alternative) |

### G. Tables

| Lib                     | Tier | Lands at                                  |
| ----------------------- | ---- | ----------------------------------------- |
| `@tanstack/react-table` | 1 ⭐ | `/runs` history, audit log, accounts list |

### H. Charts

| Lib        | Tier | Lands at                             |
| ---------- | ---- | ------------------------------------ |
| `recharts` | 1 ⭐ | Dashboard sparklines, p50/p95 trends |
| `tremor`   | 2    | Built on recharts; KPI cards         |

### I. Layout

| Lib                      | Tier           | Lands at                                                                  |
| ------------------------ | -------------- | ------------------------------------------------------------------------- |
| `react-resizable-panels` | 1 ⭐           | Editor / Inspector / RunConsole, SQL editor / results, HttpTester req/res |
| `dockview-react`         | 3 (reach goal) | VS Code-style docking                                                     |

### J. Drag & drop

| Lib                                   | Tier | Lands at                               |
| ------------------------------------- | ---- | -------------------------------------- |
| `@dnd-kit/core` + `@dnd-kit/sortable` | 1 ⭐ | Reorder inputs / headers / breakpoints |

### K. JSON inspection

| Lib                    | Tier                    | Lands at                                     |
| ---------------------- | ----------------------- | -------------------------------------------- |
| `@uiw/react-json-view` | 1 ⭐                    | BaseStepNode inspect bubbles, ResponseViewer |
| `react-json-view-lite` | 2 (lighter alternative) |

### L. Diff viewers

| Lib                    | Tier                        | Lands at               |
| ---------------------- | --------------------------- | ---------------------- |
| `@git-diff-view/react` | 1 (when runbook diff lands) | RunbookVersion compare |

### M. Toasts

| Lib      | Tier |
| -------- | ---- |
| `sonner` | 1 ⭐ |

### N. Keyboard shortcuts

| Lib                  | Tier |
| -------------------- | ---- |
| `react-hotkeys-hook` | 1 ⭐ |

### O. Date/time + cron

| Lib                | Tier              |
| ------------------ | ----------------- |
| `date-fns`         | 1 ⭐              |
| `react-js-cron`    | 2                 |
| `cronstrue`        | 2 (pairs with #2) |
| `react-day-picker` | 3                 |

### P. Animation / micro-interactions

| Lib                     | Tier   | Lands at                                          |
| ----------------------- | ------ | ------------------------------------------------- |
| `@formkit/auto-animate` | 1      | Palette categories, template gallery, header rows |
| `lenis`                 | 3      | Smooth scroll on /runs                            |
| `animejs`               | REMOVE | In deps but unused; framer covers everything      |

### Q. Files / uploads / export

| Lib                   | Tier |
| --------------------- | ---- |
| `react-dropzone`      | 2    |
| `papaparse`           | 2    |
| `@react-pdf/renderer` | 3    |

### R. Error boundaries & telemetry

| Lib                    | Tier            |
| ---------------------- | --------------- |
| `react-error-boundary` | 1 ⭐            |
| `@sentry/react`        | 1               |
| `posthog-js`           | 2               |
| `@vercel/analytics`    | 3 (Vercel only) |

### S. State machines

| Lib                        | Tier | Lands at                                                          |
| -------------------------- | ---- | ----------------------------------------------------------------- |
| `xstate` + `@xstate/react` | 2    | Frontend run state (idle → loading → running → paused → terminal) |

### T. Storage

| Lib          | Tier | Lands at                                                                 |
| ------------ | ---- | ------------------------------------------------------------------------ |
| `idb-keyval` | 2    | Replace localStorage autosave fallback (LS quota tight for big runbooks) |

### U. Misc utilities

| Lib                        | Tier |
| -------------------------- | ---- |
| `class-variance-authority` | 1 ⭐ |
| `nanoid`                   | 1    |
| `superjson`                | 2    |
| `@uidotdev/usehooks`       | 2    |

## Adoption plan

### Sprint 1 — Foundations (1–2 weeks, ~30–40h)

Ground every later refactor on shared infrastructure. No
user-visible features yet, but every subsequent item gets faster.

| #   | Lib                                | Lift | First landing                                                          |
| --- | ---------------------------------- | ---- | ---------------------------------------------------------------------- |
| 1   | `nanoid`                           | 30m  | Replace `randomId()` in `frontend/utils/runbookYaml.ts` + adapter      |
| 2   | `react-error-boundary`             | 1h   | Per-route segment boundaries (`[lang]/editor/error.tsx`, etc.)         |
| 3   | `sonner`                           | 1h   | Toaster in root layout. First migration: HttpTester `setError`         |
| 4   | `@radix-ui/react-tooltip`          | 2h   | Reemplazar `title=` en NodeContextToolbar buttons                      |
| 5   | `react-hotkeys-hook`               | 2h   | Centralize `?` / `Ctrl+Enter` / `Esc` listeners                        |
| 6   | `class-variance-authority`         | 2h   | Variant API for buttons + chips, starting with NodeContextToolbar      |
| 7   | `@tanstack/react-query` + devtools | 8h   | `QueryClient` provider; pilot migration: `useExecutionSocket` backfill |

**Order within Sprint 1:**

1. nanoid (cero riesgo, prueba el path de instalar libs)
2. react-error-boundary (mejora la red de seguridad antes de más cambios)
3. sonner (instant UX win visible)
4. Radix tooltip (pieza Radix más chica como prueba)
5. react-hotkeys-hook
6. cva
7. react-query (el más grande, último)

### Sprint 2 — Forms & data tables (1–2 weeks, ~25–30h)

| Lib                                               | Lift | Uses                                                      |
| ------------------------------------------------- | ---- | --------------------------------------------------------- |
| `react-hook-form` + `zod` + `@hookform/resolvers` | 12h  | login, signup, RequestForm HTTP, RunbookInputsPanel, MFA  |
| `@tanstack/react-table`                           | 8h   | /runs history, audit log                                  |
| `@uiw/react-json-view`                            | 2h   | Inspect bubbles + ResponseViewer                          |
| `date-fns`                                        | 1h   | Replace manual timestamps in /runs, /audit, footer        |
| `@formkit/auto-animate`                           | 1h   | Palette categories, RunbookInputsPanel rows, HTTP headers |

### Sprint 3 — Code editing & layout (1–2 weeks, ~25–30h)

| Lib                                            | Lift | Uses                                                              |
| ---------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `@uiw/react-codemirror` + lang-sql + lang-yaml | 12h  | SQLCodeEditor, YamlViewModal                                      |
| `react-resizable-panels`                       | 4h   | Editor / Inspector / RunConsole, SQL editor / results, HttpTester |
| `shiki`                                        | 4h   | HelpDrawer code blocks + audit event JSON                         |
| `cmdk`                                         | 6h   | Replace SearchPalette                                             |

### Sprint 4 — Observability & polish (1–2 weeks, ~20–25h)

| Lib                           | Lift | Uses                                   |
| ----------------------------- | ---- | -------------------------------------- |
| `recharts`                    | 10h  | Dashboard sparklines + p50/p95 trends  |
| `@sentry/react`               | 4h   | Error tracking + source maps           |
| `@dnd-kit/core` + `sortable`  | 6h   | Reorder inputs / headers / breakpoints |
| `react-js-cron` + `cronstrue` | 4h   | Visual cron builder for Schedule field |

### Sprint 5+ — On demand

| Lib                                   | Trigger                                         |
| ------------------------------------- | ----------------------------------------------- |
| `xstate`                              | When `useExecutionSocket` shows transition bugs |
| `@git-diff-view/react` or Monaco diff | When runbook diff is requested                  |
| `@react-pdf/renderer`                 | Audit reports PDF                               |
| `react-dropzone` + `papaparse`        | Plugin upload, CSV export                       |
| `tremor`                              | If dashboards expand                            |
| `posthog-js`                          | Onboarding analytics                            |
| `@microsoft/fetch-event-source`       | If native EventSource shows weakness            |

## Risks

1. **Bundle size** — Sprints 1–3 add ~150–200KB gzip if everything is
   adopted. Mitigation: route-level code splitting (App Router does
   this automatically when pages are properly split).
2. **Radix vs ad-hoc UI** during transition — inconsistency between
   refactored and non-refactored surfaces. Mitigation: refactor
   whole component per PR, not partial.
3. **react-query overlapping with socket.io** — risk of double
   refetch. Mitigation: socket events call
   `queryClient.invalidateQueries(...)` directly; never both setState
   and invalidate.
4. **CodeMirror vs Monaco** — if diff mode arrives later and we
   chose CodeMirror, we pay a migration. Mitigation: start with
   CodeMirror, install Monaco only when diff lands.
5. **animejs unused in deps** — clean up before sprint to confirm.

## Explicit non-recommendations

| Lib                                        | Why not                                      |
| ------------------------------------------ | -------------------------------------------- |
| `react-router-dom`                         | Conflicts with App Router                    |
| MUI / Chakra / Mantine                     | Conflicts with Tailwind                      |
| `react-beautiful-dnd`, `react-dnd`         | Deprecated; @dnd-kit is the successor        |
| `redux-toolkit`, `jotai`, `valtio`         | Zustand already serves; no pain              |
| `lexical`, `tiptap`                        | Rich-text framework — wrong use case         |
| `react-aria-components` (instead of Radix) | Heavier, smaller ecosystem                   |
| `swr` (instead of react-query)             | Subset; no reason to pick the lesser         |
| `formik`                                   | Inferior to react-hook-form                  |
| `moment.js` / `dayjs` / `luxon`            | date-fns is the modern tree-shakeable choice |
| `yup`                                      | zod wins on backend share + better TS        |
| `lodash`                                   | Modern JS + remeda cover everything          |
| `react-spring`                             | framer-motion is a superset                  |
| `yjs`, `@liveblocks/react`, `replicache`   | Real-time collab is a non-goal               |
| `ag-grid-react`                            | Commercial features overkill                 |
| `@vercel/analytics`                        | Only if deploying on Vercel                  |

## Success metrics

- Sprint 1 done: every new feature uses `react-query`, `sonner`,
  `react-hotkeys-hook` by default. Tests pass. tsc clean.
- Sprint 2 done: form-heavy surfaces (Inspector, RequestForm,
  RunbookInputsPanel) lose ≥30% of their LOC.
- Sprint 3 done: SQL/YAML editing pasa de "pasable" a "production-grade".
- Sprint 4 done: dashboard tells a story (trends, not just dots).

## Live progress (updated as we go)

- 2026-05-02 — plan saved (this file).
