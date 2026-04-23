import { Prisma, PrismaClient, Runbook, RunbookVersion } from '@prisma/client';

/**
 * RunbookVersionService — freezes a snapshot of a Runbook every time
 * the definition is saved.
 *
 * Why this exists: Runbook.nodes / .connections are mutable columns.
 * Every save used to overwrite them in place, which meant a running
 * Execution read a moving target — if the user edited the DAG while
 * a child runbook was mid-flight, the child walked the new definition.
 * Audit could not reconstruct "what version was the runbook at T?".
 *
 * Contract: exactly one row per `(runbookId, version)` pair. Version
 * numbers are monotonic per runbook — v1 on first save, +1 on every
 * subsequent save. The `snapshot` JSON holds everything the engine
 * needs (nodes, connections, inputs, name, onErrorRunbookId) so it
 * can execute this version without consulting the mutable Runbook
 * row at all.
 *
 * Concurrency: two concurrent saves to the same runbook would race
 * on `max(version)+1`. We wrap the write in a transaction with
 * SERIALIZABLE isolation so the unique index does the tie-breaking —
 * one writer wins, the other retries.
 */

export interface RunbookVersionSnapshot {
  name: string;
  description: string | null;
  category: string | null;
  nodes: unknown;
  connections: unknown;
  inputs: unknown;
  onErrorRunbookId: string | null;
}

export interface CreateVersionInput {
  runbookId: string;
  /** User who produced the save. Null for system-initiated versions
   *  (e.g. the backfill migration, future admin tools). */
  actorId?: string | null;
}

export class RunbookVersionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Build the snapshot payload from a Runbook row. Pure function —
   * exposed so callers that already loaded the Runbook don't pay a
   * second round-trip.
   */
  static buildSnapshot(runbook: Runbook): RunbookVersionSnapshot {
    return {
      name: runbook.name,
      description: runbook.description,
      category: runbook.category,
      nodes: runbook.nodes ?? [],
      connections: runbook.connections ?? [],
      inputs: runbook.inputs ?? [],
      onErrorRunbookId: runbook.onErrorRunbookId,
    };
  }

  /**
   * Append a new version by reading the current Runbook row and
   * freezing its definition. Resolves to the inserted RunbookVersion.
   *
   * Callers should invoke this at the end of every runbook upsert
   * before responding to the save API — clients can then reference
   * the new version in the response payload if they want to show
   * "saved as v7" affordances.
   */
  async createVersion(input: CreateVersionInput): Promise<RunbookVersion> {
    return this.prisma.$transaction(
      async tx => {
        const runbook = await tx.runbook.findUnique({ where: { id: input.runbookId } });
        if (!runbook) {
          throw new RunbookVersionError(
            `Runbook not found: ${input.runbookId}`,
            'RUNBOOK_NOT_FOUND'
          );
        }

        // Next version = MAX(version) + 1 scoped to this runbook.
        // The unique index on (runbookId, version) is the real
        // tie-breaker if two callers race; SERIALIZABLE makes the
        // read-then-write atomic for well-behaved drivers, but we
        // still rely on the constraint as a correctness backstop.
        const latest = await tx.runbookVersion.findFirst({
          where: { runbookId: input.runbookId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const nextVersion = (latest?.version ?? 0) + 1;

        const snapshot = RunbookVersionService.buildSnapshot(runbook);

        return tx.runbookVersion.create({
          data: {
            runbookId: input.runbookId,
            tenantId: runbook.tenantId,
            version: nextVersion,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            createdByUserId: input.actorId ?? null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /**
   * Fetch the latest version of a runbook. Used by ExecutionService
   * when dispatching a run — new Executions always pin themselves to
   * the version they saw at start time.
   */
  async getLatest(runbookId: string): Promise<RunbookVersion | null> {
    return this.prisma.runbookVersion.findFirst({
      where: { runbookId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Fetch a specific version by id — used by the engine when an
   * Execution carries runbookVersionId and replay must read exactly
   * those bytes.
   */
  async getById(versionId: string): Promise<RunbookVersion | null> {
    return this.prisma.runbookVersion.findUnique({ where: { id: versionId } });
  }
}

export class RunbookVersionError extends Error {
  constructor(
    message: string,
    public readonly code: 'RUNBOOK_NOT_FOUND'
  ) {
    super(message);
    this.name = 'RunbookVersionError';
  }
}

/**
 * Overlay a RunbookVersion.snapshot onto a Runbook row so downstream
 * engine code keeps its existing Runbook-shaped input. Returns a new
 * object — the argument Runbook is not mutated.
 *
 * Only the definition-shaped fields are overridden (name, description,
 * category, nodes, connections, inputs, onErrorRunbookId). Everything
 * else (id, tenantId, userId, timestamps) stays read-through from the
 * current row, because those are identity-shaped and do not change
 * between versions.
 */
export function applyRunbookVersionSnapshot<T extends Runbook>(
  runbook: T,
  rawSnapshot: unknown
): T {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') return runbook;
  const snap = rawSnapshot as Partial<RunbookVersionSnapshot>;
  return {
    ...runbook,
    name: typeof snap.name === 'string' ? snap.name : runbook.name,
    description: snap.description === undefined ? runbook.description : (snap.description ?? null),
    category: snap.category === undefined ? runbook.category : (snap.category ?? null),
    nodes: snap.nodes === undefined ? runbook.nodes : (snap.nodes as Runbook['nodes']),
    connections:
      snap.connections === undefined
        ? runbook.connections
        : (snap.connections as Runbook['connections']),
    inputs: snap.inputs === undefined ? runbook.inputs : (snap.inputs as Runbook['inputs']),
    onErrorRunbookId:
      snap.onErrorRunbookId === undefined
        ? runbook.onErrorRunbookId
        : (snap.onErrorRunbookId ?? null),
  };
}
