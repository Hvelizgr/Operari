# ADR 0006 — Plugin runtime tenant isolation: in-process filter, with worker pool as opt-in for cloud beta

- **Status:** accepted
- **Date:** 2026-04-30
- **Context links:** commit `f33efd4` (NodeType composite unique on `(type, tenantId)`), commit `cb07e2d` (Python SDK), commit `448eafc` (Python plugin loader bridge), `pendiente.md`

## Context

Commit `f33efd4` made `NodeType` tenant-aware at the schema level: two
tenants can independently install a plugin that claims the same step type
(e.g. `acme.slack-notify`) without colliding. The runtime never caught up.
Today every plugin loaded from `OPERARI_PLUGINS_DIR` registers globally;
a hypothetical tenant-scoped install path would write the catalog row but
the executor registry would reject it as a duplicate or — worse — silently
serve the wrong tenant's implementation.

Three runtime isolation options were on the table:

| Option                         | Aislamiento                                         | Costo extra por tenant                          | Trabaja con plugins Python           | Complejidad                           |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------- |
| **A — Worker pool per tenant** | Real (proceso, memoria, fd)                         | ~50–100 MB RAM ocioso, supervisor + IPC framing | Sí (Python ya corre como subprocess) | Alta                                  |
| **B — In-process filter**      | Lógico (registry + dispatcher rechaza cross-tenant) | 0                                               | Sí                                   | Baja (~50 LOC)                        |
| **C — V8 isolated-vm**         | Memoria del JS isolate                              | ~10 MB + ~100 ms cold start                     | **No** — Python no cabe              | Alta (serializar contexto, polyfills) |

## Decision

**Adopt option B as default; document option A as opt-in for cloud beta.**

The plugin runtime registry gains tenant awareness via three minimal changes:

1. `StepExecutor` interface gains an optional `readonly tenantId?: string`.
2. The loader scans `OPERARI_PLUGINS_DIR/tenants/<tenant-id>/<plugin>/` for
   tenant-scoped plugins in addition to the existing top-level scan for
   globals. Each loaded executor carries its `tenantId` (or undefined for
   globals).
3. The dispatcher's single resolution point (`node-executor.service.ts:235`)
   rejects a run with `tenantId !== executor.tenantId` for tenant-scoped
   executors.

`createExecutorRegistry` returns a flat `Map<string, StepExecutor>` keyed by
type + tenant: `${tenantId ?? 'global'}::${type}`. The dispatcher resolves
the tenant key first, falling back to `'global'::<type>` for shared plugins
and built-ins.

### Why B and not A

- **Self-host is the primary deploy target.** Self-host is single-tenant
  by definition. A worker pool per tenant pays full RAM cost for zero
  benefit when there is exactly one tenant.
- **Cloud beta isolation comes from runs, not plugins.** When cloud
  multi-tenancy goes live, the threat model shifts to untrusted tenants.
  The defense at that layer is **runner isolation** (Fly Machines /
  Firecracker per run, the path tracked separately in `pendiente.md` —
  Fly stdout/stderr sidecar etc.) The whole step — plugin code plus its
  stdin / stdout / fd handles — runs inside an ephemeral container.
  Plugins in a shared backend process are fine when **runs themselves**
  are sandboxed.
- **Worker pool adds operational surface.** A supervisor process per
  tenant means restart semantics, health checks, IPC framing, lifecycle
  on tenant create/delete — every one a place where an outage hides.
  None of that earns its keep before cloud-beta.

### Why B and not C

- **C (V8 isolated-vm) is a dead-end given Python plugins.** Commit
  `cb07e2d` shipped a Python SDK; commit `448eafc` shipped the
  Node-side bridge that spawns Python plugins as subprocesses. C only
  isolates JavaScript modules; Python plugins would have to use a
  different path anyway. Building two isolation systems is worse than
  building one and accepting its threat model.

### Honest threat model under B

What B prevents:

- A misconfigured tenant accidentally invoking a plugin installed only
  for another tenant — the dispatcher returns "type not registered" the
  same way it does for an unknown global type.
- Catalog/runtime divergence — tenant-scoped NodeType rows already exist
  (commit `f33efd4`); without runtime tenant filtering the editor would
  show a step in the palette and the runtime would refuse to execute it.

What B **does not** prevent:

- A malicious plugin reading another tenant's secrets from process
  memory. That requires real process isolation. The runner isolation
  story handles it; option B is explicit about not solving it.

This matches the existing trust model — globally-installed plugins today
already share process memory with secrets and have always done so. The
honest position is "trust your plugin authors until cloud-beta lands the
runner isolation".

### Escape hatch for cloud beta

When cloud-beta deployment lands and the threat model demands real
process isolation, option A is opt-in via:

```env
OPERARI_PLUGIN_ISOLATION=worker
```

The flag triggers a worker-pool dispatcher that lives behind the same
`StepExecutor` interface. Plugins in worker mode get the same `tenantId`
field they have under option B; the difference is only the mechanism of
isolation (process vs in-memory check). No call site outside the
dispatcher changes between A and B.

This commit lands B. A is documented but not implemented — the worker
pool's correct behavior is "what runner isolation already does for the
whole step". When that path matures (Fly Machines stdout/stderr sidecar

- secret injection per run), A becomes a question of "do we still
  need plugin-level isolation on top of run-level isolation?" That's a
  re-decision, not a commitment.

## Consequences

**Positive:**

- Tenant-scoped NodeType rows from commit `f33efd4` finally have a
  runtime that respects them. Plugin install paths (current `OPERARI_PLUGINS_DIR/tenants/<id>/`,
  future `POST /api/tenants/plugins/install`) can register tenant-scoped
  executors safely.
- Zero regression on the self-host single-tenant path: globals
  continue to load without a tenantId, the dispatcher's fallback path
  finds them, behavior is identical.
- The chokepoint (`node-executor.service.ts:235`) becomes the canonical
  enforcement point. One place to read, one place to test.

**Negative:**

- The dispatcher gains a per-step lookup with a fallback. ~5 ns extra
  on the hot path; not measurable.
- Plugin authors who want to ship to multiple tenants must either
  install per-tenant or install globally. There is no "global plugin
  with a per-tenant config override" story today — that's a future
  feature, not regression.

**Untouched:**

- Global plugins from `OPERARI_PLUGINS_DIR/<plugin>/` (no `tenants/`
  prefix) still load with `tenantId === undefined`.
- Built-in step types (`shell`, `operari.httpRequest`, etc.) have no
  `tenantId` and the fallback resolution path serves them unchanged.

## Alternatives considered

- **C (V8 isolated-vm):** rejected because Python plugins (`cb07e2d`)
  cannot run inside a JavaScript isolate. A two-system isolation story
  is worse than a one-system one with documented limitations.
- **A (worker pool now):** rejected because the operational cost lands
  before the threat model that justifies it. Defer until cloud-beta.
- **No isolation at all (do nothing):** rejected because the schema is
  already tenant-aware (`f33efd4`) and the editor's catalog filters
  per-tenant — runtime divergence would surface as confusing "type not
  registered" errors when a tenant tries to run a step the editor
  showed them.
