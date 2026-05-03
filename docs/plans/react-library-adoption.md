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
| `prism-react-renderer` | 2 (lighter alternative) | Same niche; pick if `shiki` SSR doesn't fit                |

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

| Lib                    | Tier                    | Lands at                                           |
| ---------------------- | ----------------------- | -------------------------------------------------- |
| `@uiw/react-json-view` | 1 ⭐                    | BaseStepNode inspect bubbles, ResponseViewer       |
| `react-json-view-lite` | 2 (lighter alternative) | Smaller bundle, no search; pick if bundle pressure |

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

| #   | Lib                                | Lift | First landing                                                                                                                                                                                                                                 |
| --- | ---------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~`nanoid`~~                       | —    | **DROPPED in adoption — see live progress.** Existing `randomId()` produces UUIDs that become Prisma primary keys; nanoid would mix ID formats in DB. Local-only ID sites (snapshots, HttpTester history) aren't pain points worth migrating. |
| 2   | `react-error-boundary`             | 1h   | Per-route segment boundaries (`[lang]/editor/error.tsx`, etc.)                                                                                                                                                                                |
| 3   | `sonner`                           | 1h   | Toaster in root layout. First migration: HttpTester `setError`                                                                                                                                                                                |
| 4   | `@radix-ui/react-tooltip`          | 2h   | Reemplazar `title=` en NodeContextToolbar buttons                                                                                                                                                                                             |
| 5   | `react-hotkeys-hook`               | 2h   | Centralize `?` / `Ctrl+Enter` / `Esc` listeners                                                                                                                                                                                               |
| 6   | `class-variance-authority`         | 2h   | Variant API for buttons + chips, starting with NodeContextToolbar                                                                                                                                                                             |
| 7   | `@tanstack/react-query` + devtools | 8h   | `QueryClient` provider; pilot migration: `useExecutionSocket` backfill                                                                                                                                                                        |

**Order within Sprint 1 (revised after nanoid finding):**

1. sonner (instant UX win visible)
2. Radix tooltip (pieza Radix más chica como prueba)
3. react-error-boundary (mejora la red de seguridad antes de más cambios)
4. react-hotkeys-hook
5. cva
6. react-query (el más grande, último)

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
- 2026-05-02 — `nanoid` dropped from Sprint 1 after install. Reason:
  the original `randomId()` produces `crypto.randomUUID()` values that
  become Prisma primary keys (`RunbookStep`, `RunbookConnection`).
  Replacing with nanoid mixes UUID + non-UUID ids in the same column;
  the only call sites that aren't DB PKs are snapshot ids and
  HttpTester `HistoryEntry` ids, which aren't pain. Package removed.
  Re-evaluate only if a future feature genuinely needs short shareable
  ids (e.g. shareable run links).
- 2026-05-02 — `sonner` mounted at root layout (`app/layout.tsx`).
  First migration: Toolbar `handleDryRun` error paths now `toast.error`
  alongside the existing `setStatus('error', ...)`. Future migrations
  remove the inline error pills as their consumers move over.
- 2026-05-02 — `@radix-ui/react-tooltip` mounted via Provider at the
  root and consumed via a `HoverTooltip` wrapper in
  `components/ui/Tooltip.tsx`. First migration: NodeContextToolbar's
  6 buttons (Run from here, Duplicate, Disable/Enable, breakpoint,
  Detach, Delete) — `title=` removed in favor of the bubble. Provider
  delays: 200ms hover, 300ms skip-delay across siblings.
- 2026-05-02 — `react-error-boundary` installed +
  `components/ui/SurfaceBoundary.tsx` wrapper created. Defaults to a
  compact dark fallback with a Retry button that calls
  `resetErrorBoundary`; on error fires a `toast.error` via sonner so
  the operator notices even if the fallback is below the fold. First
  surfaces wrapped: Inspector + EditorRunConsole in `Canvas.tsx`
  (resetKeys: runbookId / executionId so a fresh load gives the
  subtree another shot). Also added Next.js `error.tsx` for
  `/sql-editor` and `/http-tester` to match the `/editor` and
  `/dashboard` ones already in the tree.
