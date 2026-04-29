import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';

import { AuditService } from '../audit/audit.service';
import { ErrorCode, NodeExecutionError } from '../errors/custom-error';
import { createExecutorRegistry } from '../runbook/executors';
import {
  SecretReferenceError,
  SecretTemplateResolver,
} from '../runbook/secrets/secret-template-resolver';
import type { ExecutorContext, StepExecutor } from '../runbook/types/executor.types';
import { ConnectedAccountService } from '../security/connected-account.service';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { Logger } from '../services/logger.service';
import type { ExecutionInput } from '../types/runbook.types';
import { NodeExecutionResult, WorkflowNode } from '../types/runbook.types';
import { socketService } from './execution/socket.service';
import { JoinNodeExecutor } from './logic/join-node.executor';
import { MultiplexNodeExecutor } from './logic/multiplex-node.executor';
import { RepeatNodeExecutor } from './logic/repeat-node.executor';
import { SplitNodeExecutor } from './logic/split-node.executor';
import type { EditorNodeExecutor } from './nodes/_shared';
import {
  getNestedValue as sharedGetNestedValue,
  resolveTemplate as sharedResolveTemplate,
} from './nodes/_shared';
import { ConditionNodeExecutor } from './nodes/condition.executor';
import { DatabaseNodeExecutor } from './nodes/database.executor';
import { DelayNodeExecutor } from './nodes/delay.executor';
import { EmailNodeExecutor } from './nodes/email.executor';
import { FrameNodeExecutor } from './nodes/frame.executor';
import { HttpNodeExecutor } from './nodes/http.executor';
import { LoopNodeExecutor } from './nodes/loop.executor';
import { NoteNodeExecutor } from './nodes/note.executor';
import { SetMetadataNodeExecutor } from './nodes/set-metadata.executor';
import { ShellCommandNodeExecutor } from './nodes/shell-command.executor';
import { StoreGetNodeExecutor } from './nodes/store-get.executor';
import { StoreSetNodeExecutor } from './nodes/store-set.executor';
import { SuspendNodeExecutor } from './nodes/suspend.executor';
import { SwitchNodeExecutor } from './nodes/switch.executor';
import { TransformNodeExecutor } from './nodes/transform.executor';
import { TriggerNodeExecutor } from './nodes/trigger.executor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditorExecutor = EditorNodeExecutor<any, any>;

export class NodeExecutor {
  private emailTransporter: nodemailer.Transporter | null = null;
  private prisma: PrismaClient;
  private logger: Logger;
  /**
   * Single registry of every editor node type, keyed by canonical type
   * AND by every alias declared on the executor. The dispatcher does
   * one Map.get() instead of a 27-case switch.
   *
   * Built once in the constructor; immutable thereafter.
   */
  private editorRegistry: Map<string, AnyEditorExecutor>;
  // Operari: registry of runbook executors (shell, approval, notify, wait).
  // Kept separate from editorRegistry because the runbook executors use a
  // different context shape; step 6 of ADR 0002 will merge the two.
  private runbookRegistry: Map<string, StepExecutor>;
  /**
   * Pre-resolves `{{secrets.<id>}}` references before each runbook
   * step runs. Lazily built the first time a step config actually
   * references a secret — that way `new NodeExecutor()` in tests with
   * no encryption key still works as long as no test wires up a step
   * that uses `secrets.*`.
   *
   * `null` = not yet built. `undefined` after build = no resolver
   * could be constructed (no encryption key in env); subsequent
   * lookups will throw a clear error instead of trying again every
   * call.
   */
  private secretResolver: SecretTemplateResolver | null | undefined = null;
  private readonly secretResolverOverride: SecretTemplateResolver | null;

  constructor(
    prisma?: PrismaClient,
    options: { secretResolver?: SecretTemplateResolver | null } = {}
  ) {
    this.prisma = prisma || new PrismaClient();
    this.logger = Logger.getInstance();
    this.secretResolverOverride = options.secretResolver ?? null;

    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    this.runbookRegistry = createExecutorRegistry(this.prisma);
    this.editorRegistry = this.buildEditorRegistry();
  }

