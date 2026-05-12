# Plan — Editor rebuild on React Flow v12

**Branch**: `feat/editor-reactflow-rebuild`
**Status**: Draft, not started
**Owner**: TBD
**Estimated effort**: ~3 weeks (15 working days), single engineer

---

## 1. Why we are doing this

The current editor canvas is a fully custom Canvas 2D + DOM implementation (~1000 LOC in `useEditorCanvas.ts`, plus `useCanvasRenderer.ts`, `useEditorViewport.ts`, `drawing.ts`, `portAnchor.ts`). Every interaction we add — touch support, keyboard accessibility, minimap, undo/redo, virtualization for large graphs, mobile drag, snap improvements — is code we write and maintain ourselves.

Three things make rebuilding now (rather than later) the right call:

1. **Compounding cost**: each new feature on the custom canvas grows the surface area we have to keep working. Today the custom code is ~1000 LOC; in six months of feature work it will be 3000+ and the migration is much harder.
2. **Open-source onboarding**: external contributors recognize React Flow. Asking them to learn a custom canvas is a barrier to PRs that add node types.
3. **The data model already aligns** ~70% (see §3). The semantic translation is cheap _now_; once YAML round-trip, plugin properties, and live-exec events accumulate more bespoke shape, it gets expensive.

We are doing this **as a clean reinterpretation, not a migration**: build the new editor on `feat/editor-reactflow-rebuild`, get it to feature parity behind a feature flag, then cut over and delete the old code.

## 2. Goals & non-goals

### Goals

- Replace canvas, viewport, drag, selection, edges, and node rendering with `@xyflow/react` v12.
- Preserve all hard data contracts (§3) — backend, YAML, plugins, execution stream untouched.
- Match feature parity for: smart bezier edges with port-aware routing, animated dash + flow orb on RUNNING edges, frame nesting with auto-parenting, multi-select drag, marquee, snap-to-grid, copy/paste, undo/redo (50 steps), live status badges from socket.io.
- Keep the existing toolbar, sidebar, inspector, command palette, run dialog, schedule dialog, YAML modal, GitHub branch panel, AI assist panel — they wrap the canvas and don't need to move.

### Non-goals

- Not changing the YAML schema, REST endpoints, Prisma schema, plugin SDK, or socket events. The rebuild is **frontend-only** below the editor route.
- Not redesigning the visual language. Same colors, same node chrome, same theme tokens.
- Not adding new features (collaborative editing, auto-layout from AI, etc.) — those land after parity.
- Not supporting React Flow Pro features by paying for them. We re-implement undo/redo and copy/paste ourselves; it's ~30 LOC each.

## 3. Hard contracts the rebuild MUST preserve

These are the immutable interfaces. Breaking any of them breaks the backend, the YAML round-trip, plugins, or live execution. Source: research dump in §11.

- YAML `version=1`; `name` non-empty; `steps[]` non-empty.
- Each step has `id`, `type`, `position: {x,y}`. `config` preserves `_retry`, `_runIf`, `_skipIf` meta-keys.
- `next` accepts `string | string[] | StepConnection[]`. Connections carry `fromPort` / `toPort` for branching.
- `PUT /api/runbooks/:id` body shape: `{ nodes: WorkflowNode[], connections: WorkflowConnection[], ...}` validated by zod. `WorkflowNode` requires `id, type, title, position`. `WorkflowConnection` requires `id, source, target`; ports are integers ≥0 or undefined.
- Prisma `RunbookStep`: `parentId` is **frontend-only**, not persisted. Frame nesting round-trips to YAML via position only — losing it is SOFT, but we should preserve it via a `_frame: { parentId }` config meta-key (see §5, Phase 4) so it survives saves.
- Socket events: `node_status` carries `{ nodeId, status, timestamp, result? }`. Status enum: `RUNNING | SUCCESS | FAILED | PAUSED | SKIPPED | CANCELLED`. Frontend identifies nodes by `nodeId` only.
- Plugin `defineStep`: `configSchema.parse()` must validate; canvas writes config that conforms to the schema, no extra wrapping.
- Reserved type prefixes (cannot be used by plugins): `shell, approval, notify, wait, ssh, runbook, operari.*`.
- localStorage handoff: `operari:pendingHttpStep` (HTTP tester → editor); `operari-workflow-{id}`, `operari-workflow-{id}-timestamp` (autosave fallback).
- DOM/CSS reactivity: `<html data-bg-pattern>`, `--grid-size`, `--grid-opacity` — settings page writes, canvas reads.

## 4. Architectural decisions

These pin down the shape of the rebuild. Each is a decision, not an option.

| #   | Decision                                                                                                                                                                                   | Rationale                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Library**: `@xyflow/react` v12 (MIT). Not legacy `reactflow`.                                                                                                                            | v12 is the current line; React 19 + Next 15 are supported.                                                                                                                 |
| A2  | **State**: Zustand store + `zundo` middleware for undo/redo. Source of truth = the store.                                                                                                  | RF docs recommend Zustand for non-trivial editors. `zundo` gives us 50-step history with `pause()`/`resume()` for transactional boundaries (one drag = one history entry). |
| A3  | **Edges**: SVG-only via custom `SmartBezierEdge` using `getBezierPath` + `<animateMotion>` for orbs + CSS keyframe `stroke-dashoffset` for the marching dash.                              | Canvas 2D overlay was an option but adds a parallel render pipeline. SVG SMIL is GPU-accelerated, lives inside RF's transform, and removes the rAF loop.                   |
| A4  | **Frames**: `parentId` + `extent: 'parent'` (RF native). Auto-parent on drag via `onNodeDragStop` + `getIntersectingNodes`. Frame node is a custom node type with resize handles.          | RF v12 supports compound nodes natively. Auto-parent is not built-in but the pattern is well-documented and ~20 LOC.                                                       |
| A5  | **Live status**: socket.io → `useReactFlow().updateNodeData(nodeId, { status })`. Custom node reads `data.status` and animates.                                                            | `updateNodeData` re-renders only the targeted node (as opposed to `setNodes(map)` which re-renders all). Critical for 100+ node graphs.                                    |
| A6  | **Cycle detection**: custom hook using `getOutgoers` in `isValidConnection`. Cyclic edges drawn red via the edge component reading a `cyclic` flag in `data`.                              | RF doesn't ship cycle detection. Pattern is documented; we already have the algorithm in `useEditorConnections`.                                                           |
| A7  | **Snap-to-grid**: built-in `snapToGrid` + `snapGrid={[20,20]}`.                                                                                                                            | Matches existing `SNAP_GRID_PX = 20`.                                                                                                                                      |
| A8  | **Auto-layout**: `elkjs` (already a candidate). Not dagre — elkjs supports nested compound graphs, which we need for frames.                                                               | Dagre 0.8.5 is currently in deps for layout-only; keep it for now, add elkjs in Phase 7 only if the "Tidy up" button is wanted.                                            |
| A9  | **Copy/paste & undo/redo**: hand-rolled, ~30 LOC each. RF Pro examples are reference only.                                                                                                 | License-clean, full control.                                                                                                                                               |
| A10 | **Persistence shape**: untouched. New canvas serializes back to existing `WorkflowNode[]` / `WorkflowConnection[]` shape via a thin adapter at the persistence boundary.                   | Backend must not move.                                                                                                                                                     |
| A11 | **Cutover**: feature flag `OPERARI_EDITOR_V2=true` env var (read on server) gates the route to the new editor. Old code stays in tree until parity is verified, then is deleted in one PR. | De-risks the cutover; lets us A/B internally before deleting code.                                                                                                         |

