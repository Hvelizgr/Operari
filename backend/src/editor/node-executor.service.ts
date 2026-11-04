import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';

import { AuditService } from '../audit/audit.service';
import { ErrorCode, NodeExecutionError } from '../errors/custom-error';
import { createExecutorRegistry } from '../runbook/executors';
import { isFlatInputStep } from '../runbook/executors/core';
import {
  getNestedValue as sharedGetNestedValue,
  resolveTemplate as sharedResolveTemplate,
} from '../runbook/executors/core/_shared';
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

export class NodeExecutor {
  private emailTransporter: nodemailer.Transporter | null = null;
  private prisma: PrismaClient;
  private logger: Logger;
  /**
   * Every step type the engine can run, keyed by type and alias (and by
   * `${tenantId}::${type}` for tenant plugins). Built once.
   */
  private registry: Map<string, StepExecutor>;
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

    this.registry = createExecutorRegistry(this.prisma, {
      getEmailTransporter: () => this.emailTransporter,
    });
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
    dryRun?: boolean,
    /** Run inputs and every finished step's output, for `{{vars.*}}` and
     * `{{steps.<id>.output.*}}`. Without it a step only sees its parents'
     * merged output, so run inputs vanished after the first step. */
    scope?: { vars: ExecutionInput; steps: Record<string, { output: unknown }> }
  ): Promise<NodeExecutionResult> {
    const commonErrorContext = {
      nodeId: node.id,
      nodeName: node.title,
      nodeType: node.type,
    };

    // Tenant-scoped plugin lookup (ADR 0006). The registry stores
    // tenant-scoped executors under a composite `${tenantId}::${type}`
    // key, globals under just `${type}`. Try the tenant-scoped key
    // first so a tenant's own plugin shadows any global with the
    // same type name; fall back to the global registration so
    // built-ins (`shell`, `operari.httpRequest`, etc.) and shared
    // plugins resolve identically for every tenant.
    const tenantKey = tenantId ? `${tenantId}::${node.type}` : null;
    const executor =
      (tenantKey ? this.registry.get(tenantKey) : undefined) ?? this.registry.get(node.type);

    if (!executor) {
      throw new NodeExecutionError({
        ...commonErrorContext,
        message: `Unknown node type: ${node.type}`,
        code: ErrorCode.NODE_NOT_FOUND,
        userMessage: `Node type '${node.type}' is not recognized or supported.`,
      });
    }

    // Defense in depth: even if the lookup landed on an executor
    // with a tenantId, sanity-check it matches. A failure here
    // means the registry was built with a key/value mismatch —
    // probably a regression in createExecutorRegistry, not user
    // input. Globals (executor.tenantId === undefined) skip the
    // check entirely.
    if (executor.tenantId !== undefined && executor.tenantId !== tenantId) {
      throw new NodeExecutionError({
        ...commonErrorContext,
        message: `Cross-tenant plugin invocation rejected: type=${node.type} pluginTenant=${executor.tenantId} runTenant=${tenantId ?? 'none'}`,
        code: ErrorCode.NODE_NOT_FOUND,
        userMessage: `Step type '${node.type}' is not available for this workspace.`,
      });
    }

    const stepId = node.id;
    const runId = executionId ?? 'unknown';
    const isEditorWrapped = isFlatInputStep(executor);
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
    // FlatInputStep) use a flat ExecutionInput dict and never
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

    const flatInput = (input as Record<string, unknown>) ?? {};
    const context: ExecutorContext = {
      runId,
      stepId,
      variables: scope ? (scope.vars as Record<string, unknown>) : flatInput,
      // Native executors resolve `steps.<id>` against the top level; the
      // legacy editor resolver walks plain paths, so it needs the
      // `vars` / `steps` keys themselves.
      previousOutputs: scope
        ? { ...scope.steps, ...flatInput, vars: scope.vars, steps: scope.steps }
        : flatInput,
      input: flatInput,
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
