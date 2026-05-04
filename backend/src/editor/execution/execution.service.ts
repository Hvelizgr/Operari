import { Prisma, PrismaClient, Runbook, TriggerType } from '@prisma/client';

import { ActorType, AuditEventType, AuditService } from '../../audit/audit.service';
import type { BillingMeter } from '../../billing';
import { getBillingMeter } from '../../billing';
import { assertRunsQuota, QuotaExceededError } from '../../billing/quotas';
import {
  CustomError,
  ErrorCode,
  ErrorSeverity,
  WorkflowError,
  wrapError,
} from '../../errors/custom-error';
import { getRunTracer, RunTracer } from '../../observability';
import { ExecutionEventStore } from '../../runbook/engine/execution-event.store';
import type { ExecutionEventPayload } from '../../runbook/engine/execution-event.types';
import { getRunner } from '../../runbook/runners';
import { GitHubStatusService } from '../../runbook/services/github-status.service';
import { applyRunbookVersionSnapshot } from '../../runbook/services/runbook-version.service';
import { ErrorNotificationService } from '../../services/error-notification.service';
import { Logger } from '../../services/logger.service';
import {
  ExecutionInput,
  ExecutionOutput,
  SuspendResult,
  WorkflowConnection,
  WorkflowNode,
} from '../../types/runbook.types';
import { persistExecutionError } from '../../utils/error-persistence';
import { NodeExecutor } from '../node-executor.service';
import { socketService } from './socket.service';

interface ExecuteParams {
  runbookId: string;
  userId: string;
  trigger: TriggerType;
  input?: ExecutionInput;
  /**
   * Tenant that owns this run. Required — Execution / NodeLog /
   * ExecutionError all denormalize it, and tenant-scope enforcement
   * in the Prisma middleware would reject queries against these
   * tables if we left it nullable here.
   */
  tenantId: string;
  startNodeId?: string;
  /**
   * When set, the new Execution is tagged as a child of this run.
   * Used by the `runbook` step executor to spawn sub-workflows and
   * by the UI to render the parent/child execution tree.
   */
  parentExecutionId?: string;
  /**
   * Dry-run mode: every step executor logs what it WOULD do
   * without performing any side effect (no subprocess, no HTTP,
   * no notify, no pause for approval). Persists on the Execution
   * row and propagates to sub-runs via the `runbook` step.
   */
  dryRun?: boolean;
  /**
   * TTL in seconds (trigger.dev parity). When set, the engine
   * persists `expiresAt = now() + ttlSeconds` and refuses to
   * start the run if it surfaces past that point — useful when
   * the work loses relevance after some time (a webhook handler
   * with a 30s TTL would rather drop than run with stale input).
   * Null/undefined = no TTL (default: run whenever picked up).
   */
  ttlSeconds?: number;
  /**
   * Idempotency key (trigger.dev parity). The trigger route
   * deduplicates by `(tenantId, runbookId, idempotencyKey)` BEFORE
   * calling execute(); we persist the key on the Execution row so
   * the dedup index has something to point at.
   */
  idempotencyKey?: string;
}

interface ResumeParams {
  executionId: string;
  userId: string;
  tenantId: string;
  input?: ExecutionInput;
}

interface RunState {
  nodeOutputs: Record<string, ExecutionOutput>;
  executedNodes: Set<string>;
  nodesToExecute: WorkflowNode[];
  /**
   * Breakpoints that have already paused execution at least once during
   * this run. The pause-before-execute check skips ids in this set so
   * a resumed run actually runs the node instead of pausing again at
   * the same step. Persisted in `resumeState.disarmedBreakpoints` so
   * the property survives PAUSED→RUNNING round-trips.
   */
  disarmedBreakpoints?: Set<string>;
}

export interface ExecutionServiceOptions {
  /**
   * Audit service used to record run/step lifecycle events. If not
   * supplied, a default instance is created from the same Prisma client.
   * Pass `null` explicitly to disable auditing entirely (e.g. tests).
   */
  audit?: AuditService | null;
  /**
   * Run tracer used to map runs and steps onto OpenTelemetry traces.
   * Defaults to the process singleton, which is itself a no-op when
   * `ENABLE_TRACING` is unset (the OTel API returns no-op spans
   * without a registered SDK). Pass `null` to disable tracing
   * explicitly even if a tracer is registered globally.
   */
  tracer?: RunTracer | null;
  /**
   * Durable execution event store (ADR 0003 phase 2). When provided
   * (or when `OPERARI_DURABLE_ENGINE=true`) every state transition
   * is appended to the ExecutionEvent log alongside the audit chain
   * write, so a worker can resume in-flight runs after a restart.
   *
   * Pass `null` to disable event-store writes explicitly, even if
   * the env flag is set. Pass an instance to override the default
   * (used by tests to capture events with a fake store).
   *
   * Defaults: enabled iff `process.env.OPERARI_DURABLE_ENGINE === 'true'`.
   * The flag exists because phase 2 is the integration step the ADR
   * warns about — toggling it off must be a single env var flip.
   */
  eventStore?: ExecutionEventStore | null;
  /**
   * Billing meter (P1 #12). Self-host deployments get NoopBillingMeter
   * by default, which discards every event. Cloud deployments get
   * StripeBillingMeter via OPERARI_BILLING_PROVIDER=stripe and the
   * runtime emits run.started + run.completed billable events
   * automatically.
   *
   * Pass `null` to disable meter writes explicitly even when the
   * billing provider is configured (used by tests to assert that
   * the runtime did not emit). Pass an instance to inject a fake.
   */
  meter?: BillingMeter | null;
}

export class ExecutionService {
  private prisma: PrismaClient;
  private nodeExecutor: NodeExecutor;
  private logger: Logger;
  private notificationService: ErrorNotificationService;
  private audit: AuditService | null;
  private tracer: RunTracer | null;
  private eventStore: ExecutionEventStore | null;
  private meter: BillingMeter | null;

  constructor(prisma: PrismaClient, options: ExecutionServiceOptions = {}) {
    this.prisma = prisma;
    this.nodeExecutor = new NodeExecutor(prisma);
    this.logger = Logger.getInstance();
    this.notificationService = new ErrorNotificationService(prisma);
    this.audit = options.audit === null ? null : (options.audit ?? new AuditService(prisma));
    this.tracer = options.tracer === null ? null : (options.tracer ?? getRunTracer());
    this.eventStore =
      options.eventStore === null
        ? null
        : (options.eventStore ??
          (process.env.OPERARI_DURABLE_ENGINE === 'true' ? new ExecutionEventStore(prisma) : null));
    this.meter = options.meter === null ? null : (options.meter ?? getBillingMeter());
  }

