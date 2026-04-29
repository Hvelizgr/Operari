import type { PrismaClient } from '@prisma/client';

import { ExecutionService } from '../../editor/execution/execution.service';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

/**
 * `runbook` step executor — invokes another runbook as a sub-run.
 *
 * The single concrete primitive we were missing for runbook composition:
 * a step that says "stop what you're doing, go run `restart-pod.yaml`
 * with these inputs, then come back with its outputs as if it were
 * a regular step". Without this every shared procedure (pre-deploy
 * checks, rollback, post-incident cleanup) has to be copy-pasted
 * across YAML files.
 *
 * Safety invariants enforced by this executor:
 *
 * 1. **Cycle detection** — a runbook cannot call itself, directly or
 *    transitively. We walk the `parentExecutionId` chain on the DB
 *    and fail immediately if the target runbookId already appears.
 * 2. **Depth limit** — 5 levels. Tight by design; if you need more
 *    you probably want a flatter composition anyway.
 * 3. **Tenant isolation** — the target runbook must belong to the
 *    same tenant as the parent execution. Cross-tenant invocation is
 *    rejected even with a valid slug collision.
 *
 * Modes:
 *   - `sync` (default): poll the child execution status until it
 *     completes or the timeout fires. Child outputs get merged into
 *     `previousOutputs[stepId]` exactly like any other step.
 *   - `async`: fire-and-forget. Returns `{ childExecutionId }` so a
 *     later step can reference it if needed, but does not wait.
 */

export interface RunbookStepConfig {
  /** Runbook id or slug. Supports templates. */
  ref: string;
  /** Values passed as the child run's `input`. Templates resolved per-value. */
  inputs?: Record<string, unknown>;
  /** 'sync' waits for completion (default). 'async' returns immediately. */
  waitFor?: 'sync' | 'async';
  /** Sync-mode timeout in seconds (default: 600). */
  timeoutSeconds?: number;
}

const MAX_DEPTH = 5;
const POLL_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000;

export interface RunbookExecutorOptions {
  executionService?: ExecutionService;
  /** Injected for tests. */
  now?: () => number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class RunbookExecutor implements StepExecutor<RunbookStepConfig> {
  readonly type = 'runbook';

  private _executionService: ExecutionService | null = null;
  private readonly executionServiceOverride?: ExecutionService;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private prisma: PrismaClient,
    options: RunbookExecutorOptions = {}
  ) {
    // Lazy-construct the ExecutionService on first use — the
    // ExecutionService constructor builds its own executor registry
    // which includes this RunbookExecutor, so eager construction here
    // creates an infinite recursion. Tests inject a stub via options.
    this.executionServiceOverride = options.executionService;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? sleepMs;
  }

  private get executionService(): ExecutionService {
    if (this.executionServiceOverride) return this.executionServiceOverride;
    if (!this._executionService) {
      this._executionService = new ExecutionService(this.prisma);
    }
    return this._executionService;
  }