  /**
   * Build the editor node registry. Each executor is registered under
   * its canonical type and under every alias it declares. Throws on
   * duplicate registration so a copy/paste bug surfaces immediately
   * instead of silently routing one node type to the wrong executor.
   */
  private buildEditorRegistry(): Map<string, AnyEditorExecutor> {
    const registry = new Map<string, AnyEditorExecutor>();
    const register = (executor: AnyEditorExecutor) => {
      const types = [executor.type, ...(executor.aliases ?? [])];
      for (const t of types) {
        if (registry.has(t)) {
          throw new Error(
            `Duplicate editor node type registration: ${t} (already mapped to ${registry.get(t)!.type})`
          );
        }
        registry.set(t, executor);
      }
    };

    const editorNodeDeps = { logger: this.logger };

    // Pure-logic nodes
    register(new DelayNodeExecutor());
    register(new TransformNodeExecutor(editorNodeDeps));
    register(new ConditionNodeExecutor());
    register(new SwitchNodeExecutor());
    register(new NoteNodeExecutor());
    register(new FrameNodeExecutor());

    // IO nodes
    register(new HttpNodeExecutor({ logger: this.logger }));
    register(
      new EmailNodeExecutor({
        logger: this.logger,
        getEmailTransporter: () => this.emailTransporter,
      })
    );
    register(new DatabaseNodeExecutor());

    // State nodes
    register(new TriggerNodeExecutor());
    register(new LoopNodeExecutor());
    register(new SuspendNodeExecutor());
    register(new StoreSetNodeExecutor(this.prisma));
    register(new StoreGetNodeExecutor(this.prisma));
    register(new SetMetadataNodeExecutor(this.prisma));

    // Shell command — adapter that delegates to the runbook ShellExecutor
    // through `this.runbookRegistry.get('shell')`. Looking it up via a
    // getter means tests can swap the runbook executor without rebuilding
    // the editor registry.
    register(
      new ShellCommandNodeExecutor({ logger: this.logger }, () => this.runbookRegistry.get('shell'))
    );

    // Multi-target / fan-out logic nodes
    register(new SplitNodeExecutor());
    register(new JoinNodeExecutor());
    register(new RepeatNodeExecutor());
    register(new MultiplexNodeExecutor());

    return registry;
  }

