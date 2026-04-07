/**
 * NanoRun executor types
 *
 * These types define the contract between the runbook engine and individual
 * step executors (shell, http, kubectl, approval, notify, etc.).
 */

export interface ExecutorContext {
    /** ID of the current Run (a single execution of a runbook) */
    runId: string;
    /** ID of the step being executed */
    stepId: string;
    /** Variables available for template resolution: {{vars.foo}} */
    variables: Record<string, unknown>;
    /** Outputs from previously executed steps */
    previousOutputs: Record<string, unknown>;
    /** Tenant ID for multi-tenancy isolation */
    tenantId: string;
    /** Optional callback to stream output (stdout/stderr/log lines) in real time */
    emit?: (event: ExecutorEvent) => void;
}

export interface ExecutorEvent {
    type: 'stdout' | 'stderr' | 'log' | 'progress';
    text: string;
    timestamp?: Date;
}

export interface ExecutorResult {
    /** Whether the step succeeded */
    success: boolean;
    /** Output payload to pass to downstream steps */
    output?: Record<string, unknown>;
    /** Error message if failed */
    error?: string;
    /** Execution duration in ms */
    duration?: number;
    /** Whether the step is paused (e.g. waiting for approval) — runbook engine should suspend */
    paused?: boolean;
}

export interface StepExecutor<TConfig = unknown> {
    /** Unique type identifier matching the node "type" field */
    readonly type: string;
    /** Execute the step with the given config and context */
    execute(config: TConfig, context: ExecutorContext): Promise<ExecutorResult>;
}

/**
 * Resolve template strings like "{{vars.foo}}" or "{{steps.deploy.output.url}}"
 * against the executor context.
 */
export function resolveTemplate(template: string, context: ExecutorContext): string {
    if (typeof template !== 'string') return String(template);

    return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const trimmed = path.trim();
        const segments = trimmed.split('.');
        const root = segments[0];

        let source: unknown;
        if (root === 'vars') {
            source = context.variables;
            segments.shift();
        } else if (root === 'steps') {
            source = context.previousOutputs;
            segments.shift();
        } else {
            // Fallback: search variables first, then previous outputs
            source = { ...context.previousOutputs, ...context.variables };
        }

        const value = segments.reduce<unknown>((current, key) => {
            if (current && typeof current === 'object' && key in current) {
                return (current as Record<string, unknown>)[key];
            }
            return undefined;
        }, source);

        return value !== undefined ? String(value) : '';
    });
}
