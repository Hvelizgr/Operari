import {
  ExecutionStatus,
  NodeLogStatus,
  Prisma,
  PrismaClient,
  Runbook,
  TriggerType,
} from '@prisma/client';

import { ActorType, AuditEventType, AuditService } from '../../audit/audit.service';
import type { BillingMeter } from '../../billing';
import { getBillingMeter } from '../../billing';
import { assertRunsQuota, QuotaExceededError } from '../../billing/quotas';
import {
  CustomError,
  ErrorCode,
  ErrorSeverity,
  NodeExecutionError,
  WorkflowError,
  wrapError,
} from '../../errors/custom-error';
import { getRunTracer, RunTracer } from '../../observability';
import { ExecutionEventStore } from '../../runbook/engine/execution-event.store';
import type { ExecutionEventPayload } from '../../runbook/engine/execution-event.types';
import { getRunner } from '../../runbook/runners';
import { GitHubStatusService } from '../../runbook/services/github-status.service';
import { ErrorNotificationService } from '../../services/error-notification.service';
import { ContextLogger, Logger } from '../../services/logger.service';
import {
  ExecutionInput,
  ExecutionOutput,
  SuspendResult,
  WorkflowConnection,
  WorkflowNode,
} from '../../types/workflow.types';
import { persistExecutionError } from '../../utils/error-persistence';
import { NodeExecutor } from '../node-executor.service';
import { socketService } from './socket.service';