  /**
   * Lazily build the SecretTemplateResolver. We do not construct it
   * eagerly because tests instantiate `new NodeExecutor()` without an
   * encryption key; the resolver is only required when a step config
   * actually contains a `{{secrets.<id>}}` reference.
   *
   * Returns `undefined` if no encryption key is configured. Callers
   * decide what to do — usually throw a clear error mentioning the
   * missing env var.
   */
  private getSecretResolver(): SecretTemplateResolver | undefined {
    if (this.secretResolverOverride) return this.secretResolverOverride;
    if (this.secretResolver !== null) return this.secretResolver ?? undefined;

    // Read process.env directly instead of importing the strict
    // zod-validated `env` object: that module calls process.exit(1)
    // when DATABASE_URL/JWT_SECRET are missing, which breaks unit
    // tests that legitimately construct NodeExecutor without a real
    // env (the dispatcher tests, for one).
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      this.secretResolver = undefined;
      return undefined;
    }
    const cipher = new SecretCipher(key);
    const audit = new AuditService(this.prisma);
    const reader = new SecretReader(cipher, audit);
    const accounts = new ConnectedAccountService(this.prisma, cipher, reader, audit);
    this.secretResolver = new SecretTemplateResolver(accounts);
    return this.secretResolver;
  }

  /**
   * Operari: try to execute the node using the new runbook executor registry.
   * Returns null if the node type is not registered (caller should fall through
   * to the legacy switch statement).
   */
  private async tryRunbookExecutor(
    node: WorkflowNode,
    input: ExecutionInput,
    tenantId: string | undefined,
    executionId: string | undefined,
    dryRun: boolean = false
  ): Promise<NodeExecutionResult | null> {
    const executor = this.runbookRegistry.get(node.type);
    if (!executor) return null;

    const stepId = node.id;
    const runId = executionId ?? 'unknown';
    // The 'default-tenant' fallback is only reached on editor
    // test-this-step previews where the dispatcher is invoked
    // without an authenticated request context. Real executions
    // always pass the runtime tenantId derived from the workflow
    // row that was loaded with multi-tenant scoping in
    // ExecutionService.execute().
    const effectiveTenantId = tenantId ?? 'default-tenant';
    const config = node.config ?? {};

    // Pre-resolve `{{secrets.<id>}}` references before the executor
    // runs. Done here (not inside resolveTemplate) so the template
    // engine stays sync, audit fires once per unique secret, and
    // missing/cross-tenant references fail fast with a clear error
    // before the executor opens a socket.
    let secrets: Record<string, string> | undefined;
    const refs = SecretTemplateResolver.extractRefs(config);
    if (refs.length > 0) {
      const resolver = this.getSecretResolver();
      if (!resolver) {
        throw new NodeExecutionError({
          nodeId: node.id,
          nodeName: node.title,
          nodeType: node.type,
          message:
            `Step references {{secrets.${refs[0]}}} but ENCRYPTION_KEY is not set. ` +
            `Configure ENCRYPTION_KEY in the backend env (32+ chars) to enable runtime secret resolution.`,
          code: ErrorCode.NODE_EXECUTION_FAILED,
        });
      }
      try {
        secrets = await resolver.resolve({
          config,
          tenantId: effectiveTenantId,
          runId,
          stepId,
        });
      } catch (err) {
        if (err instanceof SecretReferenceError) {
          throw new NodeExecutionError({
            nodeId: node.id,
            nodeName: node.title,
            nodeType: node.type,
            message: err.message,
            code: ErrorCode.NODE_EXECUTION_FAILED,
          });
        }
        throw err;
      }
    }

    const context: ExecutorContext = {
      runId,
      stepId,
      variables: (input as Record<string, unknown>) ?? {},
      previousOutputs: (input as Record<string, unknown>) ?? {},
      tenantId: effectiveTenantId,
      secrets,
      dryRun,
      emit: executionId
        ? event => {
            socketService.emitLog(executionId, event.text.trimEnd(), {
              nodeId: node.id,
              nodeType: node.type,
              stream: event.type,
            });
          }
        : undefined,
    };

    const result = await executor.execute(node.config ?? {}, context);

    if (!result.success) {
      throw new NodeExecutionError({
        nodeId: node.id,
        nodeName: node.title,
        nodeType: node.type,
        message: result.error ?? 'Step failed',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    // NodeExecutionResult is a generic shape; we wrap the executor output in it
    return (result.output ?? { success: true }) as unknown as NodeExecutionResult;
  }

  async execute(
    node: WorkflowNode,
    input: ExecutionInput,
    tenantId?: string,
    executionId?: string,
    dryRun?: boolean
  ): Promise<NodeExecutionResult> {
    const commonErrorContext = {
      nodeId: node.id,
      nodeName: node.title,
      nodeType: node.type,
    };

    // 1. Runbook executors (shell/approval/notify/wait) take precedence
    //    so the runbook engine can intercept node types it owns.
    const runbookResult = await this.tryRunbookExecutor(
      node,
      input,
      tenantId,
      executionId,
      dryRun ?? false
    );
    if (runbookResult !== null) {
      return runbookResult;
    }

    // 2. Editor registry — single Map.get instead of a 27-case switch.
    const editorExecutor = this.editorRegistry.get(node.type);
    if (editorExecutor) {
      return editorExecutor.execute(
        node.config ?? {},
        input,
        commonErrorContext,
        tenantId,
        executionId
      );
    }

    // 3. Unknown node type — fail loud.
    throw new NodeExecutionError({
      ...commonErrorContext,
      message: `Unknown node type: ${node.type}`,
      code: ErrorCode.NODE_NOT_FOUND,
      userMessage: `Node type '${node.type}' is not recognized or supported.`,
    });
  }

  private resolveTemplate(template: string, context: ExecutionInput): string {
    return sharedResolveTemplate(template, context);
  }

  private getNestedValue(obj: ExecutionInput, path: string): unknown {
    return sharedGetNestedValue(obj, path);
  }
}
