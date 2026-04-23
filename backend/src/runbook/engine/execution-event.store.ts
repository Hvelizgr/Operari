import type { PrismaClient, Prisma, ExecutionEvent } from '@prisma/client';
import type { ExecutionEventPayload, RunState } from './execution-event.types';
import { reduceRunState, type ReplayableEvent } from './run-state.reducer';

/**
 * ExecutionEventStore — append-only writes + reducer-based reads for
 * the durable execution event log (ADR P1 #7).
 *
 * Append shape uses the discriminated `ExecutionEventPayload` union
 * so the compiler refuses a `step.completed` payload under `run.failed`
 * etc. The DB stores `payload` as JSON and `type` as text for forward
 * compatibility (a future variant doesn't need a migration), but the
 * service boundary is strongly typed.
 *
 * Surface:
 *   - append(executionId, tenantId, event)
 *   - listEvents(executionId)
 *   - reduceState(executionId)  → RunState
 *   - listInFlightExecutions(tenantId)  → worker startup
 *   - listTenantsWithEvents()  → worker startup tenant enumeration
 *
 * What this DOES NOT cover (intentional / phase 4):
 *   - Hash chaining or tamper detection. AuditEvent covers tamper at
 *     the tenant level; this table is for liveness, not forensics.
 *   - Step replay execution. The worker (resume-worker.ts) currently
 *     ABANDONS interrupted runs by appending run.failed. Phase 4 will
 *     replace ABANDON with RESUME by re-feeding step.completed
 *     outputs to the runtime — see ADR 0003 phase 4.
 *
 * Wiring status (closes the circle):
 *   - ExecutionService dual-writes to this store + audit chain via
 *     `safeAppendEvent`, gated on NANORUN_DURABLE_ENGINE
 *   - The cancel route appends run.cancelled directly
 *   - The resume worker reads via listInFlightExecutions + reduceState
 *     at server startup
 */
export class ExecutionEventStore {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Append an event to the log. Returns the persisted row so the
   * caller can read back the assigned `seq` for ordering / dedup.
   *
   * The discriminated union enforces that `nodeId` is required for
   * `step.*` variants and absent for `run.*` variants — the compiler
   * refuses mismatches at the call site.
   */
  async append(
    executionId: string,
    tenantId: string,
    event: ExecutionEventPayload
  ): Promise<ExecutionEvent> {
    return this.prisma.executionEvent.create({
      data: {
        executionId,
        tenantId,
        type: event.type,
        nodeId: event.nodeId ?? null,
        payload: (event.payload ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Read every event for a given execution in seq order. Used by
   * the reducer; exposed separately so dashboards can replay a run
   * step-by-step for debugging.
   */
  async listEvents(executionId: string): Promise<ExecutionEvent[]> {
    return this.prisma.executionEvent.findMany({
      where: { executionId },
      orderBy: { seq: 'asc' },
    });
  }

  /**
   * Walk the events for an execution and produce its current state.
   * Returns null if the execution has no events at all (the store
   * has not seen this run — caller should fall back to the legacy
   * `Execution` table during the migration window).
   */
  async reduceState(executionId: string): Promise<RunState | null> {
    const rows = await this.listEvents(executionId);
    if (rows.length === 0) return null;
    const events: ReplayableEvent[] = rows.map(ExecutionEventStore.toReplayable);
    return reduceRunState(executionId, events);
  }

  /**
   * Distinct list of tenants that have at least one execution event.
   * Used by the resume worker to enumerate every tenant that may
   * have in-flight runs to scan. Returns the empty array on a fresh
   * database.
   */
  async listTenantsWithEvents(): Promise<string[]> {
    const rows = await this.prisma.executionEvent.findMany({
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    return rows.map(r => r.tenantId);
  }

  /**
   * Find every execution in this tenant that has at least one event
   * but no terminal event yet. The worker calls this at startup to
   * decide which runs to resume.
   *
   * Implementation note: we do this in two queries because the
   * "no terminal event" check is awkward to express as a single
   * Prisma where clause without a raw subquery. Acceptable for
   * startup; the path is not in the request hot loop.
   */
  async listInFlightExecutions(tenantId: string): Promise<string[]> {
    const candidateRows = await this.prisma.executionEvent.findMany({
      where: { tenantId },
      select: { executionId: true },
      distinct: ['executionId'],
    });
    const candidateIds = candidateRows.map(r => r.executionId);
    if (candidateIds.length === 0) return [];

    const TERMINAL_TYPES = ['run.completed', 'run.failed', 'run.cancelled'];
    const terminated = await this.prisma.executionEvent.findMany({
      where: {
        tenantId,
        executionId: { in: candidateIds },
        type: { in: TERMINAL_TYPES },
      },
      select: { executionId: true },
    });
    const terminatedSet = new Set(terminated.map(r => r.executionId));
    return candidateIds.filter(id => !terminatedSet.has(id));
  }

  /**
   * Convert a Prisma row to the reducer-friendly shape. Centralized
   * so the JSON-to-object cast lives in one place.
   */
  static toReplayable(row: ExecutionEvent): ReplayableEvent {
    return {
      seq: row.seq,
      type: row.type,
      nodeId: row.nodeId,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
    };
  }
}