## 5. Phased breakdown

Each phase has a goal, scope, deliverables, an **engineer prompt** ready to paste into a fresh chat with a coding agent, and a "definition of done."

The phases are sequential. Each ends in a PR that merges to `feat/editor-reactflow-rebuild` (not main). Final cutover PR merges the branch to main.

---

### Phase 0 — Foundations (1 day)

**Goal**: install React Flow, scaffold a minimal canvas behind the feature flag, smoke-test that React 19 + Next 15 + RF v12 work together.

**Scope**:

- Install `@xyflow/react` and `zustand` + `zundo`.
- Add `OPERARI_EDITOR_V2` env var; route `/[lang]/editor` checks it and renders either `<EditorCanvas />` (old) or `<EditorCanvasV2 />` (new).
- New canvas just shows three demo nodes connected by two edges, with default RF interactions.
- Import `@xyflow/react/dist/style.css` in `frontend/app/globals.css` **before** Tailwind layers.
- Wrap the new editor route in `<ReactFlowProvider>`.
- Confirm no SSR warning (canvas tree starts with `'use client'`).

**Deliverables**:

- `frontend/components/Editor/v2/CanvasV2.tsx` (smoke test).
- `frontend/components/Editor/v2/nodeTypes.ts`, `edgeTypes.ts` (empty registries, defined at module scope).
- Env var wired through `frontend/lib/featureFlags.ts` (or wherever flags live).
- New deps in `frontend/package.json` and lockfile committed.

**Definition of done**:

- Visit `/editor` with `OPERARI_EDITOR_V2=true` → see the demo canvas, drag nodes, pan, zoom.
- Visit with flag off → see existing editor. No regression.
- `npm run typecheck` passes. `npm test` passes (no new tests in this phase).

**Engineer prompt**:

> Set up the foundations for a React Flow v12 rebuild of the NanoFlow editor on branch `feat/editor-reactflow-rebuild`.
>
> 1. Install `@xyflow/react`, `zustand`, `zundo` in `frontend/package.json`.
> 2. Add a feature flag `OPERARI_EDITOR_V2` read from `process.env`. Wire it so `frontend/app/[lang]/editor/page.tsx` renders `<EditorCanvasV2 />` when true, otherwise the existing `<EditorCanvas />`.
> 3. Create `frontend/components/Editor/v2/` with:
>    - `CanvasV2.tsx` — `'use client'`, wraps `<ReactFlow />` in `<ReactFlowProvider>`, shows 3 demo nodes + 2 edges to prove the integration works.
>    - `nodeTypes.ts` and `edgeTypes.ts` exporting empty objects defined at module scope (per RF docs, must not be inline).
> 4. Add `@import '@xyflow/react/dist/style.css';` to `frontend/app/globals.css` BEFORE the Tailwind directives.
> 5. Confirm the page renders with no SSR warnings, no React 19 ref warnings, and existing `/editor` still works when the flag is off.
>
> Hard constraints: do not touch `frontend/components/Editor/EditorCanvas.tsx` (the old canvas), `useEditorCanvas.ts`, `useCanvasRenderer.ts`, or any backend file. Do not change YAML, Prisma, or socket code.
>
> Done when: typecheck passes, both routes render, demo canvas supports pan/zoom/drag, lockfile is committed.

---

### Phase 1 — Domain primitives & store (2 days)

**Goal**: stand up the Zustand store, the type adapter, and YAML round-trip on the new canvas.

**Scope**:

- Create `frontend/state/editorStoreV2.ts` with Zustand + zundo. State: `{ nodes: Node[], edges: Edge[], runbookId, savedAt }`. Actions: `onNodesChange`, `onEdgesChange`, `onConnect`, `addNode`, `removeNodes`, `updateNodeData`, `loadFromRunbook`, `getRunbookPayload`.
- Create `frontend/lib/canvas/v2/adapter.ts`:
  - `workflowNodeToRfNode(WorkflowNode): RfNode`
  - `rfNodeToWorkflowNode(RfNode): WorkflowNode` (strips `measured`, `selected`, `dragging`, `positionAbsolute`).
  - `workflowConnectionToRfEdge(WorkflowConnection): Edge`
  - `rfEdgeToWorkflowConnection(Edge): WorkflowConnection`
- Wire `loadFromRunbook` to call `GET /api/runbooks/:id`, then `GET /api/runbooks/:id/yaml` if needed (current behavior in `EditorCanvas.tsx:216-249`).
- Wire `getRunbookPayload` to produce the existing `PUT /api/runbooks/:id` body shape.
- Configure `zundo` with `limit: 50`, `partialize` to history only nodes/edges (not viewport).

**Deliverables**:

- The store, the adapter, basic save/load wired into `CanvasV2`.
- Unit tests for adapter round-trip (`__tests__/adapter.test.ts`): take a `WorkflowNode`, convert to RF, back, assert deep-equal.

