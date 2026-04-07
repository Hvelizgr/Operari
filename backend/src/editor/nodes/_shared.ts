/**
 * Shared helpers for editor node executors.
 *
 * This file is the first step of the decomposition described in
 * `docs/adr/0002-node-executor-decomposition.md`. It exists so that
 * subsequent steps can pull individual node types out of
 * `node-executor.service.ts` without each one duplicating template
 * resolution and the common error context shape.
 *
 * Anything added here MUST be a pure function or a plain type — no DB,
 * no logger, no IO. Stateful collaborators belong in `NodeExecutorDeps`
 * (introduced in step 2).
 */

import type { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';
import type { Logger } from '../../services/logger.service';

/**
 * The minimal identification block that every NodeExecutionError carries.
 * Spread into the error constructor with `...commonErrorContext` to keep
 * call sites short and consistent.
 */
export interface NodeErrorContext {
    nodeId: string;
    nodeName: string;
    nodeType: string;
}

/**
 * Resolve `{{path.to.value}}` placeholders against the execution input.
 *
 * Non-string templates are coerced via `String(...)`. Missing paths
 * resolve to the empty string — this matches the behavior the editor
 * shipped with and we deliberately do NOT throw, so a typo in a template
 * surfaces as missing output rather than a hard failure that masks the
 * real problem.
 */
export function resolveTemplate(template: string, context: ExecutionInput): string {
    if (typeof template !== 'string') return String(template);
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
        const value = getNestedValue(context, String(path).trim());
        return value !== undefined ? String(value) : '';
    });
}

/**
 * Walk a dot-separated path through a plain object. Used by
 * `resolveTemplate`; exported separately because per-node executors
 * may need to read structured input directly without template syntax.
 */
export function getNestedValue(obj: ExecutionInput, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
        if (current && typeof current === 'object' && key in current) {
            return (current as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

/**
 * Structural shape of the email transporter the email executor needs.
 * Defined here (rather than importing nodemailer) so the per-node files
 * can be type-checked without pulling nodemailer into every executor's
 * dependency graph and so tests can inject a plain `{ sendMail: jest.fn() }`.
 */
export interface EmailTransporterLike {
    sendMail(options: {
        from?: string;
        to?: string | string[];
        subject?: string;
        text?: string;
        html?: string;
    }): Promise<{
        messageId: string;
        accepted: string[] | Array<{ address: string }>;
        rejected: string[] | Array<{ address: string }>;
    }>;
}

/**
 * Collaborators that per-node executors are allowed to depend on.
 *
 * Keep this interface narrow — anything that lands here should be
 * needed by at least two executors, otherwise pass it through the
 * constructor of the single executor that needs it.
 *
 * The previous `sandbox: SandboxLike` field was removed during the
 * post-pivot cleanup: in-process JS sandboxing via isolated-vm
 * conflicts with the runner-first sandbox strategy (P0 #1, ADR 0001).
 * Steps that need to run user code go through a runner, not in-process.
 */
export interface NodeExecutorDeps {
    logger: Logger;
    /**
     * Lazy accessor for the email transporter. Returns null when
     * SMTP is not configured. The function form lets the executor
     * be constructed before the transporter is wired and lets tests
     * swap the transporter without rebuilding the executor.
     */
    getEmailTransporter?: () => EmailTransporterLike | null;
}

/**
 * Per-class editor node executor. Each implementation handles ONE node
 * type (plus any aliases) and returns a typed result. The result is
 * assignable to `NodeExecutionResult` so the dispatcher in
 * `node-executor.service.ts` can hand it back to the engine unchanged.
 *
 * NOT the same shape as the runbook `StepExecutor` — that one targets
 * the runbook engine's `ExecutorContext` (runId/stepId/tenantId/emit).
 * Step 6 of the ADR merges the two interfaces; until then we deliberately
 * keep this one editor-shaped to avoid touching every existing call site
 * in a single PR.
 */
export interface EditorNodeExecutor<TConfig, TResult extends NodeExecutionResult> {
    /** Canonical node type, e.g. "Transform" */
    readonly type: string;
    /** Other node types that should route to this executor, e.g. ["Code"] */
    readonly aliases?: readonly string[];
    /**
     * Run the node. The two trailing parameters (`tenantId`, `executionId`)
     * are optional because most executors do not need them — pure-logic and
     * IO nodes ignore them. State nodes (store-set, store-get, set-metadata)
     * REQUIRE tenantId or executionId at the call site and throw a
     * configuration error when missing. The dispatcher in
     * `node-executor.service.ts` is responsible for refusing to invoke a
     * state node without the required scoping.
     *
     * Step 6 of the ADR collapses this into a single context object; the
     * positional form is preserved here to keep the diff small while
     * steps 2-5 land incrementally.
     */
    execute(
        config: TConfig,
        input: ExecutionInput,
        errorContext: NodeErrorContext,
        tenantId?: string,
        executionId?: string,
    ): Promise<TResult>;
}
