# ADR 0007 — Editor canvas rebuild on React Flow v12, behind a flag with deferred cutover

- **Status:** accepted (V2 implemented, cutover pending QA)
- **Date:** 2026-04-30
- **Context links:** branch `feat/editor-reactflow-rebuild`, `frontend/components/Editor/v2/`, `frontend/lib/canvas/v2/`, `frontend/state/editorStoreV2.ts`, `frontend/hooks/v2/`

## Context

The editor canvas at `frontend/components/Editor/EditorCanvas.tsx`
plus its supporting hooks (`useEditorCanvas`, `useCanvasRenderer`,
`useEditorViewport`, `useEditorSelection`, `useEditorConnections`,
`useEditorNodes`, `useEditorTools`, `useEditorSnapToGrid`, plus
`utils/canvas/`, `utils/portAnchor.ts`, `utils/drawing.ts`) was a
fully custom DOM + Canvas 2D implementation: roughly 1500 LOC of pan,
zoom, marquee, drag, port-aware bezier routing, animated flow orbs,
frame nesting, cycle detection — every interaction handwritten.

Three pressures pointed away from continuing on the custom canvas:

1. **Compounding maintenance cost.** Every additional feature we wanted
   to ship on the editor — touch / mobile, accessibility, minimap,
   keyboard navigation, undo/redo polish, virtualization for graphs
   beyond ~100 nodes — was code we would have to write and own.
2. **Open-source onboarding friction.** External contributors recognize
   `@xyflow/react`. Asking them to learn a bespoke canvas to add a
   step type lowers the bar for spurious "I tried but it broke" PRs.
3. **The data model already aligned ~70% with React Flow's model**
   (`WorkflowNode {id, type, position, ...}` ↔ RF `Node {id, type,
position, data}`; `Connection {id, source, target, sourcePort,
targetPort}` ↔ RF `Edge {id, source, target, sourceHandle,
targetHandle}`). The semantic translation was cheap _now_; once
   YAML, plugins, and live-execution events accumulated more bespoke
   shape, it would not stay cheap.

Three approaches were on the table:

| Option                                                       | Risk to in-flight users                 | Effort                             | Long-term maintenance                  |
| ------------------------------------------------------------ | --------------------------------------- | ---------------------------------- | -------------------------------------- |
| **A — Keep custom, optimize incrementally**                  | None                                    | Low per feature, high total        | Highest — owned forever                |
| **B — Gradual migration (replace pieces)**                   | Medium — half-RF/half-custom for months | Medium-high                        | Medium — partial coupling lingers      |
| **C — Clean rebuild on RF v12 behind a flag, then cut over** | Low if QA gates the cutover             | High up front (one ~3-week sprint) | Lowest — RF owns the canvas primitives |

## Decision

**Adopt option C.** Build a parallel V2 editor on `@xyflow/react` v12
behind the `NEXT_PUBLIC_OPERARI_EDITOR_V2` flag. Keep V1 unchanged in
the tree. Once QA confirms parity, run the destructive cutover (delete
V1, rename V2 → canonical names, drop the flag) as a single PR — see
the cutover plan in §"Cutover" below.

V2 lives in three new namespaces and is wired into the existing
`/[lang]/editor` route via the flag. No backend, Prisma, YAML, or plugin
SDK contract is changed.

### Architectural commitments

| ID  | Decision                                                                                                                                           | Rationale                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Library: `@xyflow/react` v12 (MIT). Not legacy `reactflow`.                                                                                        | v12 is the current line; React 19 + Next 15 supported.                                                                                    |
| A2  | State: Zustand store + `zundo` middleware (50-step history, partialize to nodes/edges only).                                                       | Recommended by RF docs. `zundo.pause()` / `resume()` collapses each drag into one undo entry.                                             |
| A3  | Edges: SVG-only via `getBezierPath` + CSS `stroke-dashoffset` keyframe + `<animateMotion>` orb.                                                    | Removes the Canvas 2D rAF loop. SVG SMIL stays inside RF's transform, animates on the GPU, no parallel render pipeline.                   |
| A4  | Frames: `parentId` + `extent: 'parent'`. Auto-parent on drag-stop via `getIntersectingNodes`.                                                      | RF native. The "smallest containing frame wins" rule supports nesting.                                                                    |
| A5  | Live status: `useReactFlow().updateNodeData(id, patch)` driven by socket.io events.                                                                | Re-renders only the affected node (vs `setNodes(map)` re-rendering all). Critical for graphs with many running steps.                     |
| A6  | Cycle detection: in-store hook walks the graph on edge change; `isValidConnection` blocks new cycles.                                              | RF doesn't ship this. ~80 LOC, O(V+E) per change, only writes when a flag actually flips so it doesn't loop.                              |
| A7  | Snap-to-grid: built-in `snapToGrid` + `snapGrid={[20, 20]}`.                                                                                       | Matches V1's `SNAP_GRID_PX = 20`.                                                                                                         |
| A8  | Persistence: bidirectional adapter `WorkflowNode ↔ RfNode`, `Connection ↔ RfEdge`. Backend untouched.                                              | Existing PUT shapes, YAML round-trip, plugin SDK all keep working.                                                                        |
| A9  | Frame `parentId` is mirrored into `config._frame.parentId` so it survives the strict zod schema on the backend, which strips top-level `parentId`. | The hard contract from `backend/src/types/runbook.types.ts:270`. The shadow inside `config` is opaque JSON to zod and round-trips intact. |
| A10 | Copy/paste & undo/redo: hand-rolled (~30 LOC each). RF Pro examples are reference only.                                                            | License-clean, full control, no Pro dependency.                                                                                           |
| A11 | Cutover: feature-flag gated; V1 stays in tree until QA confirms. Cutover is one PR.                                                                | De-risks. Rollback during QA = flip env var. Rollback after cutover = revert one PR.                                                      |