  async execute(config: RunbookStepConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = this.now();

    if (!config.ref || typeof config.ref !== 'string') {
      return {
        success: false,
        error: 'runbook.ref is required',
        duration: this.now() - startTime,
      };
    }

    const ref = resolveTemplate(config.ref, context).trim();
    if (!ref) {
      return {
        success: false,
        error: 'runbook.ref resolved to an empty string',
        duration: this.now() - startTime,
      };
    }

    const parent = await this.prisma.execution.findUnique({
      where: { id: context.runId },
      select: { userId: true, runbookId: true },
    });
    if (!parent) {
      return {
        success: false,
        error: `Parent execution ${context.runId} not found`,
        duration: this.now() - startTime,
      };
    }

    // Resolve the child runbook — accept either UUID or slug, but
    // always scope to the parent's tenant so a slug collision in
    // another tenant can't be invoked by accident.
    const target = await this.prisma.runbook.findFirst({
      where: {
        tenantId: context.tenantId,
        OR: [{ id: ref }, { slug: ref }],
      },
      select: { id: true, name: true },
    });
    if (!target) {
      return {
        success: false,
        error: `Runbook "${ref}" not found in this tenant`,
        duration: this.now() - startTime,
      };
    }

    // Cycle + depth check via the ancestor chain.
    const cycleError = await this.assertNoCycle(context.runId, target.id);
    if (cycleError) {
      return {
        success: false,
        error: cycleError,
        duration: this.now() - startTime,
      };
    }

    // Resolve templated inputs per-value. Non-string inputs pass
    // through untouched so numbers, booleans, and structured JSON
    // work without forced stringification.
    const resolvedInputs = resolveInputs(config.inputs ?? {}, context);

    context.emit?.({
      type: 'log',
      text: `Invoking runbook "${target.name}" (${target.id})`,
      timestamp: new Date(),
    });

    const childExecution = await this.executionService.execute({
      runbookId: target.id,
      userId: parent.userId,
      tenantId: context.tenantId,
      trigger: 'RUNBOOK',
      input: resolvedInputs,
      parentExecutionId: context.runId,
      // Dry-run propagates recursively so an operator dry-running
      // a top-level runbook gets the full tree dry-run — no
      // sub-runbook suddenly spawns a real shell command.
      dryRun: context.dryRun,
    });

    if (config.waitFor === 'async') {
      return {
        success: true,
        output: {
          childExecutionId: childExecution.id,
          runbookId: target.id,
          mode: 'async',
        },
        duration: this.now() - startTime,
      };
    }

    const timeoutMs = (config.timeoutSeconds ?? DEFAULT_TIMEOUT_MS / 1000) * 1_000;
    const deadline = this.now() + timeoutMs;
    while (this.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS);
      const current = await this.prisma.execution.findUnique({
        where: { id: childExecution.id },
        select: { status: true, error: true },
      });
      if (!current) {
        return {
          success: false,
          error: `Child execution ${childExecution.id} vanished`,
          duration: this.now() - startTime,
        };
      }
      if (current.status === 'SUCCESS') {
        return {
          success: true,
          output: {
            childExecutionId: childExecution.id,
            runbookId: target.id,
            status: current.status,
            mode: 'sync',
          },
          duration: this.now() - startTime,
        };
      }
      if (current.status === 'FAILED' || current.status === 'CANCELLED') {
        return {
          success: false,
          error:
            current.error ?? `Child runbook "${target.name}" ended with status ${current.status}`,
          output: {
            childExecutionId: childExecution.id,
            runbookId: target.id,
            status: current.status,
            mode: 'sync',
          },
          duration: this.now() - startTime,
        };
      }
      // RUNNING | PENDING | PAUSED → keep polling
    }

    return {
      success: false,
      error: `Timed out waiting for runbook "${target.name}" after ${timeoutMs / 1000}s`,
      output: {
        childExecutionId: childExecution.id,
        runbookId: target.id,
        mode: 'sync',
        timedOut: true,
      },
      duration: this.now() - startTime,
    };
  }

  /**
   * Walk up the parent-execution chain looking for two things:
   *   (a) the same runbookId as the target → that would be a cycle
   *   (b) too many hops → depth cap.
   *
   * Both cases return a human-readable error string. A clean chain
   * returns null and the caller proceeds to spawn the child.
   */
  private async assertNoCycle(
    parentExecutionId: string,
    targetWorkflowId: string
  ): Promise<string | null> {
    let cursor: string | null = parentExecutionId;
    let depth = 0;
    const visited = new Set<string>();

    while (cursor) {
      if (visited.has(cursor)) {
        // Defensive: this would mean the DB already has a cycle,
        // which is structurally impossible via the constructor
        // but is worth refusing instead of looping forever.
        return 'Parent execution chain has a loop';
      }
      visited.add(cursor);

      const row: { runbookId: string; parentExecutionId: string | null } | null =
        await this.prisma.execution.findUnique({
          where: { id: cursor },
          select: { runbookId: true, parentExecutionId: true },
        });
      if (!row) break;

      if (row.runbookId === targetWorkflowId) {
        return `Runbook cycle detected: target "${targetWorkflowId}" is already an ancestor in this run`;
      }

      depth += 1;
      if (depth > MAX_DEPTH) {
        return `Runbook nesting depth limit (${MAX_DEPTH}) exceeded`;
      }

      cursor = row.parentExecutionId;
    }
    return null;
  }
}

function resolveInputs(
  inputs: Record<string, unknown>,
  context: ExecutorContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string') {
      out[key] = resolveTemplate(value, context);
    } else {
      out[key] = value;
    }
  }
  return out;
}
