/**
 * Plugin-facing types for custom step executors.
 *
 * These are intentionally shallow mirrors of the backend's
 * `ExecutorContext` / `ExecutorResult` types — they cross the trust
 * boundary from NanoRun core into user-authored code, so they expose
 * only what a plugin legitimately needs. In particular we do NOT
 * expose Prisma, Express req/res, or the internal audit service.
 */

export interface PluginContext {
  /** ID of the current Run (a single execution of a runbook). */
  runId: string;
  /** ID of the step being executed. */
  stepId: string;
  /** Tenant ID — useful if the plugin wants to scope external state. */
  tenantId: string;
  /**
   * Variables available to the current run (from the runbook's `vars`
   * block and the trigger input). Keys and values vary per runbook.
   */
  variables: Record<string, unknown>;
  /**
   * Outputs from previously-executed steps, keyed by step id.
   * Example: `context.previousOutputs["pre_check"].exit_code`.
   */
  previousOutputs: Record<string, unknown>;
  /**
   * Plaintext secrets the orchestrator pre-resolved for this step.
   * Keyed by ConnectedAccount id. Never persisted, never logged.
   * A plugin that wants a secret should declare the reference in
   * its own config (so the orchestrator resolves it) and read from
   * this map at execute time.
   */
  secrets: Record<string, string>;
  /**
   * Emit a structured log event that shows up in the live run
   * timeline. The plugin should NOT write directly to stdout —
   * those writes are not captured by the streaming socket.
   */
  emit: (event: PluginEmitEvent) => void;
}

export interface PluginEmitEvent {
  type: 'stdout' | 'stderr' | 'log' | 'progress';
  text: string;
}

export interface PluginResult {
  /** Required. Whether the step succeeded. */
  success: boolean;
  /**
   * Payload stored as the step's output — becomes
   * `context.previousOutputs[<thisStepId>]` for downstream steps.
   */
  output?: Record<string, unknown>;
  /** Human-readable error message. Only meaningful when success === false. */
  error?: string;
}

/**
 * Duck-typed schema contract so a plugin author can bring any
 * validation library (zod, yup, arktype) as long as it exposes
 * `parse(input) => T | throws`. zod's `z.object(...).parse` matches
 * this shape out of the box.
 */
export interface StepConfigSchema<T = unknown> {
  parse: (input: unknown) => T;
}

export interface DefineStepOptions<TConfig> {
  /**
   * Unique type identifier. Use a reverse-DNS-ish namespace to avoid
   * collisions with built-in steps or other plugins:
   *   `myorg.slack-notify`, `acme.aws-rds-snapshot`.
   * Reserving the unprefixed `shell` / `approval` / `notify` /
   * `wait` / `ssh` / `runbook` / `nanorun.*` prefixes for the core.
   */
  type: string;
  /**
   * Schema that validates the step's `config` block at run time.
   * A zod object (or any object with a `.parse` method) works.
   * The resolved config is passed to `execute` with the inferred type.
   */
  configSchema: StepConfigSchema<TConfig>;
  /**
   * Run the step. Throwing is allowed — the runtime catches and
   * converts to `{ success: false, error: <message> }`. Returning
   * an explicit error result is equivalent.
   */
  execute: (config: TConfig, context: PluginContext) => Promise<PluginResult>;
}

/**
 * The shape a plugin's default export should expose. Plugins SHOULD
 * produce this via `defineStep(...)` rather than construct it by hand
 * so type inference and validation stay consistent.
 */
export interface PluginStep<TConfig = unknown> {
  readonly type: string;
  readonly configSchema: StepConfigSchema<TConfig>;
  execute: (config: TConfig, context: PluginContext) => Promise<PluginResult>;
}