interface ExecuteParams {
  workflowId: string;
  userId: string;
  trigger: TriggerType;
  input?: ExecutionInput;
  tenantId?: string;
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
   * (or when `NANORUN_DURABLE_ENGINE=true`) every state transition
   * is appended to the ExecutionEvent log alongside the audit chain
   * write, so a worker can resume in-flight runs after a restart.
   *
   * Pass `null` to disable event-store writes explicitly, even if
   * the env flag is set. Pass an instance to override the default
   * (used by tests to capture events with a fake store).
   *
   * Defaults: enabled iff `process.env.NANORUN_DURABLE_ENGINE === 'true'`.
   * The flag exists because phase 2 is the integration step the ADR
   * warns about — toggling it off must be a single env var flip.
   */
  eventStore?: ExecutionEventStore | null;
  /**
   * Billing meter (P1 #12). Self-host deployments get NoopBillingMeter
   * by default, which discards every event. Cloud deployments get
   * StripeBillingMeter via NANORUN_BILLING_PROVIDER=stripe and the
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
          (process.env.NANORUN_DURABLE_ENGINE === 'true' ? new ExecutionEventStore(prisma) : null));
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
    workflow: Runbook;
    errorMessage: string;
    tenantId: string | undefined;
    userId: string;
    // Accept the shape of the ContextLogger without importing it
    // (avoids dragging the Logger type system into this helper).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contextLogger: { info: (...args: any[]) => void; warn: (...args: any[]) => void };
  }): Promise<void> {
    const { failedExecutionId, workflow, errorMessage, tenantId, userId, contextLogger } = params;

    const handlerId = (workflow as Runbook & { onErrorRunbookId?: string | null }).onErrorRunbookId;
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

    const effectiveTenantId = tenantId ?? workflow.tenantId;
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
        workflowId: target.id,
        userId,
        tenantId: effectiveTenantId,
        trigger: 'ERROR',
        parentExecutionId: failedExecutionId,
        input: {
          error: {
            runId: failedExecutionId,
            runbookId: workflow.id,
            runbookName: workflow.name,
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
   * handler's workflowId appears anywhere in the chain we refuse the
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
      const row: { workflowId: string; parentExecutionId: string | null } | null =
        await this.prisma.execution.findUnique({
          where: { id: cursor },
          select: { workflowId: true, parentExecutionId: true },
        });
      if (!row) break;
      if (row.workflowId === targetWorkflowId) {
        return `target handler "${targetWorkflowId}" is already in the run chain`;
      }
      cursor = row.parentExecutionId;
      depth += 1;
    }
    return null;
  }

  async execute(params: ExecuteParams) {
    const {
      workflowId,
      userId,
      trigger,
      input = {},
      tenantId,
      startNodeId,
      parentExecutionId,
      dryRun,
    } = params;

    try {
      // Fetch workflow
      const workflow = await this.prisma.runbook.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        throw new WorkflowError({
          message: `Runbook not found: ${workflowId}`,
          code: ErrorCode.WORKFLOW_NOT_FOUND,
          workflowId,
          context: { userId, tenantId },
        });
      }

      // Runs-per-month quota gate. Enforced BEFORE we insert the
      // Execution row — if the tenant is at their plan cap we do
      // not want a half-committed run record that the UI shows
      // as "starting then immediately blocked". ERROR-triggered
      // sub-runs still count; they're real platform work.
      const effectiveTenantIdForQuota = tenantId ?? workflow.tenantId;
      try {
        await assertRunsQuota(this.prisma, effectiveTenantIdForQuota);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          throw new WorkflowError({
            message: err.message,
            code: ErrorCode.QUOTA_EXCEEDED,
            workflowId,
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

      // Create execution record
      const execution = await this.prisma.execution.create({
        data: {
          workflowId,
          userId,
          trigger,
          status: 'RUNNING',
          parentExecutionId,
        },
      });

      // Create context logger for this execution
      const executionContext = {
        executionId: execution.id,
        workflowId,
        workflowName: workflow.name,
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
          workflowId,
          workflowName: workflow.name,
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
          workflowId,
          workflowName: workflow.name,
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
      const effectiveTenantId = tenantId ?? workflow.tenantId ?? 'default-tenant';
      try {
        this.tracer?.startRun({
          runId: execution.id,
          runbookId: workflow.id,
          runbookName: workflow.name,
          tenantId: effectiveTenantId,
          trigger: String(trigger),
          runnerType: this.safeRunnerType(),
        });
      } catch (err) {
        this.logger.warn('tracer.startRun failed', {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }

      // Run workflow asynchronously with proper error handling
      this.runWorkflow(
        execution.id,
        workflow,
        input,
        executionContext,
        tenantId,
        startNodeId,
        undefined,
        dryRun ?? false
      ).catch(error => {
        // This handles uncaught errors from runWorkflow
        this.logger.error('Uncaught error in workflow execution', {
          context: executionContext,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

      return execution;
    } catch (error) {
      const wrappedError = wrapError(error, { workflowId, userId, tenantId });
      this.logger.error('Failed to initialize workflow execution', {
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
        workflow: true,
        nodeLogs: true,
      },
    });

    if (!originalExecution) {
      throw new WorkflowError({
        message: `Original execution not found: ${executionId}`,
        code: ErrorCode.EXECUTION_NOT_FOUND,
        workflowId: '',
      });
    }

    // Create a new execution for the replay
    const newExecution = await this.prisma.execution.create({
      data: {
        workflowId: originalExecution.workflowId,
        userId,
        trigger: originalExecution.trigger,
        status: 'RUNNING',
      },
    });

    const executionContext = {
      executionId: newExecution.id,
      workflowId: originalExecution.workflowId,
      workflowName: originalExecution.workflow.name,
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
        originalExecution.workflow,
        log.input as any,
        executionContext,
        tenantId,
        nodeId
      ).catch(err => {
        this.logger.error('Error in replayed workflow', { context: executionContext, error: err });
      });
    } else {
      this.runWorkflow(
        newExecution.id,
        originalExecution.workflow,
        {}, // Start from the beginning
        executionContext,
        tenantId
      ).catch(err => {
        this.logger.error('Error in replayed workflow', { context: executionContext, error: err });
      });
    }

    return newExecution;
  }

  async resumeExecution(params: ResumeParams) {
    const { executionId, userId, tenantId, input = {} } = params;

    const execution = await this.prisma.execution.findFirst({
      where: {
        id: executionId,
        workflow: { tenantId },
        status: 'PAUSED',
      },
      include: { workflow: true },
    });

    if (!execution || !execution.workflow) {
      throw new WorkflowError({
        message: `Paused execution not found: ${executionId}`,
        code: ErrorCode.EXECUTION_NOT_FOUND,
        workflowId: '',
      });
    }

    const contextLogger = this.logger.child({
      executionId,
      workflowId: execution.workflowId,
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
        workflowId: execution.workflowId,
      },
    });

    await this.safeAppendEvent(executionId, tenantId, {
      type: 'run.resumed',
      payload: { actorId: userId },
    });

    const resumeState = execution.resumeState as any;
    const allNodes = execution.workflow.nodes as unknown as WorkflowNode[];

    // Restore state
    const initialState: RunState = {
      nodeOutputs: resumeState.nodeOutputs || {},
      executedNodes: new Set(resumeState.executedNodes || []),
      nodesToExecute: (resumeState.nodesToExecute || [])
        .map((nodeId: string) => allNodes.find((n: WorkflowNode) => n.id === nodeId))
        .filter((n: WorkflowNode | undefined): n is WorkflowNode => !!n),
    };

    // Merge new input with the output of the node that paused the execution
    const lastExecutedNodeId = Array.from(initialState.executedNodes).pop();
    if (lastExecutedNodeId && initialState.nodeOutputs[lastExecutedNodeId]) {
      Object.assign(initialState.nodeOutputs[lastExecutedNodeId], input);
    }

    this.runWorkflow(
      execution.id,
      execution.workflow,
      {}, // Original input is already baked into the state
      { executionId, workflowId: execution.workflowId, userId, tenantId },
      tenantId,
      undefined,
      initialState
    ).catch(error => {
      this.logger.error('Uncaught error in resumed workflow execution', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    return execution;
  }

  private async runWorkflow(
    executionId: string,
    workflow: Runbook,
    input: ExecutionInput,
    executionContext: Record<string, unknown>,
    tenantId?: string,
    startNodeId?: string,
    initialState?: RunState,
    dryRun: boolean = false
  ) {
    const startTime = Date.now();
    const contextLogger = this.logger.child(executionContext);

    // Cast Prisma JSON fields to typed arrays
    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const connections = workflow.connections as unknown as WorkflowConnection[];

    try {
      // Validate workflow before execution
      if (!initialState) {
        // Only validate on first run, not on resume
        this.validateWorkflow(nodes, connections);
      }

      const nodeOutputs = initialState?.nodeOutputs || {};
      const executedNodes = initialState?.executedNodes
        ? new Set(initialState.executedNodes)
        : new Set<string>();

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

              nodeId: currentNode.id,

              nodeName: currentNode.title,

              nodeType: currentNode.type,

              status: 'SKIPPED',

              input: {} as any,
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
              workflowId: workflow.id,
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

          // Add children of the skipped node to the execution queue

          const nextNodes = connections

            .filter(c => c.source === currentNode.id)

            .map(c => nodes.find(n => n.id === c.target))

            .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));

          nodesToExecute.push(...nextNodes);

          continue;
        }

        // Check if all parents have been executed (Synchronization logic for Join/Advanced nodes)

        const incomingConns = connections.filter(c => c.target === currentNode.id);
        const allParentsExecuted = incomingConns.every(c => executedNodes.has(c.source));

        if (incomingConns.length > 1 && !allParentsExecuted) {
          // If the node has multiple inputs and not all are ready, we skip it for now.
          // It will be re-queued when other parent nodes finish.
          continue;
        }

        const nodeInput = this.getNodeInput(currentNode.id, connections, nodeOutputs, input);

        const nodeLog = await this.prisma.nodeLog.create({
          data: {
            executionId,
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
                } as any,
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
                workflowId: workflow.id,
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
              workflowId: workflow.id,
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
            currentNode.type === 'nanorun.if';
          const isSwitchNode =
            currentNode.type === 'Switch' || currentNode.type === 'nanorun.switch';
          const isLoopNode =
            currentNode.type === 'Loop' ||
            currentNode.type === 'Iterator' ||
            currentNode.type === 'nanorun.loop';

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
          }

          if (isLoopNode && nodeOutput) {
            const items = Array.isArray(nodeOutput.items) ? nodeOutput.items : [];
            const childNodes = outgoingConnections
              .map(c => nodes.find(n => n.id === c.target))
              .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));

            // Execute children once per iteration, passing item context
            for (let i = 0; i < items.length; i++) {
              for (const child of childNodes) {
                // Inject loop iteration variables into the node's input
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
                for (const child of childNodes) {
                  executedNodes.delete(child.id);
                }
              }
              nodesToExecute.push(...childNodes);
            }

            if (items.length === 0) {
              // No items — skip children entirely
              nodesToExecute.push(...childNodes);
            }
          } else {
            const nextNodes = outgoingConnections
              .map(c => nodes.find(n => n.id === c.target))
              .filter((n): n is WorkflowNode => n !== undefined && !executedNodes.has(n.id));

            nodesToExecute.push(...nextNodes);
          }
        } catch (error) {
          const wrappedError = wrapError(error, nodeContext);
          const nodeDuration = Date.now() - nodeStartTime;

          // Persist error to database
          await persistExecutionError(this.prisma, wrappedError, executionId, nodeLog.id);

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
              workflowId: workflow.id,
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
            const errorRecord = await this.prisma.executionError.findFirst({
              where: {
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
          workflowId: workflow.id,
          workflowName: workflow.name,
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
        workflowName: workflow.name,
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
      await persistExecutionError(this.prisma, wrappedError, executionId);

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
          workflowId: workflow.id,
          workflowName: workflow.name,
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
        workflowName: workflow.name,
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

      // Error workflow trigger (n8n-style meta-automation): if the
      // runbook declares onErrorRunbookId, dispatch a child run of
      // that handler with the failure payload. Best-effort and
      // fully isolated — a broken handler must never break the
      // parent's FAILED transition.
      await this.dispatchErrorHandler({
        failedExecutionId: executionId,
        workflow,
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
        const errorRecord = await this.prisma.executionError.findFirst({
          where: {
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
   * Validate workflow structure before execution
   */
  private validateWorkflow(nodes: WorkflowNode[], connections: WorkflowConnection[]): void {
    if (!nodes || nodes.length === 0) {
      throw new WorkflowError({
        message: 'Runbook has no nodes',
        code: ErrorCode.WORKFLOW_INVALID,
        workflowId: '',
      });
    }

    // Validate all nodes exist
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const conn of connections) {
      if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
        throw new WorkflowError({
          message: `Connection references non-existent node: ${conn.source} -> ${conn.target}`,
          code: ErrorCode.WORKFLOW_INVALID,
          workflowId: '',
        });
      }
    }

    // Check for cycles (simplified - could be enhanced with full DFS)
    this.checkForCycles(nodeIds, connections);
  }

  /**
   * Check for circular dependencies in the workflow
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
            workflowId: '',
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
    initialInput: ExecutionInput
  ): ExecutionInput {
    const incomingConnections = connections.filter(c => c.target === nodeId);

    if (incomingConnections.length === 0) {
      return initialInput;
    }

    const input: ExecutionInput = {};

    for (const conn of incomingConnections) {
      if (nodeOutputs[conn.source]) {
        Object.assign(input, nodeOutputs[conn.source]);
      }
    }

    return input;
  }
}
