# ADR 0002 — Decomposing `node-executor.service.ts`

- **Status:** proposed
- **Date:** 2026-04-07
- **Related:** `IMPLEMENTACION_NANORUN.md` P0 #1

## Context

`backend/src/editor/node-executor.service.ts` is ~1020 LOC and houses:

- Sandbox initialization (`SecureSandbox`, `isolated-vm`)
- Email transport setup (`nodemailer`)
- Prisma + logger wiring
- Seven dedicated logic-node executors injected as fields
  (`DecisionNodeExecutor`, `SplitNodeExecutor`, `JoinNodeExecutor`,
  `RepeatNodeExecutor`, `MultiplexNodeExecutor`, `LimitNodeExecutor`,
  `ActionNodeExecutor`)
- The runbook executor registry (`createExecutorRegistry`)
- A 27-case `switch (node.type)` dispatching to private methods
- 18+ private methods, one per node type, each ~30-80 LOC:
  `executeTrigger`, `executeHttp`, `executeEmail`, `executeTransform`,
  `executeCondition`, `executeDatabase`, `executeDelay`, `executeLoop`,
  `executeShellCommand`, `executeStoreSet`, `executeStoreGet`,
  `executeSuspend`, `executeSetMetadata`, `executeCreateTicket`,
  `executeN8n`, …
- Template resolution helpers (`resolveTemplate`)
- Custom error mapping

It violates SRP, makes test isolation painful, and forces every node-type
change through a single 1KLOC file. The file already shows the *correct*
end-state: the seven logic nodes are **already** delegated to per-class
executors (`./logic/*-node.executor.ts`), and the runbook executors live
in `../runbook/executors/`. The legacy switch is the residue.

## Decision

Apply the same per-class executor pattern that `./logic/` and
`../runbook/executors/` already use, then make `NodeExecutor` a thin
dispatcher.

### Target structure

```
backend/src/editor/
├── nodes/
│   ├── trigger.executor.ts
│   ├── http.executor.ts            # also handles 'Api'
│   ├── email.executor.ts           # also handles 'custom.email'
│   ├── transform.executor.ts       # also handles 'Code'
│   ├── condition.executor.ts       # also handles 'If'
│   ├── database.executor.ts        # also handles 'SQL'
│   ├── delay.executor.ts           # also handles 'Wait'
│   ├── loop.executor.ts            # also handles 'Iterator'
│   ├── store-set.executor.ts
│   ├── store-get.executor.ts
│   ├── suspend.executor.ts
│   ├── set-metadata.executor.ts
│   ├── create-ticket.executor.ts
│   └── note.executor.ts            # passthrough
├── logic/                          # already exists, leave as-is
└── node-executor.service.ts        # ~150 LOC dispatcher
```

### Common interface

Reuse `StepExecutor<TConfig>` from `../runbook/types/executor.types`. Each
new file looks like:

```ts
export class HttpExecutor implements StepExecutor<HttpNodeConfig> {
  readonly type = 'HTTP';
  readonly aliases = ['Api'];
  constructor(private readonly deps: NodeExecutorDeps) {}
  async execute(config: HttpNodeConfig, ctx: ExecutorContext): Promise<ExecutorResult> { … }
}
```

`NodeExecutorDeps` carries shared collaborators (`PrismaClient`, `Logger`,
`SecureSandbox`, `nodemailer.Transporter | null`, retry helpers). It
replaces the constructor sprawl currently in `NodeExecutor`.

### Dispatcher

`NodeExecutor.execute()` collapses to:

```ts
async execute(node, input, tenantId, executionId) {
  // 1. Try the runbook registry (already in place)
  const runbookResult = await this.tryRunbookExecutor(node, input, tenantId, executionId);
  if (runbookResult !== null) return runbookResult;

  // 2. Look up the editor registry built from nodes/*
  const executor = this.editorRegistry.get(node.type);
  if (!executor) throw new NodeExecutionError({ … unknown node type … });

  // 3. Build context, delegate, map result.
  return executor.execute(node.config ?? {}, this.buildContext(node, input, tenantId, executionId));
}
```

The two registries can eventually merge once the editor types adopt the
runbook `ExecutorContext` shape end-to-end.

## Out of scope for this ADR

- Renaming node types in the database (`'HTTP'` → `'http'`, etc.) — that
  is a frontend + migration story.
- Removing the `NodeExecutionResult` superset type — preserving it keeps
  the diff small.
- Removing `executeN8n` — the underlying service was already deleted in
  the NanoRun pivot; the case branch is dead and can go in step 1.

## Consequences

**Positive**

- Each node type is reviewable in isolation (~30-80 LOC each).
- Tests target one file each instead of mocking the entire service.
- New node types stop touching the dispatcher.
- The remaining `node-executor.service.ts` becomes a small registry +
  context builder, ~150 LOC.
- The runbook and editor executors converge on one interface, paving the
  way to a single registry.

**Negative / risks**

- Touches a hot file used by the editor execution path. Must land behind
  the existing test suite (currently 8 tests in
  `__tests__/services/node-executor.service.test.ts`) plus added per-node
  tests.
- The `commonErrorContext` parameter and bespoke error mapping must be
  preserved exactly to keep the editor's error UX intact.

## Migration plan

Each step lands as its own PR, keeping CI green between steps.

1. **Cleanup pass** (no behavior change)
   - Delete `executeN8n` and the `'n8n'` case (n8n service is gone).
   - Delete unused imports (`N8nResult`, `N8nNodeConfig`).
   - Move `commonErrorContext` and `resolveTemplate` to a shared helper
     module under `editor/nodes/_shared.ts`.

2. **Extract pure-logic nodes first** (lowest risk)
   - `delay`, `transform`, `condition`, `note` — no DB, no IO beyond the
     sandbox. These are good first migrations and exercise the new
     interface.

3. **Extract IO nodes**
   - `http`, `email`, `database`, `create-ticket`. Each carries its own
     dependency (`axios`, `nodemailer`, prisma raw query, ticketing
     adapter).

4. **Extract state nodes**
   - `store-set`, `store-get`, `suspend`, `set-metadata`, `loop`,
     `trigger`. These need `tenantId` / `executionId` from context.

5. **Collapse the dispatcher**
   - Replace the switch with the registry lookup. Delete the now-empty
     private methods. Delete the per-node imports.

6. **Merge logic + runbook + editor registries**
   - Single `createNodeRegistry({ prisma, runner, sandbox })` returning
     `Map<string, StepExecutor>`. `tryRunbookExecutor` and
     `executeLegacy` collapse into one path.

Each step ships with at least one new test under
`__tests__/editor/nodes/<name>.executor.test.ts` and keeps the existing
`node-executor.service.test.ts` green.

## Verification

- `npm test -w backend` stays green after every step.
- `wc -l backend/src/editor/node-executor.service.ts` drops from ~1020 to
  ~150 by step 5.
- No file under `backend/src/editor/nodes/` exceeds 200 LOC.

## Not doing now

The actual refactor. This ADR exists so the next person (or the next
session) can pick it up step by step instead of attempting a 1020-LOC
rewrite in one shot. The P0 RCE concern that originally motivated the
"refactor `node-executor.service.ts`" line item is **already resolved**:
`executeShellCommand` now delegates to the runner-backed `ShellExecutor`,
so `NANORUN_RUNNER=docker|fly` is honored on the editor path too.