- 2026-05-02 — `react-hotkeys-hook` installed. Migrated 4 ad-hoc
  keyboard listeners: `?` toggles HelpDrawer in 3 surfaces (editor /
  sql-editor / http-tester) — replaced ~15 LOC of useEffect boilerplate
  with one-line `useHotkeys('shift+/', ...)` per site. Form-tag
  gating is built-in. `Ctrl/Cmd+Enter` in the HTTP tester also
  migrated (with `enableOnFormTags: true` since that chord intentionally
  fires from inputs).
- 2026-05-02 — `class-variance-authority` installed. Created
  `components/ui/buttonVariants.ts` with two helpers: `iconButton`
  (square 7×7 buttons that line floating toolbars; tones: neutral /
  primary / destructive; supports `active: true` for engaged toggles)
  and `chipButton` (bordered text+icon buttons in toolbar headers;
  tones: neutral / primary). First migration: NodeContextToolbar's
  6 buttons — replaced the `${buttonClass} hover:bg-...` ternary
  scaffolding with `iconButton({ tone, active })`. Compound variants
  unify the active-state foreground tint per tone so a "remove
  breakpoint" toggle and a delete button share the same red
  semantics without duplicating Tailwind classes.
- 2026-05-02 — `@tanstack/react-query` + `@tanstack/react-query-devtools`
  installed. `lib/react-query/QueryProvider.tsx` mounts a single
  QueryClient with tuned defaults (30s stale, 5min gc, no
  refetch-on-focus, 1 retry). Devtools render dev-only at
  bottom-left so they don't fight the editor's run console. Pilot
  migration: `useStepStats` — same return shape (`{ stats, loading,
refresh }`) and same `enabled` gate, but the manual
  `useEffect + AbortController + tick counter` is gone. `refresh()`
  now calls `queryClient.invalidateQueries`. Sprint 1 ✅ done; the
  remaining read-only fetches (account list, schema metadata,
  runbook GET, dashboard overview) follow the same recipe in
  Sprint 2.
- 2026-05-02 — Sprint 2 begins. `@formkit/auto-animate` installed.
  Pilot: `RequestForm` HTTP headers list — single ref via
  `useAutoAnimate` makes adding/removing rows slide instead of
  snap. Zero per-row code change.
- 2026-05-02 — `date-fns` installed. Pilot: `HistorySidebar`
  `relativeTime()` migrated from a hand-rolled "X ago" ladder to
  `formatDistanceToNow` with locale (en/es). Same callsite signature
  preserved. RunDetail / RunHistory / EventsPage / Approval inbox /
  AuditChain / etc still hand-roll timestamps; subsequent commits
  will move them over with the same recipe.
- 2026-05-02 — `@uiw/react-json-view` installed. Built
  `components/ui/JsonInspect.tsx` wrapper (dark theme, narrow
  indent, collapse-at-depth-1 default, scalar fallback). Pilot:
  `BaseStepNode` input + output inspect bubbles replace the old
  `<pre>JSON.stringify(...)</pre>` with a collapsible viewer.
  ResponseViewer migration follows.
- 2026-05-02 — `react-hook-form` + `@hookform/resolvers` + `zod`
  installed. **`zod` pinned to `^3.25` (not v4)**: zod v4 is
  pure-ESM and broke Jest's CommonJS resolution across the entire
  test suite (173/173 failed on `Cannot use import statement
outside a module`). Pinning to v3 also matches backend (which
  uses zod v3.24), which sets up future schema sharing via
  `@operari/shared`. Pilot: `LoginForm` migrated. 4 useState fields
  collapsed into one `useForm<LoginValues>`. Schema is lenient on
  purpose (auth servers do real validation; we only catch obvious
  empties / malformed-shape submissions client-side). Test suite
  still green (310/310).
- 2026-05-02 — `@tanstack/react-table` installed (no migration in
  this commit). Real pilot — `/runs` history with sort + filter +
  pagination — needs ~4–6h of UI work and will land in its own
  commit; shipping a half-baked migration now would be churn.