  /**
   * Resolve the billing-side customer id for a tenant. Returns null
   * when no mapping exists (self-host tenants, cloud tenants without
   * a Stripe link), which causes meter.record() to no-op cleanly.
   *
   * Cached neither here nor in the meter — billing meter calls happen
   * at most twice per run (run.started + run.completed) so the cost
   * of the lookup is negligible compared to the run itself, and
   * caching adds invalidation complexity for the rare case where a
   * tenant gets re-linked to a new Stripe customer mid-run.
   */
  /**
   * Fire-and-forget per-step lifecycle hook (trigger.dev parity).
   *
   * When a step's config carries `_onSuccess: <runbook-slug-or-id>`
   * or `_onFailure: <runbook-slug-or-id>`, the engine dispatches a
   * child run of that runbook the moment the step terminates. The
   * payload is the step output (success) or `{ error, stepId,
   * stepType }` (failure), keyed under `parent` so the handler
   * runbook can read `{{ parent.error }}` etc.
   *
   * Why fire-and-forget: an SRE who sets `onFailure: notify-pager`
   * does not want the failing step's run to BLOCK on the notify
   * succeeding. The hook is a side-effect dispatch, not part of
   * the parent's data flow. If the hook runbook itself fails, that
   * failure is still in the runs list under its own row.
   *
   * Tenant scope is preserved — the lookup is `findFirst` against
   * `(tenantId, slug || id)` so a step in tenant A cannot call a
   * runbook in tenant B even with a verbatim id paste.
   */
  private async dispatchStepHook(
    kind: 'onSuccess' | 'onFailure',
    node: { id: string; type: string; config?: unknown },
    tenantId: string,
    userId: string,
    payload: Record<string, unknown>,
    parentExecutionId: string
  ): Promise<void> {
    try {
      const config = (node.config ?? {}) as Record<string, unknown>;
      const ref = config[kind === 'onSuccess' ? '_onSuccess' : '_onFailure'];
      if (typeof ref !== 'string' || ref.trim().length === 0) return;

      const target = await this.prisma.runbook.findFirst({
        where: {
          tenantId,
          OR: [{ id: ref }, { slug: ref }],
        },
      });
      if (!target) {
        // Misconfigured hook — log and move on. The parent run
        // already finished its step; surfacing this as a hard
        // failure would punish the operator for a one-line typo.
        this.logger.warn('Step hook target runbook not found', {
          metadata: { kind, ref, stepId: node.id, tenantId },
        });
        return;
      }

      // Fire-and-forget. The promise is intentionally not awaited;
      // we want the parent run loop to keep going while the hook
      // dispatches independently. Errors are logged for diagnosis
      // but do not propagate.
      void this.execute({
        runbookId: target.id,
        userId,
        trigger: 'API',
        tenantId,
        parentExecutionId,
        input: { parent: payload },
      }).catch(err => {
        this.logger.error('Step hook dispatch failed', {
          error: err instanceof Error ? err : new Error(String(err)),
          metadata: { kind, targetRunbookId: target.id },
        });
      });
    } catch (err) {
      this.logger.error('Step hook resolution failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: { kind, stepId: node.id },
      });
    }
  }

  private async resolveStripeCustomerId(
    tenantId: string | undefined | null
  ): Promise<string | undefined> {
    if (!tenantId) return undefined;
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true },
      });
      return tenant?.stripeCustomerId ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Best-effort GitHub commit status report. Reads the `metadata.github`
   * blob from the Execution row (written by webhook.routes when the run
   * was triggered by a GitHub webhook) and posts the terminal status to
   * the GitHub Statuses API.
   *
   * If the execution has no GitHub metadata (non-GitHub trigger), this
   * is a no-op. Never throws.
   */
  private async safeGitHubStatus(
    executionId: string,
    tenantId: string | undefined | null,
    params: {
      success: boolean;
      durationMs: number;
      workflowName: string;
      error?: string;
    }
  ): Promise<void> {
    if (!tenantId) return;
    try {
      const execution = await this.prisma.execution.findUnique({
        where: { id: executionId },
        select: { metadata: true },
      });

      const meta = execution?.metadata as Record<string, unknown> | null;
      const github = meta?.github as Record<string, string> | undefined;
      if (!github?.owner || !github?.repo || !github?.sha) return;

      const svc = new GitHubStatusService(this.prisma);
      await svc.reportRunEnd(tenantId, {
        owner: github.owner,
        repo: github.repo,
        sha: github.sha,
        runId: executionId,
        runbookName: github.runbookName ?? params.workflowName,
        success: params.success,
        durationMs: params.durationMs,
        error: params.error,
      });
    } catch (err) {
      this.logger.warn('GitHub status report failed (non-fatal)', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: { executionId },
      });
    }
  }

  /**
   * Best-effort billing meter call. Mirror of safeAudit / safeAppendEvent
   * for the billing layer: never throws on the request hot path,
   * never blocks on the meter, never branches on the return value.
   * The meter is itself best-effort (StripeBillingMeter swallows HTTP
   * failures) so this wrapper is just the null-check and tenant guard.
   */
  private async safeMeter(
    type: 'run.started' | 'run.completed' | 'run.failed',
    params: { tenantId?: string | null; executionId: string; customerId?: string }
  ): Promise<void> {
    if (!this.meter) return;
    if (!params.tenantId) return;
    try {
      await this.meter.record({
        type: type === 'run.failed' ? 'run.completed' : type,
        customerId: params.customerId,
        value: 1,
        idempotencyKey: `${type}:${params.executionId}`,
        metadata: {
          executionId: params.executionId,
          tenantId: params.tenantId,
        },
      });
    } catch (err) {
      // Defensive — the meter contract says implementations swallow
      // their own errors, but a bug in a custom implementation
      // should not break the request.
      this.logger.warn('billing meter record failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: { type, executionId: params.executionId },
      });
    }
  }

  /**
   * Best-effort accessor for the configured runner type. Returns
   * undefined if the runner singleton has not been initialized or
   * throws — tracing must never break execution.
   */
  private safeRunnerType(): string | undefined {
    try {
      return getRunner().type;
    } catch {
      return undefined;
    }
  }

  /**
   * Fire-and-forget audit write. Failures are logged but never break
   * the surrounding execution — auditing is observability, not a hard
   * dependency. Skips silently when tenantId is missing (legacy callers
   * without multi-tenant context) so we don't drop events with no chain
   * to attach them to.
   */
  private async safeAudit(
    type: AuditEventType,
    params: {
      tenantId?: string | null;
      actorId?: string | null;
      actorType?: ActorType | null;
      resource?: string | null;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    if (!this.audit) return;
    if (!params.tenantId) return;
    try {
      await this.audit.record({
        tenantId: params.tenantId,
        type,
        actorId: params.actorId ?? null,
        actorType: params.actorType ?? null,
        resource: params.resource ?? null,
        payload: params.payload,
      });
    } catch (err) {
      this.logger.error('audit write failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: { type, resource: params.resource },
      });
    }
  }

  /**
   * Best-effort append to the durable execution event store. The
   * mirror of `safeAudit` for ADR 0003 phase 2: every state
   * transition that already calls safeAudit also calls this so
   * the event store is the durable copy used by the worker on
   * restart.
   *
   * Skips silently when the event store is not configured (feature
   * flag off, or `eventStore: null` injected by a test) or when
   * tenantId is missing — the worker scopes its replay queries by
   * tenant so an event with no tenant has no consumer.
   *
   * Failures are logged but never block execution. The audit chain
   * is the compliance backstop; the event store is observability +
   * resumability, both best-effort.
   */
  private async safeAppendEvent(
    executionId: string,
    tenantId: string | undefined | null,
    event: ExecutionEventPayload
  ): Promise<void> {
    if (!this.eventStore) return;
    if (!tenantId) return;
    try {
      await this.eventStore.append(executionId, tenantId, event);
    } catch (err) {
      this.logger.error('execution event store write failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        metadata: { type: event.type, executionId },
      });
    }
  }

  /**
   * Dispatch the `onErrorRunbookId` handler when a run ends FAILED.
   *
   * Safety invariants:
   *   - The parent run's `trigger` must NOT already be `ERROR`. An
   *     ERROR-triggered run that itself fails does NOT cascade into
   *     another error run — otherwise a buggy handler loops.
   *   - The target runbook must not appear anywhere in the ancestor
   *     chain (cycle detection, same pattern as `RunbookExecutor`).
   *   - The target must belong to the same tenant.
   *   - Any failure in the dispatch path is swallowed. The parent's
   *     FAILED transition already committed before this method runs,
   *     so a broken handler cannot corrupt run state.
   */
  private async dispatchErrorHandler(params: {
    failedExecutionId: string;
    runbook: Runbook;
    errorMessage: string;
    tenantId: string | undefined;
    userId: string;
    // Accept the shape of the ContextLogger without importing it
    // (avoids dragging the Logger type system into this helper).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contextLogger: { info: (...args: any[]) => void; warn: (...args: any[]) => void };
  }): Promise<void> {
    const { failedExecutionId, runbook, errorMessage, tenantId, userId, contextLogger } = params;

    const handlerId = (runbook as Runbook & { onErrorRunbookId?: string | null }).onErrorRunbookId;
    if (!handlerId) return;

    const current = await this.prisma.execution.findUnique({
      where: { id: failedExecutionId },
      select: { trigger: true },
    });
    if (!current) return;
    if (current.trigger === 'ERROR') {
      contextLogger.info('error handler skipped: run was itself ERROR-triggered');
      return;
    }

    const cycleMessage = await this.errorHandlerCycleCheck(failedExecutionId, handlerId);
    if (cycleMessage) {
      contextLogger.warn(`error handler skipped: ${cycleMessage}`);
      return;
    }

    const effectiveTenantId = tenantId ?? runbook.tenantId;
    const target = await this.prisma.runbook.findFirst({
      where: { id: handlerId, tenantId: effectiveTenantId },
      select: { id: true, name: true },
    });
    if (!target) {
      contextLogger.warn('error handler skipped: target runbook not found in tenant', {
        metadata: { handlerId },
      });
      return;
    }

    try {
      await this.execute({
        runbookId: target.id,
        userId,
        tenantId: effectiveTenantId,
        trigger: 'ERROR',
        parentExecutionId: failedExecutionId,
        input: {
          error: {
            runId: failedExecutionId,
            runbookId: runbook.id,
            runbookName: runbook.name,
            message: errorMessage,
          },
        },
      });
      contextLogger.info('error handler dispatched', {
        metadata: { handlerRunbookId: target.id, handlerName: target.name },
      });
    } catch (err) {
      contextLogger.warn('error handler dispatch threw', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  /**
   * Walk up `parentExecutionId` from the failed run. If the target
   * handler's runbookId appears anywhere in the chain we refuse the
   * dispatch — the handler is (directly or transitively) already
   * running above us, and another child would loop.
   */
  private async errorHandlerCycleCheck(
    failedExecutionId: string,
    targetWorkflowId: string
  ): Promise<string | null> {
    let cursor: string | null = failedExecutionId;
    const visited = new Set<string>();
    let depth = 0;
    const MAX = 10;
    while (cursor && depth < MAX) {
      if (visited.has(cursor)) return 'ancestor chain has a loop';
      visited.add(cursor);
      const row: { runbookId: string; parentExecutionId: string | null } | null =
        await this.prisma.execution.findUnique({
          where: { id: cursor },
          select: { runbookId: true, parentExecutionId: true },
        });
      if (!row) break;
      if (row.runbookId === targetWorkflowId) {
        return `target handler "${targetWorkflowId}" is already in the run chain`;
      }
      cursor = row.parentExecutionId;
      depth += 1;
    }
    return null;
  }

  async execute(params: ExecuteParams) {
    const {
      runbookId,
      userId,
      trigger,
      input = {},
      tenantId,
      startNodeId,
      parentExecutionId,
      dryRun,
      ttlSeconds,
      idempotencyKey,
    } = params;

    try {
      // Fetch runbook
      const runbook = await this.prisma.runbook.findUnique({
        where: { id: runbookId },
      });

      if (!runbook) {
        throw new WorkflowError({
          message: `Runbook not found: ${runbookId}`,
          code: ErrorCode.WORKFLOW_NOT_FOUND,
          runbookId,
          context: { userId, tenantId },
        });
      }

      // Runs-per-month quota gate. Enforced BEFORE we insert the
      // Execution row — if the tenant is at their plan cap we do
      // not want a half-committed run record that the UI shows
      // as "starting then immediately blocked". ERROR-triggered
      // sub-runs still count; they're real platform work.
      const effectiveTenantIdForQuota = tenantId ?? runbook.tenantId;
      try {
        await assertRunsQuota(this.prisma, effectiveTenantIdForQuota);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          throw new WorkflowError({
            message: err.message,
            code: ErrorCode.QUOTA_EXCEEDED,
            runbookId,
            context: {
              userId,
              tenantId,
              resource: err.resource,
              current: err.current,
              limit: err.limit,
            },
          });
        }
        throw err;
      }

      // Pin the run to the latest frozen RunbookVersion. The engine
      // then walks THAT snapshot rather than the mutable Runbook row,
      // so an edit that lands mid-run cannot rewrite the DAG under a
      // running execution. Null only for runbooks saved before A1
      // landed — the next save creates version 1 and the next run
      // pins itself.
      const latestVersion = await this.prisma.runbookVersion.findFirst({
        where: { runbookId: runbookId },
        orderBy: { version: 'desc' },
      });

      // Create execution record. The dryRun flag must be persisted
      // so the run-history filter and the run detail page can label
      // the row distinctly — otherwise every dry-run looks like a
      // real run in /runs.
      // Compute expiresAt from the optional TTL. Stored as an
      // absolute target (vs duration + start) so the watchdog
      // can compare with `expiresAt < now()` directly. We
      // re-check this just before the engine consumes the
      // execution, so a TTL set to a tiny window with no queue
      // pressure gives "ran" not "expired".
      const expiresAt =
        ttlSeconds && Number.isFinite(ttlSeconds) && ttlSeconds > 0
          ? new Date(Date.now() + Math.floor(ttlSeconds * 1000))
          : null;

      const execution = await this.prisma.execution.create({
        data: {
          runbookId,
          tenantId,
          userId,
          trigger,
          status: 'RUNNING',
          parentExecutionId,
          runbookVersionId: latestVersion?.id ?? null,
          dryRun: dryRun ?? false,
          expiresAt,
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      // Belt + braces: if the TTL was so short the run already
      // expired before we persisted it (e.g. tenant clock drift,
      // post-create scheduler delay), short-circuit BEFORE
      // running anything. The execution is finalised with a
      // sanitised error so the runs list shows TTL_EXCEEDED via
      // the deriveDisplayStatus helper.
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        await this.prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            error: 'TTL exceeded before execution started (TTL_EXCEEDED)',
            completedAt: new Date(),
          },
        });
        return execution;
      }

      // Create context logger for this execution
      const executionContext = {
        executionId: execution.id,
        runbookId,
        workflowName: runbook.name,
        userId,
        tenantId,
      };

      const contextLogger = this.logger.child(executionContext);
      contextLogger.info('Runbook execution started');
      socketService.emitLog(execution.id, 'Runbook execution started');
      socketService.emitExecutionStatus(execution.id, 'RUNNING');

      await this.safeAudit('run.started', {
        tenantId,
        actorId: userId,
        actorType: 'user',
        resource: execution.id,
        payload: {
          executionId: execution.id,
          runbookId,
          workflowName: runbook.name,
          trigger,
          startNodeId: startNodeId ?? null,
        },
      });

      // ADR 0003 phase 2: durable event store mirror.
      // run.created comes first so the worker can see the run
      // even if the runtime crashes between create and start.
      await this.safeAppendEvent(execution.id, tenantId, {
        type: 'run.created',
        payload: {
          runbookId,
          workflowName: runbook.name,
          trigger: String(trigger),
          startNodeId: startNodeId ?? null,
          userId,
        },
      });
      await this.safeAppendEvent(execution.id, tenantId, {
        type: 'run.started',
        payload: { startedAt: new Date().toISOString() },
      });

      // Billing (P1 #12): emit run.started to the configured meter.
      // Resolve the Stripe customer once at the start so the
      // run.completed call can reuse it without an extra DB hit.
      const stripeCustomerId = await this.resolveStripeCustomerId(tenantId);
      await this.safeMeter('run.started', {
        tenantId,
        executionId: execution.id,
        customerId: stripeCustomerId,
      });

      // OTel: open the run trace. Span attributes include runner.type
      // so dashboards can group runs by where they actually executed.
      // Wrapped in try/catch because tracer.startRun is best-effort
      // observability and must never block a real execution.
      // Tenant resolution: prefer the explicitly passed tenantId.
      // The 'default-tenant' fallback is preserved only because
      // self-host single-user mode reaches this path with an
      // anonymous user, and the tracer expects a non-empty tag.
      // Multi-tenant cloud paths always pass a real tenantId,
      // so the fallback never fires there.
      const effectiveTenantId = tenantId ?? runbook.tenantId ?? 'default-tenant';
      try {
        this.tracer?.startRun({
          runId: execution.id,
          runbookId: runbook.id,
          runbookName: runbook.name,
          tenantId: effectiveTenantId,
          trigger: String(trigger),
          runnerType: this.safeRunnerType(),
        });
      } catch (err) {
        this.logger.warn('tracer.startRun failed', {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }

      // Build the effective runbook: when we have a frozen version,
      // splice its snapshot's definition fields over the current
      // Runbook row. The engine reads `nodes` / `connections` /
      // `inputs` from this object, so a user editing the runbook
      // mid-flight cannot corrupt an in-flight run.
      const effectiveWorkflow = latestVersion
        ? applyRunbookVersionSnapshot(runbook, latestVersion.snapshot)
        : runbook;

      // Run runbook asynchronously with proper error handling
      this.runWorkflow(
        execution.id,
        effectiveWorkflow,
        input,
        executionContext,
        tenantId,
        startNodeId,
        undefined,
        dryRun ?? false
      ).catch(error => {
        // This handles uncaught errors from runWorkflow
        this.logger.error('Uncaught error in runbook execution', {
          context: executionContext,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

      return execution;
    } catch (error) {
      const wrappedError = wrapError(error, { runbookId, userId, tenantId });
      this.logger.error('Failed to initialize runbook execution', {
        error: wrappedError,
      });
      throw wrappedError;
    }
  }

  async replayExecution(params: {
    executionId: string;
    nodeId?: string;
    userId: string;
    tenantId: string;
  }) {
    const { executionId, nodeId, userId, tenantId } = params;

    // Fetch original execution and its logs
    const originalExecution = await this.prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        runbook: true,
        nodeLogs: true,
      },
    });

    if (!originalExecution) {
      throw new WorkflowError({
        message: `Original execution not found: ${executionId}`,
        code: ErrorCode.EXECUTION_NOT_FOUND,
        runbookId: '',
      });
    }

    // Create a new execution for the replay
    const newExecution = await this.prisma.execution.create({
      data: {
        runbookId: originalExecution.runbookId,
        tenantId,
        userId,
        trigger: originalExecution.trigger,
        status: 'RUNNING',
      },
    });

    const executionContext = {
      executionId: newExecution.id,
      runbookId: originalExecution.runbookId,
      workflowName: originalExecution.runbook.name,
      userId,
      tenantId,
      isReplay: true,
      originalExecutionId: executionId,
    };

    const contextLogger = this.logger.child(executionContext);
    contextLogger.info('Runbook replay started');
    socketService.emitLog(newExecution.id, 'Runbook replay started');

    // Prepare initial state from historical data if replaying from a specific node
    if (nodeId) {
      const log = originalExecution.nodeLogs.find(l => l.nodeId === nodeId);
      if (!log) throw new Error('Node log not found for replay');

      this.runWorkflow(
        newExecution.id,
        originalExecution.runbook,
        log.input as ExecutionInput,
        executionContext,
        tenantId,
        nodeId
      ).catch(err => {
        this.logger.error('Error in replayed runbook', { context: executionContext, error: err });
      });
    } else {
      this.runWorkflow(
        newExecution.id,
        originalExecution.runbook,
        {}, // Start from the beginning
        executionContext,
        tenantId
      ).catch(err => {
        this.logger.error('Error in replayed runbook', { context: executionContext, error: err });
      });
    }

    return newExecution;
  }

  async resumeExecution(params: ResumeParams) {
    const { executionId, userId, tenantId, input = {} } = params;

    const execution = await this.prisma.execution.findFirst({
      where: {
        id: executionId,
        runbook: { tenantId },
        status: 'PAUSED',
      },
      include: { runbook: true },
    });

    if (!execution || !execution.runbook) {
      throw new WorkflowError({
        message: `Paused execution not found: ${executionId}`,
        code: ErrorCode.EXECUTION_NOT_FOUND,
        runbookId: '',
      });
    }

    const contextLogger = this.logger.child({
      executionId,
      runbookId: execution.runbookId,
      userId,
      tenantId,
      isResumed: true,
    });
    contextLogger.info('Runbook execution resumed');

    // Update status to running
    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: 'RUNNING', pausedAt: null },
    });

    await this.safeAudit('run.resumed', {
      tenantId,
      actorId: userId,
      actorType: 'user',
      resource: executionId,
      payload: {
        executionId,
        runbookId: execution.runbookId,
      },
    });

    await this.safeAppendEvent(executionId, tenantId, {
      type: 'run.resumed',
      payload: { actorId: userId },
    });

    // The DB column is `Json` — typed as unknown here and narrowed per
    // field below. A missing/malformed column collapses to the empty
    // defaults so a pre-durable-engine checkpoint resumes cleanly.
    const resumeState = (execution.resumeState ?? {}) as {
      nodeOutputs?: Record<string, Record<string, unknown>>;
      executedNodes?: string[];
      nodesToExecute?: string[];
      /** Breakpoint ids already paused at during this run — see RunState.disarmedBreakpoints. */
      disarmedBreakpoints?: string[];
    };
    const allNodes = execution.runbook.nodes as unknown as WorkflowNode[];

    // Restore state
    const initialState: RunState = {
      nodeOutputs: resumeState.nodeOutputs ?? {},
      executedNodes: new Set(resumeState.executedNodes ?? []),
      nodesToExecute: (resumeState.nodesToExecute ?? [])
        .map((nodeId: string) => allNodes.find((n: WorkflowNode) => n.id === nodeId))
        .filter((n: WorkflowNode | undefined): n is WorkflowNode => !!n),
      disarmedBreakpoints: new Set(resumeState.disarmedBreakpoints ?? []),
    };

    // Merge new input with the output of the node that paused the execution
    const lastExecutedNodeId = Array.from(initialState.executedNodes).pop();
    if (lastExecutedNodeId && initialState.nodeOutputs[lastExecutedNodeId]) {
      Object.assign(initialState.nodeOutputs[lastExecutedNodeId], input);
    }

    this.runWorkflow(
      execution.id,
      execution.runbook,
      {}, // Original input is already baked into the state
      { executionId, runbookId: execution.runbookId, userId, tenantId },
      tenantId,
      undefined,
      initialState
    ).catch(error => {
      this.logger.error('Uncaught error in resumed runbook execution', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    return execution;
  }

  /**
   * Phase-4 durable resume entry point — the ResumeWorker calls this
   * after reconstructing a run's checkpoint from the event log.
   *
   * Inputs:
   *   - `executionId` / `runbook`: already loaded by the worker so we
   *     don't make a second trip for them.
   *   - `completedNodeIds`: union of successful + skipped + failed
   *     step ids. The engine skips these on re-entry.
   *   - `nodeOutputs`: outputs captured from `step.completed` events,
   *     keyed by nodeId. Downstream nodes read from here instead of
   *     re-running predecessors.
   *
   * Contract: does NOT create a new Execution row. Flips the existing
   * one back to RUNNING, appends a `run.resumed` event, then re-enters
   * the same runWorkflow loop the initial dispatch used, seeded with
   * the reconstructed state. Fire-and-forget like `execute()`.
   *
   * Safety: the worker is responsible for making sure no steps were
   * `step.started` without a terminal event (i.e. `inFlightSteps` is
   * empty). If that invariant breaks, the resumed run will re-execute
   * side effects the interrupted step already issued.
   */
  async resumeFromEventLog(params: {
    executionId: string;
    runbook: Runbook;
    completedNodeIds: string[];
    nodeOutputs: Record<string, unknown>;
    userId: string;
    tenantId: string;
  }): Promise<void> {
    const { executionId, runbook, completedNodeIds, nodeOutputs, userId, tenantId } = params;
    const allNodes = runbook.nodes as unknown as WorkflowNode[];
    const allConnections = runbook.connections as unknown as WorkflowConnection[];

    // Cast the raw event-log outputs to the engine's ExecutionOutput
    // shape. The outputs were serialized from this same engine, so the
    // structural cast is safe — we just lost the nominal type through
    // Json round-tripping.
    const nodeOutputsTyped: Record<string, ExecutionOutput> = {};
    for (const [nodeId, output] of Object.entries(nodeOutputs)) {
      nodeOutputsTyped[nodeId] = output as ExecutionOutput;
    }

    // Seed nodesToExecute = children of completed nodes that haven't
    // themselves completed. The runWorkflow loop already walks
    // children of executedNodes once the queue drains, so this gives
    // it a starting frontier without asking it to re-enter from the
    // original triggers (which would re-execute the whole chain).
    const executedSet = new Set(completedNodeIds);
    const nextFrontier = new Map<string, WorkflowNode>();
    for (const conn of allConnections) {
      if (!executedSet.has(conn.source)) continue;
      if (executedSet.has(conn.target)) continue;
      const targetNode = allNodes.find(n => n.id === conn.target);
      if (targetNode) nextFrontier.set(targetNode.id, targetNode);
    }

    const initialState: RunState = {
      nodeOutputs: nodeOutputsTyped,
      executedNodes: executedSet,
      nodesToExecute: Array.from(nextFrontier.values()),
    };

    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });

    await this.safeAppendEvent(executionId, tenantId, {
      type: 'run.resumed',
      payload: { actorId: null },
    });

    const executionContext = {
      executionId,
      runbookId: runbook.id,
      workflowName: runbook.name,
      userId,
      tenantId,
      isResumedFromEventLog: true,
    };

    this.logger
      .child(executionContext)
      .info('Runbook resumed from event log (phase 4 durable engine)');

    this.runWorkflow(
      executionId,
      runbook,
      {},
      executionContext,
      tenantId,
      undefined,
      initialState
    ).catch(error => {
      this.logger.error('Uncaught error in event-log resumed runbook', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  }

  /**
   * Resolve the children of a finished node that are now ready to
   * execute — every one of their parents is already in executedNodes.
   *
   * Replaces the earlier "push every child, pop later, skip if not
   * ready, re-queue" busy-spin pattern. Deferring the push until the
   * join is satisfied means each node lands in the queue exactly
   * once regardless of how many parents converged on it.
   *
   * Skipped nodes are treated as executed (the engine already adds
   * them to `executedNodes`) so a Condition/Switch that bypasses one
   * branch still unblocks downstream joins via the surviving branch.
   */
  private readyChildrenOf(
    nodeId: string,
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    executedNodes: Set<string>
  ): WorkflowNode[] {
    const ready: WorkflowNode[] = [];
    for (const conn of connections) {
      if (conn.source !== nodeId) continue;
      const child = nodes.find(n => n.id === conn.target);
      if (!child) continue;
      if (executedNodes.has(child.id)) continue;
      const parents = connections.filter(c => c.target === child.id);
      const allParentsDone = parents.every(p => executedNodes.has(p.source));
      if (allParentsDone) ready.push(child);
    }
    return ready;
  }

  private async runWorkflow(
    executionId: string,
    runbook: Runbook,
    input: ExecutionInput,
    executionContext: Record<string, unknown>,
    tenantId: string,
    startNodeId?: string,
    initialState?: RunState,
    dryRun: boolean = false
  ) {
    const startTime = Date.now();
    const contextLogger = this.logger.child(executionContext);

    // Cast Prisma JSON fields to typed arrays
    const nodes = runbook.nodes as unknown as WorkflowNode[];
    const connections = runbook.connections as unknown as WorkflowConnection[];

    try {
      // Validate runbook before execution
      if (!initialState) {
        // Only validate on first run, not on resume
        this.validateWorkflow(nodes, connections);
      }

      const nodeOutputs = initialState?.nodeOutputs || {};
      const executedNodes = initialState?.executedNodes
        ? new Set(initialState.executedNodes)
        : new Set<string>();
      // Breakpoint state — list comes from the persisted Runbook, the
      // disarmed set comes from `resumeState` so a resumed run does NOT
      // re-pause at the breakpoint that triggered the prior pause.
      const breakpoints = (
        (runbook as unknown as { breakpoints?: string[] }).breakpoints ?? []
      ).filter(Boolean);
      const disarmedBreakpoints = new Set<string>(initialState?.disarmedBreakpoints ?? []);

      let nodesToExecute: WorkflowNode[];
      if (initialState) {
        // If resuming, use the nodes that were pending execution
        nodesToExecute = initialState.nodesToExecute || [];
      } else if (startNodeId) {
        nodesToExecute = nodes.filter(n => n.id === startNodeId);
      } else {
        const triggerNodes = nodes.filter(
          n => n.type === 'Webhook' || n.type === 'Trigger' || n.type === 'Schedule'
        );
        nodesToExecute = triggerNodes.length > 0 ? triggerNodes : [nodes[0]];
      }

      while (nodesToExecute.length > 0) {
        const currentNode = nodesToExecute.shift()!;

        if (executedNodes.has(currentNode.id)) continue;

        // Skip disabled nodes

        if (currentNode.enabled === false) {
          await this.prisma.nodeLog.create({
            data: {
              executionId,
              tenantId,

              nodeId: currentNode.id,

              nodeName: currentNode.title,

              nodeType: currentNode.type,

              status: 'SKIPPED',

              input: {} as Prisma.InputJsonValue,
            },
          });

          socketService.emitNodeStatus(executionId, currentNode.id, 'SKIPPED');

          await this.safeAudit('step.skipped', {
            tenantId,
            actorId: (executionContext.userId as string | undefined) ?? null,
            actorType: 'system',
            resource: executionId,
            payload: {
              executionId,
              runbookId: runbook.id,
              nodeId: currentNode.id,
              nodeName: currentNode.title,
              nodeType: currentNode.type,
              reason: 'disabled',
            },
          });

          await this.safeAppendEvent(executionId, tenantId, {
            type: 'step.skipped',
            nodeId: currentNode.id,
            payload: {
              nodeName: currentNode.title,
              nodeType: currentNode.type,
              reason: 'disabled',
            },
          });

          executedNodes.add(currentNode.id); // Mark as "executed" to allow children to run

          // Add children whose ALL parents are now executed. Children
          // with still-pending parents stay out of the queue; the last
          // parent to finish is the one that pushes them.
          nodesToExecute.push(
            ...this.readyChildrenOf(currentNode.id, nodes, connections, executedNodes)
          );

          continue;
        }

        // Invariant: readyChildrenOf only pushes nodes whose parents
        // are all in executedNodes, so by the time a node pops here
        // every predecessor has already been evaluated. This replaces
        // the old "if not all parents done, continue" busy-spin.

        // Debug Option C — breakpoint pause. Generalises the same halt
        // mechanism the approval/Suspend executors use: when the next
        // node is a breakpoint that hasn't been disarmed yet, persist
        // `resumeState` (with the current node put back at the front
        // of `nodesToExecute` so resume runs it first) and flip the
        // run to PAUSED. The disarmed set rides along in `resumeState`
        // so the upcoming resume doesn't pause again at the same id —
        // separate breakpoints further down still fire normally.
        if (breakpoints.includes(currentNode.id) && !disarmedBreakpoints.has(currentNode.id)) {
          nodesToExecute.unshift(currentNode);
          disarmedBreakpoints.add(currentNode.id);
          await this.prisma.execution.update({
            where: { id: executionId },
            data: {
              status: 'PAUSED',
              pausedAt: new Date(),
              resumeState: {
                nodeOutputs,
                executedNodes: Array.from(executedNodes),
                nodesToExecute: nodesToExecute.map(n => n.id),
                disarmedBreakpoints: Array.from(disarmedBreakpoints),
              } as unknown as Prisma.InputJsonValue,
            },
          });
          contextLogger.info('Runbook execution paused at breakpoint', {
            metadata: { nodeId: currentNode.id, nodeType: currentNode.type },
          });
          socketService.emitLog(executionId, `Breakpoint hit: ${currentNode.title}`, {
            nodeId: currentNode.id,
          });
          socketService.emitExecutionStatus(executionId, 'PAUSED');

          await this.safeAudit('run.paused', {
            tenantId,
            actorId: (executionContext.userId as string | undefined) ?? null,
            actorType: 'system',
            resource: executionId,
            payload: {
              executionId,
              runbookId: runbook.id,
              pausedAtNodeId: currentNode.id,
              pausedAtNodeName: currentNode.title,
              pausedAtNodeType: currentNode.type,
              reason: 'breakpoint',
            },
          });

          await this.safeAppendEvent(executionId, tenantId, {
            type: 'run.paused',
            payload: {
              pausedAtNodeId: currentNode.id,
              pausedAtNodeType: currentNode.type,
            },
          });

          return;
        }

        const nodeInput = this.getNodeInput(currentNode.id, connections, nodeOutputs, input, {
          workflow: {
            id: runbook.id,
            name: runbook.name,
            ...((runbook as unknown as { slug?: string }).slug
              ? { slug: (runbook as unknown as { slug: string }).slug }
              : {}),
          },
          run: {
            id: executionId,
            startedAt: new Date(startTime).toISOString(),
            ...(executionContext.trigger ? { trigger: String(executionContext.trigger) } : {}),
          },
        });

        const nodeLog = await this.prisma.nodeLog.create({
          data: {
            executionId,
            tenantId,
            nodeId: currentNode.id,
            nodeName: currentNode.title,
            nodeType: currentNode.type,
            status: 'RUNNING',
            input: nodeInput as unknown as Prisma.InputJsonValue,
          },
        });

        socketService.emitNodeStatus(executionId, currentNode.id, 'RUNNING');
        socketService.emitLog(executionId, `Node execution started: ${currentNode.title}`, {
          nodeId: currentNode.id,
        });

        const nodeContext = {
          ...executionContext,
          nodeId: currentNode.id,
          nodeName: currentNode.title,
          nodeType: currentNode.type,
        };
        const nodeContextLogger = this.logger.child(nodeContext);
        const nodeStartTime = Date.now();

        // OTel: open the step span. Best-effort.
        try {
          this.tracer?.startStep({
            runId: executionId,
            stepId: currentNode.id,
            stepName: currentNode.title,
            stepType: currentNode.type,
          });
        } catch (err) {
          nodeContextLogger.warn('tracer.startStep failed', {
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }

        await this.safeAppendEvent(executionId, tenantId, {
          type: 'step.started',
          nodeId: currentNode.id,
          payload: {
            nodeName: currentNode.title,
            nodeType: currentNode.type,
            startedAt: new Date().toISOString(),
          },
        });

        try {
          nodeContextLogger.debug('Node execution started');
          const output = await this.nodeExecutor.execute(
            currentNode,
            nodeInput,
            tenantId,
            executionId,
            dryRun
          );

          // Handle suspend signal
          if ((output as SuspendResult).isSuspended) {
            await this.prisma.execution.update({
              where: { id: executionId },
              data: {
                status: 'PAUSED',
                pausedAt: new Date(),
                resumeState: {
                  nodeOutputs,
                  executedNodes: Array.from(executedNodes),
                  nodesToExecute: nodesToExecute.map(n => n.id),
                  // Carry the breakpoint disarmed set across a Suspend
                  // pause so a runbook that mixes Suspend halts and
                  // breakpoints doesn't re-pause at the same id.
                  disarmedBreakpoints: Array.from(disarmedBreakpoints),
                } as unknown as Prisma.InputJsonValue,
              },
            });
            contextLogger.info('Runbook execution paused');
            socketService.emitLog(executionId, 'Runbook execution paused', {
              nodeId: currentNode.id,
            });
            socketService.emitExecutionStatus(executionId, 'PAUSED');

            await this.safeAudit('run.paused', {
              tenantId,
              actorId: (executionContext.userId as string | undefined) ?? null,
              actorType: 'system',
              resource: executionId,
              payload: {
                executionId,
                runbookId: runbook.id,
                pausedAtNodeId: currentNode.id,
                pausedAtNodeName: currentNode.title,
                pausedAtNodeType: currentNode.type,
              },
            });

            await this.safeAppendEvent(executionId, tenantId, {
              type: 'run.paused',
              payload: {
                pausedAtNodeId: currentNode.id,
                pausedAtNodeType: currentNode.type,
              },
            });

            return; // Stop execution
          }

          const nodeDuration = Date.now() - nodeStartTime;

          nodeOutputs[currentNode.id] = output;
          executedNodes.add(currentNode.id);

          await this.prisma.nodeLog.update({
            where: { id: nodeLog.id },
            data: {
              status: 'SUCCESS',
              output: output as unknown as Prisma.InputJsonValue,
              completedAt: new Date(),
              duration: nodeDuration,
            },
          });

          // Fire `onSuccess` hook if the step was wired with one.
          // Side-effect dispatch — we do NOT await; the parent run
          // keeps marching while the handler runbook starts.
          void this.dispatchStepHook(
            'onSuccess',
            currentNode,
            tenantId,
            (executionContext.userId as string) ?? '',
            { stepId: currentNode.id, stepType: currentNode.type, output },
            executionId
          );

          socketService.emitNodeStatus(executionId, currentNode.id, 'SUCCESS', output);
          socketService.emitLog(executionId, `Node execution completed: ${currentNode.title}`, {
            nodeId: currentNode.id,
            duration: nodeDuration,
          });

          nodeContextLogger.debug('Node execution completed successfully', {
            duration: nodeDuration,
          });

          await this.safeAudit('step.completed', {
            tenantId,
            actorId: (executionContext.userId as string | undefined) ?? null,
            actorType: 'system',
            resource: executionId,
            payload: {
              executionId,
              runbookId: runbook.id,
              nodeId: currentNode.id,
              nodeName: currentNode.title,
              nodeType: currentNode.type,
              durationMs: nodeDuration,
            },
          });

          await this.safeAppendEvent(executionId, tenantId, {
            type: 'step.completed',
            nodeId: currentNode.id,
            payload: {
              nodeName: currentNode.title,
              nodeType: currentNode.type,
              durationMs: nodeDuration,
              output,
            },
          });

          try {
            this.tracer?.endStep(executionId, currentNode.id, true);
          } catch (err) {
            nodeContextLogger.warn('tracer.endStep (success) failed', {
              error: err instanceof Error ? err : new Error(String(err)),
            });
          }

          // --- Conditional branching ---
          // Condition/If nodes: follow port 0 (true) or port 1 (false)
          // based on conditionResult. Switch nodes: follow the port
          // matching matchedCase. Loop nodes: iterate children once per
          // item, injecting currentItem/currentIndex into the context.
          const nodeOutput = nodeOutputs[currentNode.id] as Record<string, unknown> | undefined;
          const isConditionNode =
            currentNode.type === 'Condition' ||
            currentNode.type === 'If' ||
            currentNode.type === 'operari.if';
          const isSwitchNode =
            currentNode.type === 'Switch' || currentNode.type === 'operari.switch';
          const isLoopNode =
            currentNode.type === 'Loop' ||
            currentNode.type === 'Iterator' ||
            currentNode.type === 'operari.loop';
          const isWaitpointNode = currentNode.type === 'waitpoint';

          let outgoingConnections = connections.filter(c => c.source === currentNode.id);

          if (isConditionNode && nodeOutput) {
            const passed = Boolean(nodeOutput.conditionResult);
            // Port 0 = true branch, port 1 = false branch.
            // Connections without sourcePort follow the true branch (backward compat).
            outgoingConnections = outgoingConnections.filter(c => {
              if (passed) return c.sourcePort === 0 || c.sourcePort === undefined;
              return c.sourcePort === 1;
            });
          } else if (isSwitchNode && nodeOutput) {
            const matchedCase = nodeOutput.matchedCase as number | undefined;
            if (matchedCase !== undefined) {
              outgoingConnections = outgoingConnections.filter(
                c => c.sourcePort === matchedCase || c.sourcePort === undefined
              );
            }
          } else if (isWaitpointNode && nodeOutput) {
            // Port 0 = `completed` (the vendor POSTed the URL), port 1 =
            // `timed_out` (watchdog flipped the token after expiresAt).
            // The resume merges either `waitpointValue` or
            // `waitpointTimedOut: true` into the waitpoint's prior
            // output, so this is the one signal we need to branch on.
            // Connections without an explicit sourcePort follow the
            // completed branch — same backward-compat shape as If.
            const timedOut = Boolean(nodeOutput.waitpointTimedOut);
            outgoingConnections = outgoingConnections.filter(c => {
              if (timedOut) return c.sourcePort === 1;
              return c.sourcePort === 0 || c.sourcePort === undefined;
            });
          }

          if (isLoopNode && nodeOutput) {
            const items = Array.isArray(nodeOutput.items) ? nodeOutput.items : [];

            // Split outgoing connections by port:
            //   sourcePort 0 (or undefined for legacy YAMLs)  → iteration body
            //   sourcePort 1                                  → done branch
            // The done branch fires once after the last iteration so an
            // author can wire a one-shot summary step (notify, log,
            // etc.) without it firing N times. Pre-`done`-port runbooks
            // keep working because undefined still maps to iteration.
            const iterationConnections = outgoingConnections.filter(
              c => c.sourcePort === undefined || c.sourcePort === 0
            );
            const doneConnections = outgoingConnections.filter(c => c.sourcePort === 1);

            const iterationChildNodes = iterationConnections
              .map(c => nodes.find(n => n.id === c.target))
              .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));
            const doneChildNodes = doneConnections
              .map(c => nodes.find(n => n.id === c.target))
              .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));

            // Execute iteration children once per iteration, passing
            // item context. The inner `for (const _child of …)` loop
            // is intentionally a no-op today — preserved because the
            // planned shape is per-child output injection (tracked
            // under the runner refactor, not in this scope).
            for (let i = 0; i < items.length; i++) {
              for (const _child of iterationChildNodes) {
                nodeOutputs[currentNode.id] = {
                  ...nodeOutput,
                  currentItem: items[i],
                  currentIndex: i,
                  isFirst: i === 0,
                  isLast: i === items.length - 1,
                };
              }
              // Re-run children for this iteration by temporarily clearing their executed state
              if (i < items.length - 1) {
                for (const child of iterationChildNodes) {
                  executedNodes.delete(child.id);
                }
              }
              nodesToExecute.push(...iterationChildNodes);
            }

            if (items.length === 0) {
              // No items — skip the iteration body entirely
              nodesToExecute.push(...iterationChildNodes);
            }

            // Done branch always fires once, after the iteration body
            // queue. Empty when the runbook does not wire a `done`
            // connection; the engine simply flows past the Loop.
            if (doneChildNodes.length > 0) {
              nodesToExecute.push(...doneChildNodes);
            }
          } else {
            // Normal path: push only children whose every parent has
            // finished. Multi-parent joins are unblocked by whichever
            // parent lands last — no more busy-spin re-queue.
            nodesToExecute.push(
              ...this.readyChildrenOf(currentNode.id, nodes, connections, executedNodes)
            );
          }
        } catch (error) {
          const wrappedError = wrapError(error, nodeContext);
          const nodeDuration = Date.now() - nodeStartTime;

          // Persist error to database
          await persistExecutionError(this.prisma, wrappedError, executionId, tenantId, nodeLog.id);

          // Update node log with error
          const errorMessage =
            wrappedError instanceof CustomError
              ? wrappedError.userMessage
              : error instanceof Error
                ? error.message
                : 'Unknown error';

          await this.prisma.nodeLog.update({
            where: { id: nodeLog.id },
            data: {
              status: 'FAILED',
              error: errorMessage,
              completedAt: new Date(),
              duration: nodeDuration,
            },
          });

          // Fire `onFailure` hook if the step was wired with one.
          // Same fire-and-forget contract as onSuccess; the parent
          // run continues to the error-handler runbook the operator
          // already opted into via `onErrorRunbookId`.
          void this.dispatchStepHook(
            'onFailure',
            currentNode,
            tenantId,
            (executionContext.userId as string) ?? '',
            {
              stepId: currentNode.id,
              stepType: currentNode.type,
              error: errorMessage,
              errorCode: wrappedError instanceof CustomError ? wrappedError.code : null,
            },
            executionId
          );

          socketService.emitNodeStatus(executionId, currentNode.id, 'FAILED', {
            error: errorMessage,
          });
          socketService.emitLog(executionId, `Node execution failed: ${currentNode.title}`, {
            nodeId: currentNode.id,
            error: errorMessage,
          });

          nodeContextLogger.error('Node execution failed', { error: wrappedError });

          await this.safeAudit('step.failed', {
            tenantId,
            actorId: (executionContext.userId as string | undefined) ?? null,
            actorType: 'system',
            resource: executionId,
            payload: {
              executionId,
              runbookId: runbook.id,
              nodeId: currentNode.id,
              nodeName: currentNode.title,
              nodeType: currentNode.type,
              durationMs: nodeDuration,
              errorCode: wrappedError instanceof CustomError ? wrappedError.code : null,
              errorMessage,
            },
          });

          await this.safeAppendEvent(executionId, tenantId, {
            type: 'step.failed',
            nodeId: currentNode.id,
            payload: {
              nodeName: currentNode.title,
              nodeType: currentNode.type,
              durationMs: nodeDuration,
              errorCode: wrappedError instanceof CustomError ? wrappedError.code : null,
              errorMessage,
            },
          });

          try {
            this.tracer?.endStep(executionId, currentNode.id, false, {
              message: errorMessage,
              code: wrappedError instanceof CustomError ? wrappedError.code : undefined,
            });
          } catch (err) {
            nodeContextLogger.warn('tracer.endStep (failure) failed', {
              error: err instanceof Error ? err : new Error(String(err)),
            });
          }

          // Handle retryable errors
          if (
            wrappedError.isRetryable &&
            wrappedError.context.retryCount! < (wrappedError.context.maxRetries ?? 3)
          ) {
            nodeContextLogger.warn('Retrying node execution', {
              metadata: {
                retryCount: (wrappedError.context.retryCount ?? 0) + 1,
                maxRetries: wrappedError.context.maxRetries ?? 3,
              },
            });
            // In a real scenario, you'd implement retry logic here
          }

          // Notify about error if it's high severity
          if ([ErrorSeverity.HIGH, ErrorSeverity.CRITICAL].includes(wrappedError.severity)) {
            // Tenant-scope guard requires every ExecutionError query to
            // carry an explicit tenantId — even when scoped by execution
            // it cannot infer the tenant. Without this, a high-severity
            // step failure throws a TenantScopeViolationError inside
            // Prisma's `$use` chain, which surfaces as "Runbook execution
            // failed: ExecutionError.findFirst() called without a
            // tenantId filter" and masks the real underlying step error.
            const errorRecord = await this.prisma.executionError.findFirst({
              where: {
                tenantId,
                executionId,
                nodeLogId: nodeLog.id,
                code: wrappedError.code,
              },
              orderBy: { createdAt: 'desc' },
            });

            if (errorRecord && tenantId) {
              await this.notificationService.notifyError(
                wrappedError,
                executionId,
                errorRecord.id,
                tenantId
              );
              await this.notificationService.emitErrorEvent(wrappedError, executionId);
            }
          }

          throw wrappedError;
        }
      }

      const duration = Date.now() - startTime;

      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration,
        },
      });

      // Notify any open client (run detail page, dashboard live
      // tile) that the run reached its terminal state without
      // having to poll. Mirror the existing PAUSED emit.
      socketService.emitExecutionStatus(executionId, 'SUCCESS');

      contextLogger.info('Runbook execution completed successfully', { duration });

      await this.safeAudit('run.completed', {
        tenantId,
        actorId: (executionContext.userId as string | undefined) ?? null,
        actorType: 'system',
        resource: executionId,
        payload: {
          executionId,
          runbookId: runbook.id,
          workflowName: runbook.name,
          durationMs: duration,
          nodesExecuted: executedNodes.size,
        },
      });

      await this.safeAppendEvent(executionId, tenantId, {
        type: 'run.completed',
        payload: {
          durationMs: duration,
          nodesExecuted: executedNodes.size,
        },
      });

      // Billing (P1 #12): emit run.completed to the meter.
      await this.safeMeter('run.completed', {
        tenantId,
        executionId,
        customerId: await this.resolveStripeCustomerId(tenantId),
      });

      // GitHub status check: report success to the commit.
      await this.safeGitHubStatus(executionId, tenantId, {
        success: true,
        durationMs: duration,
        workflowName: runbook.name,
      });

      try {
        this.tracer?.endRun(executionId, true);
      } catch (err) {
        contextLogger.warn('tracer.endRun (success) failed', {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const wrappedError = wrapError(error, executionContext);

      // Persist error to database
      await persistExecutionError(this.prisma, wrappedError, executionId, tenantId);

      const errorMessage =
        wrappedError instanceof CustomError
          ? wrappedError.userMessage
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: errorMessage,
          completedAt: new Date(),
          duration,
        },
      });

      socketService.emitExecutionStatus(executionId, 'FAILED');

      contextLogger.error('Runbook execution failed', {
        error: wrappedError,
        metadata: { duration },
      });

      await this.safeAudit('run.failed', {
        tenantId,
        actorId: (executionContext.userId as string | undefined) ?? null,
        actorType: 'system',
        resource: executionId,
        payload: {
          executionId,
          runbookId: runbook.id,
          workflowName: runbook.name,
          durationMs: duration,
          errorCode: wrappedError instanceof CustomError ? wrappedError.code : null,
          errorMessage,
        },
      });

      await this.safeAppendEvent(executionId, tenantId, {
        type: 'run.failed',
        payload: {
          durationMs: duration,
          errorCode: wrappedError instanceof CustomError ? wrappedError.code : null,
          errorMessage,
        },
      });

      // Billing (P1 #12): a failed run still consumed runner
      // resources, so emit a run.completed billable event
      // (safeMeter maps run.failed → run.completed at the
      // billing layer). This is a deliberate business decision
      // documented in commit message; flip if a future pricing
      // model prefers free retries.
      await this.safeMeter('run.failed', {
        tenantId,
        executionId,
        customerId: await this.resolveStripeCustomerId(tenantId),
      });

      // GitHub status check: report failure to the commit.
      await this.safeGitHubStatus(executionId, tenantId, {
        success: false,
        durationMs: duration,
        workflowName: runbook.name,
        error: errorMessage,
      });

      try {
        this.tracer?.endRun(executionId, false, {
          message: errorMessage,
          code: wrappedError instanceof CustomError ? wrappedError.code : undefined,
        });
      } catch (err) {
        contextLogger.warn('tracer.endRun (failure) failed', {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }

      // Error runbook trigger (n8n-style meta-automation): if the
      // runbook declares onErrorRunbookId, dispatch a child run of
      // that handler with the failure payload. Best-effort and
      // fully isolated — a broken handler must never break the
      // parent's FAILED transition.
      await this.dispatchErrorHandler({
        failedExecutionId: executionId,
        runbook,
        errorMessage,
        tenantId,
        userId: (executionContext.userId as string | undefined) ?? '',
        contextLogger,
      }).catch(err => {
        contextLogger.warn('dispatchErrorHandler unhandled throw', {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

      // Notify about critical errors
      if (
        wrappedError instanceof CustomError &&
        [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL].includes(wrappedError.severity)
      ) {
        // Tenant-scope guard same gotcha as above — see comment at the
        // sibling lookup further up in this file. Without `tenantId`
        // here, a runbook-level failure during the catch path would
        // throw the guard error and mask the original cause.
        const errorRecord = await this.prisma.executionError.findFirst({
          where: {
            tenantId,
            executionId,
            code: wrappedError.code,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (errorRecord && tenantId) {
          await this.notificationService.notifyError(
            wrappedError,
            executionId,
            errorRecord.id,
            tenantId
          );
          await this.notificationService.emitErrorEvent(wrappedError, executionId);
        }
      }
    }
  }

  /**
   * Validate runbook structure before execution
   */
  private validateWorkflow(nodes: WorkflowNode[], connections: WorkflowConnection[]): void {
    if (!nodes || nodes.length === 0) {
      throw new WorkflowError({
        message: 'Runbook has no nodes',
        code: ErrorCode.WORKFLOW_INVALID,
        runbookId: '',
      });
    }

    // Validate all nodes exist
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const conn of connections) {
      if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
        throw new WorkflowError({
          message: `Connection references non-existent node: ${conn.source} -> ${conn.target}`,
          code: ErrorCode.WORKFLOW_INVALID,
          runbookId: '',
        });
      }
    }

    // Check for cycles (simplified - could be enhanced with full DFS)
    this.checkForCycles(nodeIds, connections);
  }

  /**
   * Check for circular dependencies in the runbook
   */
  private checkForCycles(nodeIds: Set<string>, connections: WorkflowConnection[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const hasCycle = (nodeId: string): string[] | null => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = connections.filter(c => c.source === nodeId).map(c => c.target);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cyclePath = hasCycle(neighbor);
          if (cyclePath) return cyclePath;
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          return path.slice(cycleStart).concat(neighbor);
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return null;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        const cyclePath = hasCycle(nodeId);
        if (cyclePath) {
          throw new WorkflowError({
            message: `Runbook contains circular dependencies. Cycle detected: ${cyclePath.join(' → ')}`,
            code: ErrorCode.WORKFLOW_INVALID,
            runbookId: '',
            context: { cyclePath, cycleNodes: cyclePath },
          });
        }
      }
    }
  }

  private getNodeInput(
    nodeId: string,
    connections: WorkflowConnection[],
    nodeOutputs: Record<string, ExecutionOutput>,
    initialInput: ExecutionInput,
    runtime?: RuntimeAmbient
  ): ExecutionInput {
    const incomingConnections = connections.filter(c => c.target === nodeId);

    let input: ExecutionInput;
    if (incomingConnections.length === 0) {
      input = { ...initialInput };
    } else {
      input = {};
      for (const conn of incomingConnections) {
        if (nodeOutputs[conn.source]) {
          Object.assign(input, nodeOutputs[conn.source]);
        }
      }
    }

    // Inject the `$workflow` and `$run` ambient helpers for template
    // resolution (n8n parity). The engine knows the runbook id/name
    // and the execution id/start-time/trigger; surfacing them under
    // reserved keys lets executors that call `resolveTemplate` pick
    // them up via the same nested-path mechanic without a signature
    // change. `$now` is implemented inside `resolveTemplate` itself
    // so it stays current per-template-call rather than per-node.
    if (runtime) {
      if (runtime.workflow) {
        (input as Record<string, unknown>).$workflow = { ...runtime.workflow };
      }
      if (runtime.run) {
        (input as Record<string, unknown>).$run = { ...runtime.run };
      }
    }

    return input;
  }
}

/**
 * Per-execution helpers injected into every node's input under
 * reserved `$workflow` / `$run` keys so `resolveTemplate` can pick
 * them up via the existing nested-path mechanic. See `_shared.ts`
 * for the user-facing template syntax.
 */
interface RuntimeAmbient {
  workflow?: { id: string; name: string; slug?: string };
  run?: { id: string; startedAt: string; trigger?: string };
}
