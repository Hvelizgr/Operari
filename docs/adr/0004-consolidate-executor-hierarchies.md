# ADR 0004 — Consolidate `editor/nodes/` and `runbook/executors/`

- **Status:** proposed (defer until P1 #7 phase 4 lands)
- **Date:** 2026-04-07
- **Related:** ADR 0001, ADR 0002, ADR 0003, `docs/post-pivot-cleanup-audit.md`

## Context

NanoRun currently runs steps through **two parallel executor
hierarchies** that exist for historical reasons:

```
backend/src/editor/nodes/        ← legacy NanoFlow editor executors
backend/src/runbook/executors/   ← post-pivot runbook executors (P0 #1)
```

`editor/nodes/*.executor.ts` implements the **`EditorNodeExecutor`**
interface defined in `editor/nodes/_shared.ts`:

```ts
interface EditorNodeExecutor<TConfig, TResult extends NodeExecutionResult> {
  readonly type: string;
  readonly aliases?: readonly string[];
  execute(
    config: TConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext,
    tenantId?: string,
    executionId?: string
  ): Promise<TResult>;
}
```

`runbook/executors/*.ts` implements the **`StepExecutor`** interface
defined in `runbook/types/executor.types.ts`:

```ts
interface StepExecutor<TConfig = unknown> {
  readonly type: string;
  execute(config: TConfig, context: ExecutorContext): Promise<ExecutorResult>;
}

interface ExecutorContext {
  runId: string;
  stepId: string;
  variables: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  tenantId: string;
  emit?: (event: ExecutorEvent) => void;
}
```

The two interfaces differ in three meaningful ways:

|              | EditorNodeExecutor                                      | StepExecutor                                                                                      |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Input shape  | flat `ExecutionInput` (just the previous step's output) | structured `ExecutorContext` (runId, stepId, variables, previousOutputs, tenantId, emit callback) |
| Result shape | typed per-node `NodeExecutionResult` subtype            | uniform `ExecutorResult` (`{ success, output?, error?, duration?, paused? }`)                     |
| Error model  | throws `NodeExecutionError`                             | returns `{ success: false, error }`                                                               |

The dispatcher in `editor/node-executor.service.ts` already bridges
the two: `tryRunbookExecutor()` is called first, falls through to the
editor registry on miss. ADR 0002 step 6 was supposed to merge them;
that step never landed, and after the post-pivot cleanup the editor
side has shrunk enough that the consolidation is finally cheap.

## Why this matters

1. **One mental model.** Today, adding a new step type means deciding
   _which_ hierarchy it lives in, then writing the right interface.
   That's a coin flip with no documented criteria.
2. **The runbook engine ignores half the executors.** ADR 0003's
   durable engine talks `ExecutorContext`, so it can drive only the
   `runbook/executors/` half. Anything in `editor/nodes/` runs through
   the legacy `ExecutionService` path. Two execution code paths is two
   places to forget to wire OTel, audit events, retries, and cancel
   propagation.
3. **Test boilerplate doubles.** Each hierarchy has its own mock
   shapes (`buildDeps`, `errCtx` vs `buildContext`), and the audit
   chain is wired only on one side.
4. **Cancel + log streaming work only on the runbook side.** P0 #1
   wired `Runner.cancel(runId)` and Redis-stream log shipping into
   `runbook/runners/`, but the editor executors call shell directly
   when not adapted via `ShellCommandNodeExecutor`. The patchwork is
   correct today, brittle tomorrow.

## Why this is deferred (and not this PR)

The cleanup in `docs/post-pivot-cleanup-audit.md` Day 1 + Day 2 made
the surface small enough to consolidate, but the migration is **still
multi-day work** because:

- Every editor executor needs an `ExecutorContext` adapter or a
  rewrite. Some (transform, condition, store-get/set) read structured
  input that doesn't map 1:1 to `previousOutputs`.
- The `tryRunbookExecutor()` fall-through has to be inverted: the
  runbook registry becomes the only registry, and the dispatcher
  becomes a thin wrapper around `Map<string, StepExecutor>.get()`.
- ExecutionService has two code paths (one per hierarchy) and the
  post-consolidation version has to keep `replayExecution`,
  `cancelExecution`, and the socket emit working without regression.
- ADR 0003 phase 4 (event-sourced replay) assumes the unified
  executor shape — locking the executor merge before phase 4 is the
  right sequencing.

Doing it before P1 #7 phase 4 ships means refactoring twice. The
post-pivot audit explicitly recommends deferring it.

## Decision

**Do NOT consolidate in the current cleanup pass.** Park the work
under a tracked task with an explicit precondition: _"unblocked once
ADR 0003 phase 4 lands"_. When the time comes:

1. Pick `StepExecutor` + `ExecutorContext` as the survivor — it's the
   shape ADR 0003 already targets and the one runners know how to
   call.
2. For each executor in `editor/nodes/`, write an adapter that
   constructs `ExecutorContext` from `(input, tenantId, executionId)`
   and translates the result. Three executors need real rewrites
   because their inputs don't map cleanly: `transform`, `condition`,
   `storeGet`/`storeSet`. The rest are mechanical.
3. Move every adapted file from `editor/nodes/` to
   `runbook/executors/`, drop the `EditorNodeExecutor` interface and
   `_shared.ts`, and delete the dispatcher's `editorRegistry`.
4. ExecutionService becomes the single caller — `tryRunbookExecutor`
   is no longer "try the runbook side first", it's the only path.
5. Update `seed-nodes.ts` and `NodePalette.tsx` if any type strings
   change shape (they shouldn't — the rename to `nanorun.*` already
   landed in commit `<rename>`).
6. Drop the `editor/` folder entirely — it stops existing as a
   meaningful boundary once the executors live elsewhere. The
   `editor/execution/` socket service moves to `runbook/realtime/`.

## Consequences

**Positive**

- One executor interface, one dispatcher, one place to wire OTel +
  audit + cancel.
- ExecutionService loses ~300 LOC of branching.
- ADR 0003 phase 4 (event-sourced replay) becomes implementable
  without a special case for editor executors.
- Test infrastructure halves.

**Negative**

- The migration touches every executor file (~16 files).
- Three executors (`transform`, `condition`, `storeGet/Set`) need
  real rewrites, not just adapters.
- Risk of regression in the editor's interactive run flow if the
  socket emit is wired wrong post-merge.

**Out of scope for this ADR**

- Whether the engine should run executors in-process or out-of-process
  (covered by P0 #1 + ADR 0001).
- Whether the dispatcher should be data-driven via the `NodeType`
  table at runtime instead of code-driven (interesting but separate).

## Status

Proposed. Tracked as backlog item, blocked on **ADR 0003 phase 4**.
