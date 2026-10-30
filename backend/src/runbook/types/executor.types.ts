/**
 * Operari executor types
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
  /**
   * Plaintext secrets pre-resolved by the orchestrator before the step
   * runs. Keyed by `ConnectedAccount.id`. Populated by
   * SecretTemplateResolver — never written by an executor and never
   * persisted. The map only contains the IDs that the step's config
   * actually references; reading any other key in `resolveTemplate`
   * resolves to an empty string just like an unknown var.
   *
   * Pre-resolution (instead of an async lookup inside `resolveTemplate`)
   * keeps the template engine sync, makes one audit event per unique
   * secret per step instead of one per substitution site, and lets the
   * step fail fast with a clear error before the executor sends any
   * traffic.
   */
  secrets?: Record<string, string>;
  /** Optional callback to stream output (stdout/stderr/log lines) in real time */
  emit?: (event: ExecutorEvent) => void;
  /**
   * Dry-run mode. When true, executors MUST NOT perform any side
   * effect (no subprocess, no HTTP request, no notification, no
   * approval pause). They should emit a "would do X" log line and
   * return `{ success: true, output: { dryRun: true, ... } }`.
   *
   * Sub-runs spawned by the `runbook` step inherit this flag, so a
   * dry-run of a parent runbook dry-runs the whole tree.
   */
  dryRun?: boolean;
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
  /**
   * Optional tenant scope. `undefined` means a global executor —
   * built-ins (shell, http, etc.) and plugins from the top-level
   * OPERARI_PLUGINS_DIR. A non-null value scopes the executor to one
   * tenant: the dispatcher rejects a run with a different `tenantId`.
   *
   * See ADR 0006 for the threat model + escape hatch path to a
   * worker-pool isolation when cloud beta needs real process
   * isolation between tenants.
   */
  readonly tenantId?: string;
  /** Execute the step with the given config and context */
  execute(config: TConfig, context: ExecutorContext): Promise<ExecutorResult>;
}

/**
 * Look up a pre-resolved credential by the value of a `credentialId`
 * field. The editor's secret picker stores `{{secrets.<id>}}` (which is
 * what makes the orchestrator fetch it) while hand-written YAML may
 * hold the bare id; both must land on the same `context.secrets` key.
 */
export function credentialSecret(
  ref: string | undefined,
  context: ExecutorContext
): string | undefined {
  if (!ref) return undefined;
  const match = /^\{\{\s*secrets\.([A-Za-z0-9_-]+)\s*\}\}$/.exec(ref.trim());
  return context.secrets?.[match ? match[1] : ref];
}

/**
 * Resolve template strings like "{{vars.foo}}", "{{steps.deploy.output.url}}",
 * or "{{secrets.<connected-account-id>}}" against the executor context.
 *
 * `secrets.*` is read from `context.secrets`, which the orchestrator
 * populates by pre-resolving every `{{secrets.X}}` reference in the
 * step's config (see SecretTemplateResolver). The lookup is sync on
 * purpose — async fan-out happens once at the orchestrator level so
 * each unique secret produces exactly one audit event per step.
 */
export function resolveTemplate(template: string, context: ExecutorContext): string {
  if (typeof template !== 'string') return String(template);

  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) =>
    stringifyValue(lookupPath(path, context))
  );
}

/** Objects render as JSON; `[object Object]` was never what anyone meant. */
function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Value at a template path (`vars.x`, `steps.id.output.y`, `secrets.id`, or a bare field). */
export function lookupPath(path: string, context: ExecutorContext): unknown {
  const segments = path.trim().split('.');
  const root = segments[0];

  let source: unknown;
  if (root === 'vars') {
    source = context.variables;
    segments.shift();
  } else if (root === 'steps') {
    source = context.previousOutputs;
    segments.shift();
  } else if (root === 'secrets') {
    source = context.secrets ?? {};
    segments.shift();
  } else {
    // Bare `{{field}}`: the parent step's output first, run inputs as fallback.
    source = { ...context.variables, ...context.previousOutputs };
  }

  return segments.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

/**
 * A field that is exactly one `{{path}}` keeps the referenced value as is
 * (array, object, number); anything else is rendered as text.
 */
export function resolveValue(expression: unknown, context: ExecutorContext): unknown {
  if (typeof expression !== 'string') return expression;
  const whole = /^\s*\{\{([^}]+)\}\}\s*$/.exec(expression);
  if (whole) return lookupPath(whole[1], context);
  return resolveTemplate(expression, context);
}