**Definition of done**:

- Open an existing runbook in V2 — nodes appear in correct positions, edges connect correctly.
- Drag a node, refresh — position persists.
- Adapter round-trip test passes.

**Engineer prompt**:

> Build the state layer and persistence adapter for the V2 editor. Prerequisite: Phase 0 is merged.
>
> 1. Create `frontend/state/editorStoreV2.ts` — Zustand store wrapped in `zundo` middleware (`limit: 50`). State: `nodes`, `edges`, `runbookId`, `savedAt`. Actions: `onNodesChange`, `onEdgesChange`, `onConnect` (using `applyNodeChanges`, `applyEdgeChanges`, `addEdge` from `@xyflow/react`), plus `addNode`, `removeNodes`, `updateNodeData`, `loadFromRunbook(id)`, `getRunbookPayload()`. The `partialize` config must restrict history to `{ nodes, edges }` only.
> 2. Create `frontend/lib/canvas/v2/adapter.ts` with bidirectional converters between the project's `WorkflowNode` / `WorkflowConnection` (from `@operari/shared`) and React Flow's `Node` / `Edge`. The RF→Workflow direction MUST strip the RF-internal fields `measured, selected, dragging, positionAbsolute, dragHandle` and preserve all original `WorkflowNode` keys (id, type, title, position, enabled, config, inputs, outputs, parentId).
> 3. Wire load/save in `CanvasV2.tsx`. Load uses the same logic as `frontend/components/Editor/EditorCanvas.tsx` lines 216-249 (try REST nodes/edges first, fall back to YAML). Save via `PUT /api/runbooks/:id` with the body produced by `getRunbookPayload()`. Debounce 1s.
> 4. Add Jest tests for adapter round-trip in `frontend/lib/canvas/v2/__tests__/adapter.test.ts`. Take a fixture WorkflowNode, convert to RF, convert back, deep-equal.
>
> Hard contracts (from `docs/plans/editor-reactflow-rebuild.md` §3): `WorkflowNode` requires `id, type, title, position`. `WorkflowConnection` requires `id, source, target`. `config` must preserve `_retry`, `_runIf`, `_skipIf` meta-keys untouched.
>
> Do not change YAML serialization, the REST endpoints, or the Prisma schema. Do not touch the V1 editor.
>
> Done when: opening an existing runbook on V2 shows correct nodes/edges, drag-then-refresh persists, round-trip test passes, typecheck passes.

---

### Phase 2 — Custom nodes & palette (3 days)

**Goal**: render all 10 node types with their existing chrome (icon, title, color, handles, badges) and re-implement the palette drag-to-canvas flow.

**Scope**:

- One custom node component per type, wrapping the existing chrome (`EditorNode.tsx` styles, badges, status icons). Components in `frontend/components/Editor/v2/nodes/`:
  - `ShellNode`, `SshNode`, `HttpRequestNode`, `WebhookNode`, `CronNode`, `ApprovalNode`, `NotifyNode`, `WaitNode`, `FrameNode` (placeholder, real frame logic in Phase 4), `NoteNode`.
- Each node renders `<Handle>` for inputs (left) and outputs (right). Output handles use `id="ok"`, `id="err"` etc. so condition routing works.
- Register all in `nodeTypes.ts` at module scope.
- Re-wire `NodePalette` so dragging a palette item creates a node via `onDrop` + `screenToFlowPosition` (RF docs: drag-and-drop example).
- Inspector panel (`NodeConfigPanel.tsx`) — repoint to read selected node from Zustand store via `useReactFlow().getNodes().find(n => n.selected)` or equivalent. Form already exists (`DynamicNodeForm`); only the data wiring changes.

**Deliverables**:

- 10 custom node components.
- Updated palette with RF drag-drop.
- Inspector panel showing selected node, editing `data` → `updateNodeData`.

**Definition of done**:

- All node types appear correctly on the canvas with the same visual look as V1.
- Drag from palette → drop on canvas → node appears at drop point with correct type and default config.
- Click node → inspector opens, editing fields updates `node.data.config`, autosave fires.

**Engineer prompt**:

> Implement the 10 custom node types and the palette drag-to-canvas flow for the V2 editor. Prerequisite: Phase 1 merged.
>
> 1. For each of these node types, create a memoized custom node component in `frontend/components/Editor/v2/nodes/`: `ShellNode, SshNode, HttpRequestNode, WebhookNode, CronNode, ApprovalNode, NotifyNode, WaitNode, FrameNode, NoteNode`. Each component takes `NodeProps<Node<NodeData, '<type>'>>` from `@xyflow/react`. Reuse the existing visual chrome from `frontend/components/Node/EditorNode.tsx` — same icons, colors, status badges, disabled styling, error styling. Each node renders one or more `<Handle type="target" position={Position.Left}>` and `<Handle type="source" position={Position.Right} id="<port>">` matching the existing inputs/outputs from `frontend/components/Node/NodePalette.tsx`. Do NOT implement frame parenting yet — `FrameNode` is a placeholder this phase.
> 2. Register all components in `frontend/components/Editor/v2/nodeTypes.ts` at module scope.
> 3. Re-wire palette drag-to-create. Reuse existing `NodePalette` UI; on drag start, set DataTransfer with the node type. On `<ReactFlow>`'s `onDrop` handler in `CanvasV2.tsx`, use `useReactFlow().screenToFlowPosition({ x: e.clientX, y: e.clientY })` to compute drop position. Create a new node with default config from the palette's `NodeType.properties` defaults. Push via `addNode` action from the store.
> 4. Repoint `NodeConfigPanel.tsx` (the right-side inspector) to read the selected node from React Flow. Use `useReactFlow().getNodes()` filtered by `selected: true`, render the existing `DynamicNodeForm`. On form change, call `useReactFlow().updateNodeData(nodeId, { config: nextConfig })` so only that node re-renders.
>
> Hard contracts: handle IDs must match the source/target ports the YAML round-trip uses (`fromPort` / `toPort`). Output handle `id="0"` corresponds to `sourcePort: 0`, etc.
>
> Done when: all 10 node types render with correct chrome, palette drag-drop works, inspector edits propagate to the node, autosave fires on edit.