### Hard contracts the rebuild preserves

These are immutable. Breaking any of them would break the backend, the
YAML round-trip, plugins, or live execution. The V2 adapter and store
respect each of them.

- YAML schema (`version=1`, `name`, `steps[]` non-empty, `_retry`/`_runIf`/`_skipIf`
  meta-keys preserved by `splitMeta`).
- `PUT /api/runbooks/:id` body shape: `{ nodes: WorkflowNode[],
connections: WorkflowConnection[] }` zod-validated.
- `PUT /api/runbooks/:id/yaml` body shape: `{ yaml: string }` validated
  via `validateRunbookSpec`.
- Socket event enum: `node_status` carries `{ nodeId, status, timestamp,
result? }` with status ∈ `RUNNING | SUCCESS | FAILED | PAUSED |
SKIPPED | CANCELLED`. Frontend identifies nodes by `nodeId` only.
- Plugin SDK: `defineStep` and `configSchema.parse()` semantics
  unchanged. Reserved type prefixes (`shell`, `approval`, `notify`,
  `wait`, `ssh`, `runbook`, `operari.*`) untouched.
- localStorage handoffs: `operari:pendingHttpStep` (HTTP tester →
  editor), `operari-workflow-{id}`, `operari-workflow-{id}-timestamp`
  (autosave fallback).

## Consequences

**Positive:**

- The custom canvas's load-bearing concerns (pan, zoom, drag, marquee,
  selection, snap-to-grid, viewport math, port resolution from DOM)
  are now owned by `@xyflow/react`. Future feature work picks up RF's
  ecosystem (minimap, controls, accessibility primitives) for free.
- The V2 namespace is fully isolated: `frontend/components/Editor/v2/`,
  `frontend/hooks/v2/`, `frontend/lib/canvas/v2/`,
  `frontend/state/editorStoreV2.ts`. V1 callers don't import any of it.
  The cutover PR will be mechanical: delete V1, rename V2.
- Test coverage of the new code is meaningful where it counts: the
  adapter (8 tests covering `parentId` round-trip via `_frame`,
  config meta-keys, port indices), `findCyclicEdgeIds` (5 graph
  scenarios), graph helpers (10 tests for sort/descendants/
  innermost-frame), clipboard remap (7 tests for selection capture
  and ID regeneration). 30 tests total.
- The `_frame` shadow (A9) is the kind of contract trick that needs
  documentation — recording it in this ADR avoids a future contributor
  ripping it out as "weird" without realising it's load-bearing
  against the strict zod schema.

**Negative:**

- ~3 weeks of engineering effort up front before V2 ships any new
  user-visible feature. The bet is that this pays back across the
  next year of editor work.
- Two editors live in the tree until cutover. Anyone reading
  `frontend/components/Editor/` for the first time will see both.
  This ADR is the answer to "why are there two." `CLAUDE.md` will
  point here once V2 is canonical.
- Some V1 visual flourishes did not survive: the gradient and pulse
  flow styles (Canvas 2D-only) are not in V2; only the marching dash
  and orb are. If users miss them, they are SVG-implementable as a
  follow-up — they are not load-bearing.

**Untouched:**

- Backend: `backend/src/routes/runbook.routes.ts`,
  `backend/src/runbook/yaml/`, the Prisma schema, every executor, and
  the plugin SDK — none of these are modified.
- V1 editor: `frontend/components/Editor/EditorCanvas.tsx` and its
  hooks render unchanged when the flag is off.
- Cross-route handoffs: HTTP tester → editor via
  `operari:pendingHttpStep` works on both V1 and V2 (V2 reuses the
  same localStorage key, just consumed by a different component).

## Cutover

The cutover is gated on a one-week internal QA window with
`NEXT_PUBLIC_OPERARI_EDITOR_V2=true` set against the current
`feat/editor-reactflow-rebuild` branch. The acceptance checklist
(25 items spanning pan/zoom/select, edge connection + cycle
prevention, frame nesting, live run animations, YAML round-trip,
mobile, dark mode, etc.) lives in the local-only planning doc at
`docs/plans/editor-reactflow-rebuild.md` (gitignored under
`/docs/*`).

**Once QA passes:** one PR deletes V1, renames V2 → canonical names
(`CanvasV2 → Canvas`, `editorStoreV2 → editorStore`,
`useExecutionSocketV2 → useExecutionSocket`, etc.), removes the
`NEXT_PUBLIC_OPERARI_EDITOR_V2` flag, and updates this ADR's status
from "accepted (V2 implemented, cutover pending QA)" to "accepted".

**If QA reveals a blocker:** flip the env var off, fix on the V2
branch, repeat the QA window. V1 stays as the rollback path until
the cutover PR merges.

## Alternatives considered

- **A — Keep custom, optimize incrementally:** rejected because the
  cost compounds. Each feature added to the custom canvas is owned
  forever; switching after another year of feature work is
  significantly harder than switching now.
- **B — Gradual piece-by-piece migration:** rejected because mixing
  RF's own viewport / drag with the custom Canvas 2D edge layer
  produces a half-state where neither system fully owns the canvas.
  The state coupling between drag, edge rendering, and viewport math
  in V1 is too tight to swap one at a time without weeks of "make
  these two coexist" glue that gets thrown out at the end anyway.
- **React Flow Pro features (paid undo/redo, copy/paste, dynamic
  grouping, auto-layout):** rejected because every paid example's
  underlying API is open-source MIT. Hand-rolling each (~30 LOC)
  keeps the project license-clean and gives full control over the
  history boundaries (e.g. one drag = one undo entry, which the Pro
  example does not encode the same way).
