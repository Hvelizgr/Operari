# ADR 0003 — Durable execution engine on Postgres

- **Status:** accepted (foundation), in progress (full integration)
- **Date:** 2026-04-07
- **Related:** `IMPLEMENTACION_NANORUN.md` P1 #7

## Context

Today `ExecutionService.runWorkflow` mutates state directly in memory:
the queue of nodes to execute, the set of nodes already executed, the
outputs of each node, the pause/resume flag. None of this is persisted.
The consequences:

- A backend restart kills every in-flight runbook. There is no way to
  resume; the only option is to create a new run from the start.
- Long-running runbooks (deploys, migrations, incident response) are
  the entire reason NanoRun exists, but they are exactly the runs most
  exposed to a restart.
- The `Execution` table holds the final status (RUNNING / SUCCESS /
  FAILED / PAUSED / CANCELLED) but not the granular state needed to
  resume. The audit chain (`AuditEvent`) records the lifecycle for
  compliance, but it is per-tenant and tamper-evident, not per-run and
  fast to query.

The roadmap (P1 #7) calls for an event-sourced engine on Postgres,
following the DBOS / Hatchet pattern: every state transition is
appended to an event log, and a worker reduces the events to compute
the current state. On restart the worker reads the latest events for
each in-flight run and resumes from there.

The doc is also explicit about what NOT to use:

- **Not Temporal** — kills `docker compose up` for self-host users
- **Not BullMQ** — it's a queue, not durable execution

## Decision

Build the engine in two phases.

### Phase 1 (this commit) — foundation

Ship the durable layer without integrating it into ExecutionService.
The integration is the risky part; the storage shape and the reducer
are the load-bearing decisions and they need to land first so we can
test and iterate without touching the request path.

Components:

- **`ExecutionEvent` Prisma model** — append-only table keyed on
  `executionId`. Indexed for the read pattern "give me every event for
  this execution in seq order". Stores `type` as text and `payload`
  as JSONB so a new variant does not need a migration.
- **`ExecutionEventType` discriminated union** in
  `backend/src/runbook/engine/execution-event.types.ts`. Closed over
  the 12 variants we need today (run.created, run.started,
  run.completed, run.failed, run.paused, run.resumed, run.cancelled,
  step.queued, step.started, step.completed, step.failed,
  step.skipped). Each variant has a typed payload; the
  `ExecutionEventPayload` union enforces correct payload-to-type
  mapping at the call site so a `step.completed` payload cannot be
  appended under `run.failed`.
- **`reduceRunState` pure function** in `run-state.reducer.ts`. Walks
  events in seq order and produces a `RunState` (status, workflow id,
  step counts, paused-at node, error message, last seq seen). Pure
  → trivially testable, no Prisma, no clock, no I/O. Status precedence
  rule: once a terminal state (COMPLETED / FAILED / CANCELLED) is
  reached, later events are ignored — defends against out-of-order
  writes.
- **`ExecutionEventStore` service** wraps the Prisma model with
  `append`, `listEvents`, `reduceState`, and `listInFlightExecutions`.
  The last is what the worker calls at startup to find runs that need
  resuming.

### Phase 2 (follow-up commits) — integration

- Wire `ExecutionEventStore.append` into `ExecutionService` next to
  the existing `safeAudit` calls. Every state transition emits to
  BOTH the audit chain (compliance) AND the event store (durability).
  No code path is allowed to emit to one but not the other.
- Build the worker startup loop: on backend boot, call
  `listInFlightExecutions(tenantId)` for every tenant, reduce each
  run, and resume execution from `state.lastSeq + 1`.
- Decide the resume semantics for each step state:
  - `step.queued` → re-execute the step from scratch
  - `step.started` without `step.completed` → re-execute (idempotent
    steps must be safe; non-idempotent steps must use a step nonce)
  - `step.completed` → skip, use the recorded output
- Migrate ExecutionService.runWorkflow to read its node queue from
  the event store rather than maintaining it in memory. The `Set` of
  executed nodes becomes a derived view of the events.

### What this is NOT

- **Not hash-chained.** The event store is for liveness, not tamper
  evidence. AuditEvent already covers tamper detection per tenant.
  Adding a hash chain to ExecutionEvent would double the write cost
  for runs that are already mostly emit-heavy.
- **Not transactional with the runtime.** A step that succeeds in the
  runtime but fails to append the corresponding event will be replayed
  on restart. Step executors must be idempotent or use a nonce. This
  is the same constraint Temporal / DBOS / Hatchet impose; documenting
  it loud is part of the design.
- **Not a queue.** Pulling work from the event store on restart is a
  one-shot operation. Steady-state scheduling still happens via the
  in-memory loop in ExecutionService until phase 2 lands.

## Consequences

**Positive**

- A backend crash mid-runbook becomes recoverable, which is the
  reason the project exists.
- The reducer is a pure function, so debugging a stuck run becomes
  "give me the events, walk them mentally" — no production access
  needed for triage.
- The event store is independent of the runtime, so a future replay
  tool / time-travel debugger can be built without touching the
  ExecutionService.
- Forward-compatible storage: a new event variant in the union does
  not need a migration; old code that does not know the variant
  ignores it (the reducer's default case is intentional).

**Negative / risks**

- The integration step is the dangerous one. Phase 2 must land
  behind a feature flag (e.g. `NANORUN_DURABLE_ENGINE`) so we can
  toggle it off if a regression hits production.
- Step idempotency becomes a hard contract. Today some legacy node
  executors may have side effects on every call (e.g. SetMetadata
  reads then writes Execution.metadata, which is not idempotent
  under concurrent retries). Phase 2 must audit each executor.
- Storage growth: every run emits ~2 + 2*nodeCount events. For a
  100-step run, that's ~202 rows. At 1 million runs/month with the
  same shape, ~200M rows/month. Mitigated by partitioning
  ExecutionEvent on `createdAt` and TTL'ing partitions older than
  90 days. Out of scope for phase 1.

## Alternatives considered

1. **Temporal** — explicitly rejected by the roadmap. It works, but
   it adds a Java-based service to the self-host stack and breaks
   `docker compose up`.
2. **DBOS** — the closest fit conceptually. Rejected because it's
   research-stage TypeScript-on-Postgres with a custom decorator
   syntax that we'd have to embed across every step executor.
3. **BullMQ + Redis** — not durable execution. A queue is for
   producer/consumer fan-out; we need a per-run state machine that
   can be reconstructed from history.
4. **Hand-rolled state column on Execution** — what we have today
   (`status`, `metadata`). It cannot represent the granular per-step
   progress needed to resume mid-runbook.
5. **Event store + Kafka** — Kafka adds the same operational tax as
   Temporal for self-host. Postgres is the one dependency every
   NanoRun deployment already has.

## Verification

- `npm test -w backend` covers the reducer (10 tests) and the store
  (8 tests) at this commit. Phase 2 will add integration tests at
  the ExecutionService boundary.
- The reducer is pure → trivially fuzzable in a future commit if
  needed.
- The schema migration (`20260407150000_add_execution_event`) is
  additive: a new table, no changes to existing rows, safe to apply
  to a populated database.

## Revisit when

- Phase 2 ships and we have data on the read latency of
  `listInFlightExecutions` at scale.
- A second consumer of the event log shows up (replay tool, time
  travel debugger, audit-style export). At that point the API
  surface may want a richer query DSL than `listEvents` exposes.
- We need cross-region durability (multi-Postgres replication, or
  a move to a distributed log like Aurora). Out of scope until cloud
  beta.