---

### Phase 3 — Custom edges with animations (3 days)

**Goal**: replicate the smart-bezier edges, port-direction-aware control points, animated marching dash on RUNNING, flow orbs, condition badges, cyclic-edge red styling.

**Scope**:

- `frontend/components/Editor/v2/edges/SmartBezierEdge.tsx` — uses `getBezierPath`. Reads `data.status` (idle | running | success | failed | skipped), `data.condition` (complete | success | error | warning | disabled), `data.cyclic` (boolean).
- Animation:
  - Marching dash via inline `style={{ strokeDasharray: '8 6', animation: 'rb-dash 800ms linear infinite' }}` + `@keyframes rb-dash` in `globals.css`.
  - Flow orb via SVG `<circle><animateMotion path={path} dur="1.4s" repeatCount="indefinite" /></circle>` — same path string as the visible stroke.
  - Pulse and gradient flow styles port over too. Read style preferences from `<html>` data-attrs (existing reactivity contract) into edge component via a small `useAppearance()` hook.
- Connection line preview while dragging from a handle: `connectionLineComponent` prop set to a similar curve so the live preview matches.
- Cycle detection: hook `useCycleDetection()` runs on store changes, marks edges with `data.cyclic = true`. `isValidConnection` blocks new edges that would create cycles.
- Condition badge: small SVG label group rendered at edge midpoint via `getBezierPath`'s second return value.
- Edge selection: built-in. Right-click context menu (delete, reroute) — re-implement with a simple hook on `onEdgeContextMenu`.

**Deliverables**:

- `SmartBezierEdge` with all visual states.
- `useCycleDetection` hook.
- Connection line preview component.
- Edge context menu.

**Definition of done**:

- Run a runbook → RUNNING edges march and orb travels.
- Try to connect node A → A: blocked. Try to connect a cycle: blocked, edges that would close the cycle render red.
- Toggle line style in Settings → all edges update without remount.
- Right-click an edge → context menu with delete works.

**Engineer prompt**:

> Implement the custom edge component for V2 with animated dash, flow orb, condition badges, and cycle detection. Prerequisite: Phase 2 merged.
>
> 1. Create `frontend/components/Editor/v2/edges/SmartBezierEdge.tsx`. Takes `EdgeProps<Edge<EdgeData>>`. `EdgeData` is `{ status?: 'idle'|'running'|'success'|'failed'|'skipped', condition?: 'complete'|'success'|'error'|'warning'|'disabled', cyclic?: boolean }`. Use `getBezierPath` from `@xyflow/react`. Render `<BaseEdge>` with the path. Inline style sets stroke color from condition, plus `strokeDasharray` and `animation` when running. The keyframe `rb-dash` is defined in `frontend/app/globals.css`: `@keyframes rb-dash { to { stroke-dashoffset: -14 } }`.
> 2. When `status === 'running'`, additionally render a `<g>` containing `<circle r="4" fill="var(--rb-orb)"><animateMotion dur="1.4s" repeatCount="indefinite" path="<the bezier path string>" /></circle>`. The orb path must be the same `path` string returned by `getBezierPath`.
> 3. Read appearance prefs from a new tiny hook `useAppearance()` that subscribes (via MutationObserver on `<html>`) to `data-line-style`, `data-flow-style`, `--xy-edge-color` etc. — the same DOM contract the V1 `useCanvasRenderer` reads from. Do not introduce a new contract.
> 4. Implement cycle detection. New hook `frontend/hooks/v2/useCycleDetection.ts` runs on every change to `nodes`/`edges` from the Zustand store, walks the graph using `getOutgoers`, marks edges that close a cycle by setting `data.cyclic = true` via `updateEdgeData`. Cyclic edges render red.
> 5. Set `isValidConnection` on `<ReactFlow>` to block connections that would create cycles (use `getOutgoers` + DFS as in the React Flow "prevent cycles" example) and self-loops.
> 6. Implement condition-badge rendering. At the bezier midpoint (use the `labelX`, `labelY` returned by `getBezierPath`), render an SVG label group with the condition text/icon. Reuse existing badge styling from V1.
> 7. Implement edge context menu via `onEdgeContextMenu` handler on `<ReactFlow>`. Show a floating menu with "Delete" and "Change condition" items. State for menu open/closed lives in `CanvasV2.tsx`.
> 8. Set `connectionLineComponent` prop on `<ReactFlow>` to a `<ConnectionLine>` component that draws the same bezier (using `getBezierPath`) so the live preview while dragging from a handle matches the committed edge.
> 9. Register `SmartBezierEdge` in `edgeTypes.ts` at module scope.
>
> Done when: an edge animates dash + orb during a real run, cyclic edges go red and `isValidConnection` blocks them, line-style toggle in Settings updates all edges live, edge context menu deletes, drag-from-handle preview line matches committed edge.

---

### Phase 4 — Frame nesting (2 days)

**Goal**: full frame functionality — auto-parent on drag-in, un-parent on drag-out, recursive descendant deletion, nested frames, child clamping, frame resize.

**Scope**:

- `FrameNode` component: title bar, color band, resize handles (use a tiny resize hook or `react-resizable`). Title editable inline.
- `parentId` + `extent: 'parent'` on children. Frame node always rendered first in the array (RF requirement).
- Auto-parent logic in `onNodeDragStop`: use `getIntersectingNodes(draggedNode)`, filter to type `frame`, pick the smallest one (so nested frames work). Update node's `parentId`, re-base position to parent-local coords. If dragged outside all frames, clear `parentId`.
- On node delete, recursively delete descendants (replicate `getDescendantIds` from V1).
- Persistence: write `parentId` into a `_frame: { parentId }` meta-key on `config` so YAML round-trip preserves it. Adapter handles both directions.

**Deliverables**:

- `FrameNode` with resize.
- Auto-parent / un-parent logic.
- Recursive delete.
- Adapter updated for `_frame` meta-key.

**Definition of done**:

- Drag a frame from palette → frame appears.
- Drag a node into the frame → node becomes a child (visually clamped).
- Drag the child outside → it un-parents.
- Nested frames work (frame inside frame).
- Save the runbook → reload → frame structure preserved.
- Delete a frame → all children deleted.

