import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';

import { AuditService } from '../audit/audit.service';
import { ErrorCode, NodeExecutionError } from '../errors/custom-error';
import { createExecutorRegistry } from '../runbook/executors';
import { EditorExecutorAdapter } from '../runbook/executors/_editor-adapter';
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
   * Unified registry: every node type the engine can run, native
   * (StepExecutor) or wrapped legacy (EditorExecutorAdapter), keyed by
   * canonical type and by every alias. The dispatcher does one
   * `Map.get()`; pre-pivot the same call had to try a runbook map and
   * fall through to an editor map.
   *
   * Built once in the constructor; immutable thereafter.
   */
  private registry: Map<string, StepExecutor>;
  /**
   * The native runbook half of the registry. Kept around as a separate
   * reference because `ShellCommandNodeExecutor` looks up the runbook
   * `shell` executor lazily through a getter — the editor registry it
   * lives in needs to read the runbook registry at call time, not
   * registration time.
   */
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
    this.registry = this.buildUnifiedRegistry();
  }

  /**
   * Build the unified registry. Native runbook executors land first;
   * each legacy editor executor is then wrapped in
   * `EditorExecutorAdapter` and registered under its canonical type
   * and every alias. Native registrations win on collision so node
   * types like `operari.httpRequest` (in the runbook registry as
   * `HttpExecutor`, in the editor registry as an alias of
   * `HttpNodeExecutor`) consistently route to the canonical
   * implementation.
   *
   * Throws on duplicate registration WITHIN the editor side so a
   * copy/paste bug surfaces immediately. Cross-half collisions are
   * silent because the precedence rule is documented and intended.
   */
  private buildUnifiedRegistry(): Map<string, StepExecutor> {
    const registry = new Map<string, StepExecutor>(this.runbookRegistry);
    const editorTypesSeen = new Set<string>();

    const register = (executor: AnyEditorExecutor) => {
      const wrapped = new EditorExecutorAdapter(executor);
      const types = [executor.type, ...(executor.aliases ?? [])];
      for (const t of types) {
        if (editorTypesSeen.has(t)) {
          throw new Error(
            `Duplicate editor node type registration: ${t} (already mapped to ${executor.type})`
          );
        }
        editorTypesSeen.add(t);
        // Native runbook executors win on cross-half collision — for
        // example, `operari.httpRequest` is owned by the runbook
        // HttpExecutor; the editor HttpNodeExecutor's alias for the
        // same type is silently shadowed.
        if (registry.has(t)) continue;
        registry.set(t, wrapped);
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
    // the registry.
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

    const executor = this.registry.get(node.type);
    if (!executor) {
      throw new NodeExecutionError({
        ...commonErrorContext,
        message: `Unknown node type: ${node.type}`,
        code: ErrorCode.NODE_NOT_FOUND,
        userMessage: `Node type '${node.type}' is not recognized or supported.`,
      });
    }

    const stepId = node.id;
    const runId = executionId ?? 'unknown';
    const isEditorWrapped = executor instanceof EditorExecutorAdapter;
    // Native runbook executors get a 'default-tenant' fallback so
    // editor "test this step" previews (which run without an
    // authenticated request context) don't blow up on the
    // ExecutorContext.tenantId requirement. Editor-wrapped executors
    // get an empty-string fallback instead — state nodes like
    // StoreSet check `if (!tenantId)` and throw CONFIGURATION_ERROR;
    // a real-looking sentinel here would silently let them write to
    // a fake tenant. The pre-consolidation dispatcher achieved this
    // by passing two different effective tenantIds down the two
    // branches; we preserve that semantics in the single branch.
    const effectiveTenantId = isEditorWrapped ? (tenantId ?? '') : (tenantId ?? 'default-tenant');
    const config = node.config ?? {};

    // Pre-resolve `{{secrets.<id>}}` references for native runbook
    // executors only. Editor executors (wrapped in
    // EditorExecutorAdapter) use a flat ExecutionInput dict and never
    // had secret resolution wired in — running the resolver for them
    // would emit `secret.accessed` audit events for refs that the
    // editor template engine then resolves to the empty string, which
    // is a lie about what was actually read.
    let secrets: Record<string, string> | undefined;
    if (!isEditorWrapped) {
      const refs = SecretTemplateResolver.extractRefs(config);
      if (refs.length > 0) {
        const resolver = this.getSecretResolver();
        if (!resolver) {
          throw new NodeExecutionError({
            ...commonErrorContext,
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
              ...commonErrorContext,
              message: err.message,
              code: ErrorCode.NODE_EXECUTION_FAILED,
            });
          }
          throw err;
        }
      }
    }

    const context: ExecutorContext = {
      runId,
      stepId,
      variables: (input as Record<string, unknown>) ?? {},
      previousOutputs: (input as Record<string, unknown>) ?? {},
      tenantId: effectiveTenantId,
      secrets,
      dryRun: dryRun ?? false,
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

    const result = await executor.execute(config, context);

    if (!result.success) {
      throw new NodeExecutionError({
        ...commonErrorContext,
        message: result.error ?? 'Step failed',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    // NodeExecutionResult is a generic shape; the executor output
    // (typed by the editor side, uniform on the runbook side) is
    // handed back to the engine unchanged.
    return (result.output ?? { success: true }) as unknown as NodeExecutionResult;
  }

  private resolveTemplate(template: string, context: ExecutionInput): string {
    return sharedResolveTemplate(template, context);
  }

  private getNestedValue(obj: ExecutionInput, path: string): unknown {
    return sharedGetNestedValue(obj, path);
  }
}