**Engineer prompt**:

> Implement frame nesting for the V2 editor. Prerequisite: Phase 3 merged.
>
> 1. Build `FrameNode` in `frontend/components/Editor/v2/nodes/FrameNode.tsx`: a custom node with title bar, colored border, and resize handles on the bottom-right corner. Inline-editable title via double-click. The node renders no `<Handle>` (frames don't connect). Width/height stored in `data.dimensions` and applied via `style` on the wrapper div.
> 2. Implement auto-parenting. In `CanvasV2.tsx`, add an `onNodeDragStop` handler. For each dropped node where `node.type !== 'frame'`, call `useReactFlow().getIntersectingNodes(node)` and filter to nodes with `type === 'frame'`. Pick the smallest by area (innermost wins for nested frames). If found: set `parentId = frame.id`, `extent = 'parent'`, and re-base `position` to parent-local coordinates by subtracting the frame's `positionAbsolute`. If not found: clear `parentId` and `extent`. Use `setNodes` from the store (this is the only place we use full setNodes; status updates use `updateNodeData`).
> 3. Ensure the `nodes` array order has frames before their children. Add a small invariant function `sortNodesForRf(nodes: Node[])` that topologically orders by `parentId` (frames first), called when loading and after parent changes.
> 4. Recursive delete. Override the default delete behavior on `onNodesDelete`: for each frame deleted, also delete every descendant (walk `parentId` tree). Reuse the existing `getDescendantIds` algorithm from V1.
> 5. Persistence. Update `frontend/lib/canvas/v2/adapter.ts`: when serializing to `WorkflowNode`, write `parentId` into `config._frame = { parentId }`. When deserializing, restore the top-level `parentId` field from `config._frame` if present. This lets YAML round-trip preserve frames without changing the YAML schema. Document this in the adapter as a comment (this is exactly the kind of non-obvious WHY that warrants a comment per CLAUDE.md).
> 6. Confirm `extent: 'parent'` clamps children inside the frame. If the user resizes the frame smaller than the children's bounding box, do nothing automatic (matching V1 behavior).
>
> Done when: drag-into-frame parents the node, drag-out un-parents, nested frames work, save+reload preserves structure, delete-frame deletes children.

---

### Phase 5 — Selection, keyboard, copy/paste, undo/redo (2 days)

**Goal**: feature parity for selection, marquee, keyboard shortcuts, copy/paste, undo/redo.

**Scope**:

- Selection: `selectionOnDrag` + `panOnDrag={[1, 2]}` (left = marquee, middle/right = pan). `multiSelectionKeyCode="Shift"`.
- Keyboard shortcuts (re-wire `useEditorKeyboard.ts` to V2 store): `Ctrl+C` copy, `Ctrl+X` cut, `Ctrl+V` paste, `Ctrl+Z` undo (zundo), `Ctrl+Y` redo, `Delete` delete (with confirm), `Ctrl+E` toggle enabled, `Ctrl+D` duplicate, `Ctrl+A` select all, arrows nudge selected nodes.
- Copy/paste: hand-rolled. Module-scoped clipboard ref. On copy, serialize selected nodes + edges-among-selected to JSON. On paste, regenerate UUIDs, offset positions by 40px, remap edges to new IDs.
- Undo/redo: zundo's `pause()`/`resume()` wrapped around drag (`onNodeDragStart` → `pause`, `onNodeDragStop` → `resume + commit`). Same for connect, paste, delete.
- Snap-to-grid: built-in `snapToGrid` + `snapGrid={[20, 20]}`. Wired to existing settings toggle.

**Deliverables**:

- Re-wired `useEditorKeyboardV2.ts`.
- Copy/paste utility.
- Undo/redo bindings.

**Definition of done**:

- Marquee selects multiple nodes. Shift-click adds to selection. Drag any selected node moves all of them.
- All keyboard shortcuts work as in V1.
- Copy a node + its incoming/outgoing edges (where both endpoints are selected) → paste creates new nodes with new IDs, offset.
- Undo a drag = one history entry, not many. 50-step limit honored.

**Engineer prompt**:

> Implement selection, keyboard, copy/paste, and undo/redo for V2. Prerequisite: Phase 4 merged.
>
> 1. On `<ReactFlow>` set: `selectionOnDrag={true}`, `panOnDrag={[1, 2]}`, `multiSelectionKeyCode="Shift"`, `deleteKeyCode={['Delete', 'Backspace']}`, `snapToGrid={snapToGridEnabled}`, `snapGrid={[20, 20]}`. Hook `snapToGridEnabled` to the existing settings toggle (whatever V1 reads — keep the same source).
> 2. Create `frontend/hooks/v2/useEditorKeyboardV2.ts`. Re-implement every shortcut from `frontend/hooks/useEditorKeyboard.ts`: `Ctrl+C` copy, `Ctrl+X` cut, `Ctrl+V` paste, `Ctrl+Z` undo, `Ctrl+Y` / `Ctrl+Shift+Z` redo, `Delete` delete (reuse existing confirm dialog), `Ctrl+E` toggle enabled on selected, `Ctrl+D` duplicate, `Ctrl+A` select all, arrow keys nudge selected by 1 grid cell. Read selected nodes via `useReactFlow().getNodes().filter(n => n.selected)`.
> 3. Implement copy/paste in `frontend/lib/canvas/v2/clipboard.ts`. Module-scoped `let clipboard: { nodes: Node[]; edges: Edge[] } | null = null`. `copy(selectedNodes, allEdges)` filters edges to those where both endpoints are in the selection, deep-clones, stores. `paste()` regenerates IDs via `crypto.randomUUID()`, offsets `position` by `{ x: 40, y: 40 }`, remaps edge `source`/`target` via the ID map, returns new nodes/edges. The store action `paste()` then appends and selects the pasted set.
> 4. Wire undo/redo via zundo. Bind `Ctrl+Z` to `useEditor.temporal.getState().undo()`, `Ctrl+Y`/`Ctrl+Shift+Z` to `redo()`. Wrap drag and connect operations with `pause()` / `resume()` so a drag becomes one history entry: `onNodeDragStart` → `temporal.getState().pause()`; `onNodeDragStop` → `temporal.getState().resume()`. Same pattern around `onConnect`, `paste`, batch-delete.
>
> Done when: marquee multi-select works, all shortcuts behave like V1, copy preserves edges within selection, paste-then-undo restores cleanly, dragging 200 frames is one undo entry.

---

### Phase 6 — Live execution & autosave (2 days)

**Goal**: socket.io node-status updates flow through to node + edge visuals; autosave parity.

**Scope**:

- New hook `useExecutionSocketV2.ts` — same socket connection, same event types (`node_status`, `execution_status`, `log`). Replaces V1 `useExecutionSocket`. On `node_status`, calls `updateNodeData(nodeId, { status })`. On a node's status change, updates `data.status` on outgoing edges from that node so the edge component can animate.
- Edge status propagation: when a node is RUNNING, its outgoing edges to RUNNING children become `running`. Computed in the same hook.
- Autosave: re-wire `useAutosave.ts` to subscribe to V2 store changes. Same dual-path: YAML PUT preferred, JSON PUT fallback. Same localStorage fallback (`operari-workflow-{id}`).
- Conflict detection: keep existing `GET /api/runbooks/:id/metadata` flow.

**Deliverables**:

- `useExecutionSocketV2.ts`.
- `useAutosaveV2.ts`.
- Edge status propagation logic.

**Definition of done**:

- Trigger a real run → nodes change state in V2 in real time, just like V1.
- Edges between running nodes animate (dash + orb).
- Autosave fires 1s after edits, hits the YAML endpoint first, falls back on error.
- Disconnect from network mid-edit → localStorage gets the snapshot; reconnect resumes save.

**Engineer prompt**:

> Implement live execution status and autosave for V2. Prerequisite: Phase 5 merged.
>
> 1. Create `frontend/hooks/v2/useExecutionSocketV2.ts`. Connect to the same socket.io endpoint as V1 (`frontend/hooks/useExecutionSocket.ts:43-155`). Subscribe to events `node_status`, `execution_status`, `log`. On `node_status({ nodeId, status })`:
>    - Call `useReactFlow().updateNodeData(nodeId, { status, lastEventAt: Date.now() })`.
>    - Update outgoing edges: for each edge where `source === nodeId`, set `data.status` based on the source node's status (RUNNING source + RUNNING target → edge is `running`; otherwise idle/done). Use `updateEdgeData(edgeId, { status })` (or `setEdges` if `updateEdgeData` is unavailable in v12; check the API).
> 2. Hard contract (do not break): the socket emits status values from the closed enum `RUNNING | SUCCESS | FAILED | PAUSED | SKIPPED | CANCELLED`. Map these to the edge component's `data.status` enum (`idle | running | success | failed | skipped`).
> 3. Create `frontend/hooks/v2/useAutosaveV2.ts`. Mirror the V1 dual-save behavior: try `PUT /api/runbooks/:id/yaml` first with the YAML output of `nodesToSpec(header, nodes, connections)`, fall back to `PUT /api/runbooks/:id` with the JSON shape from `getRunbookPayload()`. Debounce 1s. On both errors, write to localStorage `operari-workflow-{id}` (legacy key, do not change). Subscribe to V2 store via Zustand selector.
> 4. Conflict detection: before save, call `GET /api/runbooks/:id/metadata`, compare timestamps, surface the existing conflict UI if remote is newer.
>
> Done when: trigger a real run, V2 nodes/edges animate just like V1; edit a node, autosave fires and the YAML endpoint is hit; offline edit + reload from localStorage works.

---

### Phase 7 — UX polish (2 days)

**Goal**: minimap, controls, fit-view, theming, mobile/touch, accessibility.

**Scope**:

- `<MiniMap />`, `<Controls />`, `<Background variant="dots" gap={20} />` — all built-in.
- Fit-view button in toolbar → `useReactFlow().fitView({ padding: 0.2, duration: 400 })`.
- "Zoom to running step" → `fitView({ nodes: [{ id: runningNodeId }], duration: 400 })`.
- Theming: dark mode via `colorMode={theme}`. Override `--xy-edge-stroke-default` etc. to match Operari tokens.
- Touch: RF v12 has good defaults. Sanity-check pinch-zoom, two-finger pan on mobile.
- Accessibility: keyboard navigation between nodes (RF has built-in `tabIndex`), screen-reader labels on `<Handle>`s.

**Deliverables**:

- Minimap + controls + background.
- Theming overrides.
- Fit-view bindings.

**Definition of done**:

- Visual parity with V1 in light and dark modes.
- Pinch-zoom on a touch device works.
- Tab through nodes works.
- "Zoom to running step" jumps to the live step during a run.

**Engineer prompt**:

> Add UX polish to the V2 editor. Prerequisite: Phase 6 merged.
>
> 1. Add `<MiniMap />`, `<Controls />`, `<Background variant="dots" gap={20} size={1} />` inside `<ReactFlow>` in `CanvasV2.tsx`. Position the minimap bottom-right, controls bottom-left.
> 2. Wire toolbar Fit View button to `useReactFlow().fitView({ padding: 0.2, duration: 400 })`. Add a "Zoom to running step" toolbar action (visible only during a run) that fits view to the currently-running node: `fitView({ nodes: [{ id: runningNodeId }], duration: 400 })`.
> 3. Theming: pass `colorMode={resolvedTheme}` to `<ReactFlow>` (read from the existing theme context). In `globals.css`, override the v12 CSS variables (`--xy-edge-stroke-default`, `--xy-node-background-color-default`, `--xy-handle-background-color-default`, `--xy-controls-button-background-color`, `--xy-minimap-background-color`) so the editor matches Operari's existing palette in both light and dark.
> 4. Touch sanity: load on a phone or device emulation, confirm pinch-zoom, two-finger pan, and tap-to-select work without changes. Document any issues; do not paper over with custom touch handlers unless required.
> 5. Accessibility: confirm keyboard tab navigation moves focus between nodes (RF defaults). Add aria-labels to handles inside each custom node ("Input" / "Output: ok" / "Output: error").
>
> Done when: minimap + controls visible, fit-view works, theme switch is instant, mobile pinch-zoom works, screen reader announces node and handle roles.

---

### Phase 8 — Cutover & cleanup (1 day)

**Goal**: flip the flag default, delete the old code, retire the V2 suffix.

**Scope**:

- Internal QA pass on V2 with `OPERARI_EDITOR_V2=true` for one week.
- Flip flag default to `true`.
- Delete `frontend/components/Editor/EditorCanvas.tsx`, `useEditorCanvas.ts`, `useCanvasRenderer.ts`, `useEditorViewport.ts`, `useEditorSelection.ts`, `useEditorConnections.ts`, `useEditorNodes.ts`, `useEditorTools.ts`, `useEditorSnapToGrid.ts`, `useExecutionSocket.ts`, `useEditorKeyboard.ts`, `useAutosave.ts`, `frontend/utils/canvas/`, `frontend/utils/portAnchor.ts`, `frontend/utils/drawing.ts`.
- Rename V2 components to drop the suffix: `CanvasV2.tsx` → `Canvas.tsx`, `editorStoreV2` → `editorStore`, etc.
- Delete the feature flag plumbing.
- Update `CLAUDE.md` map if any top-level shape changed (it shouldn't).
- Update or write an ADR: `docs/adr/0007-react-flow-editor.md` documenting the decision and the architectural choices A1–A11.

**Deliverables**:

- One PR that deletes V1 code and renames V2 to canonical names.
- ADR.

**Definition of done**:

- `git grep -i "useEditorCanvas\|useCanvasRenderer\|EditorCanvasV2\|CanvasV2\|editorStoreV2"` returns nothing.
- Editor route works on `main` without any flag.
- All tests pass; bundle size delta documented in PR description.

**Engineer prompt**:

> Cut over from V1 to V2 editor. Prerequisite: Phase 7 merged and a one-week internal QA period with `OPERARI_EDITOR_V2=true` complete and bug-free.
>
> 1. Delete the V1 editor implementation: `frontend/components/Editor/EditorCanvas.tsx` (the old one), `frontend/hooks/useEditorCanvas.ts`, `useCanvasRenderer.ts`, `useEditorViewport.ts`, `useEditorSelection.ts`, `useEditorConnections.ts`, `useEditorNodes.ts`, `useEditorTools.ts`, `useEditorSnapToGrid.ts`, `useExecutionSocket.ts`, `useEditorKeyboard.ts`, `useAutosave.ts`, `frontend/utils/canvas/` (whole directory), `frontend/utils/portAnchor.ts`, `frontend/utils/drawing.ts`. Delete any tests that target deleted files.
> 2. Rename V2 modules to canonical names: `CanvasV2.tsx` → `Canvas.tsx`, `editorStoreV2.ts` → `editorStore.ts`, `useExecutionSocketV2` → `useExecutionSocket`, etc. Update all imports.
> 3. Delete the `OPERARI_EDITOR_V2` feature flag and its plumbing in `frontend/lib/featureFlags.ts` and `frontend/app/[lang]/editor/page.tsx`. The route now unconditionally renders the new editor.
> 4. Write `docs/adr/0007-react-flow-editor.md` documenting: why we rebuilt, the library choice (`@xyflow/react` v12), state-management choice (Zustand + zundo), edge-rendering choice (SVG via `getBezierPath` + `<animateMotion>`), frame-nesting via `parentId`/`extent: 'parent'`, live status via `updateNodeData`, cycle detection via `getOutgoers`, license note (MIT). Reference this plan as the implementation source.
> 5. Update `CLAUDE.md` only if the top-level shape changed (it should not — this is a same-shape replacement). Add to `docs/plans/editor-reactflow-rebuild.md` a "completed" header with the merge SHA.
> 6. Document bundle size delta in the PR description (`npm run build` before/after).
>
> Done when: `git grep -i "EditorCanvasV2\|CanvasV2\|editorStoreV2\|OPERARI_EDITOR_V2"` returns zero matches, the editor route works without a flag, ADR 0007 is committed, all tests pass.

---

## 6. Risks & mitigations

| Risk                                                                      | Likelihood | Impact | Mitigation                                                                                                                         |
| ------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `<animateMotion>` performance with 100+ running edges                     | Med        | Med    | Profile in Phase 3. Fallback: pause SMIL on edges out of viewport (`onlyRenderVisibleElements` covers this).                       |
| Frame nesting + `extent: 'parent'` jitters during drag of nested children | Med        | Low    | Test in Phase 4. If problematic, drop `extent: 'parent'` and rely on visual clamping only.                                         |
| React 19 ref warnings with `<Handle>` (forwardRef in RF internals)        | Low        | Low    | RF v12 has been confirmed React 19-compatible. If warnings appear, file upstream and pin to a compatible patch.                    |
| `updateNodeData` perf regressions vs current Canvas 2D rAF loop           | Low        | Med    | Phase 6 measures. If 100+ running nodes regress, batch updates with `flushSync` or move to a Canvas-overlay edge layer (deferred). |
| Cyclic edge detection runs on every change for large graphs               | Low        | Low    | Memoize on `edges` reference; the check is O(V+E).                                                                                 |
| YAML round-trip loses `_frame.parentId` on a future YAML schema rev       | Low        | Med    | Document the meta-key in the YAML serializer; add a round-trip test fixture in Phase 4.                                            |
| Bundle size jumps significantly                                           | Low        | Low    | RF v12 is ~80KB gzipped. Document delta in cutover PR.                                                                             |
| Pro-only examples (undo/redo, copy/paste) tempt us to take shortcuts      | Low        | Low    | A9 is explicit: hand-roll. Code review enforces.                                                                                   |

## 7. Cutover & rollback strategy

- **Cutover gate**: `OPERARI_EDITOR_V2=true` env var. Default false until Phase 7 is fully QA'd.
- **Rollback during QA**: flip env var to `false`. Old editor still in tree until Phase 8.
- **Rollback after Phase 8**: revert the cutover PR. Old code is gone, but the rebuild PRs (Phases 0-7) are still deployable. If a critical bug is found post-deletion, the rollback path is "fix forward."
- **Telemetry**: emit a single PostHog/analytics event `editor.canvas_loaded` with `{ version: 'v1' | 'v2' }` so we can see which version users are on during the rollout window.

## 8. Definition of "feature parity" (acceptance checklist for Phase 8)

Before cutover, verify each of these works in V2 the same as V1:

- [ ] Pan with middle/right drag and trackpad two-finger.
- [ ] Zoom with wheel, pinch, Ctrl+= / Ctrl+-.
- [ ] Single-click select; Shift-click multi-select; marquee multi-select.
- [ ] Drag single node; drag multi-selection together.
- [ ] Connect by dragging from output handle to input handle.
- [ ] Disconnect by selecting + Delete; reroute via right-click → Reroute.
- [ ] Self-loop blocked. Cycle blocked. Cyclic edge red.
- [ ] Right-click on node → context menu (duplicate, delete, toggle enable, detach, properties).
- [ ] Right-click on canvas → add node, paste, undo, redo.
- [ ] Right-click on edge → delete, change condition.
- [ ] All keyboard shortcuts: Ctrl+C/X/V/Z/Y/A/D/E, Delete, arrow nudge.
- [ ] Frame creation, drag-into-frame parents, drag-out un-parents, nested frames work, delete-frame deletes children.
- [ ] All 10 node types render with correct chrome and inputs/outputs.
- [ ] Inspector panel edits propagate; autosave fires.
- [ ] YAML export/import round-trips without data loss (including frame structure via `_frame` meta-key).
- [ ] Live run: node status badges update in real time; running edges animate dash + orb.
- [ ] Snap-to-grid toggle works.
- [ ] Settings → Appearance → line style toggle updates all edges live.
- [ ] Minimap, controls, fit-view, "zoom to running step" all work.
- [ ] HTTP tester → editor handoff via `operari:pendingHttpStep` works.
- [ ] Conflict detection on autosave still surfaces the existing UI.
- [ ] Mobile: pinch-zoom, two-finger pan, tap-select.
- [ ] Dark mode and light mode visually match V1.
- [ ] Bundle size delta documented; no runtime errors in console during a 5-minute exploratory session.

## 9. What to do if something is harder than estimated

- If Phase 3 (edges + animations) blows past 3 days: park the orb animation, ship marching dash only, and add the orb in a follow-up PR. Marching dash is the must-have; orb is delightful but not load-bearing.
- If Phase 4 (frame nesting) blows up: ship without `extent: 'parent'` clamping (visually frames still group children, but children can be dragged outside without the boundary clamping). Auto-parent on drag-stop is the must-have.
- If `<animateMotion>` perf is bad: switch to CSS-only animations (no orb), document, move on. Don't reintroduce a Canvas 2D overlay — it would re-create the maintenance burden we are leaving behind.

## 10. Out-of-scope but adjacent (do NOT do during this rebuild)

- Collaborative editing (Yjs / Liveblocks). Tempting given we're touching state; out of scope.
- AI-driven auto-layout. Out of scope.
- New node types. Out of scope.
- YAML schema changes. Out of scope.
- Backend changes of any kind. Out of scope.

If any of these come up during the rebuild, write them in `pendiente.md` and keep moving.

## 11. Research dump (sources)

The plan above is grounded in three research passes against the current repo and the React Flow docs. Summarized findings:

- **Current editor inventory** (V1 features to preserve): the editor is wrapped by EditorToolbar, EditorSidebar (responsive drawer), NodeConfigPanel inspector, NodePalette, plus floating overlays (CanvasRunStatus, OnboardingRunHint, FirstRunConfetti, PendingHttpStepBanner, CommandPalette, YamlViewModal, RunDialog, ScheduleDialog, SnapshotDialog, ExecutionEventLog, GitHubBranchPanel, RunbookAssistPanel). Canvas internals: viewport (wheel zoom, drag pan, fit-view, reset), selection (single, shift, marquee, Ctrl+A), node drag (single + multi + frame auto-parent), connection creation (port drag with hover-detect), edge interactions (click select, right-click delete/reroute), keyboard shortcuts (15+), undo/redo (50 steps via `useAdvancedUndoRedo`), copy/paste with re-id and offset, frame creation/auto-parent/un-parent/recursive descendants, snap-to-grid (20px). Visuals: smart bezier with port-direction-aware control points (`drawing.ts:31-145`), three line styles (bezier/step/straight), four flow styles (dashes/gradient/pulse/orb), animated marching dash + flow orb on RUNNING edges via shared rAF phase, condition badges on edges, cycle detection with red styling, grid background reactive to `<html data-bg-pattern>` + CSS vars. 10 node types after a 72→20 curation; only types with backend executors are shipped.

- **React Flow v12 capabilities**: confirmed compatible with React 19 + Next 15 App Router (with `'use client'` and `<ReactFlowProvider>`). Custom nodes via `<Handle>` + memoized components; custom edges via `getBezierPath` + `<BaseEdge>` + `<animateMotion>` for orbs. Sub-flows via `parentId` + `extent: 'parent'` (frames must precede children in array). Auto-parent on drag is not built-in but is a documented pattern using `getIntersectingNodes` in `onNodeDragStop`. Selection (`selectionOnDrag` + `panOnDrag={[1,2]}`), multi-select (`multiSelectionKeyCode`), and multi-drag are built in. Snap-to-grid built in. Undo/redo and copy/paste are not built in (Pro examples exist but are not required) — Zustand + zundo is the recommended pattern. Live status updates via `updateNodeData` re-render only the targeted node (critical for perf). Cycle detection via `getOutgoers` + DFS in `isValidConnection`. Auto-layout via dagre or elkjs (elkjs supports compound graphs — better fit for our frames). License: `@xyflow/react` is MIT.

- **Hard contracts to preserve** (from §3): YAML schema (`version=1`, `name`, `steps[]`, step `id/type/position`, `_retry`/`_runIf`/`_skipIf` meta-keys, `next` polymorphic shape, `fromPort`/`toPort` on connections). REST endpoints (`PUT /api/runbooks/:id` zod-validated, `PUT /api/runbooks/:id/yaml` raw text). Prisma `RunbookStep` and `RunbookConnection` shapes. Socket events: `node_status` with closed status enum, identification by `nodeId` only. Plugin SDK `defineStep` contract. Reserved type prefixes. localStorage handoffs. DOM/CSS-var reactivity contract.

End of plan.
