/**
 * Plugin-facing types for custom step executors.
 *
 * These are intentionally shallow mirrors of the backend's
 * `ExecutorContext` / `ExecutorResult` types — they cross the trust
 * boundary from Operari core into user-authored code, so they expose
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

/**
 * Optional descriptor for a single editable field in the plugin's
 * config form. Operari's `PropertiesPanel` reads this list and
 * generates real form inputs (text, select, boolean toggle, secret
 * picker, sql editor) instead of falling back to a JSON textarea.
 *
 * Authors who skip this field still get a working step — the editor
 * just renders the JSON fallback for the config block.
 */
export interface PluginStepProperty {
  /** Field key inside the runbook's step `config` block. */
  name: string;
  /** Human-readable label shown above the input. */
  displayName: string;
  /** Renderer to use. Anything else falls back to a string input. */
  type: 'string' | 'boolean' | 'options' | 'number' | 'secret' | 'sql' | 'color';
  /** Pre-filled value when a node is first dropped on the canvas. */
  default?: unknown;
  /** Help text rendered as a tooltip beside the label. */
  description?: string;
  /** For `type: 'options'` — the dropdown choices. */
  options?: { name: string; value: string }[];
  /**
   * Renderer hints. `rows` makes a string input multi-line.
   * `expression` adds the expression-builder badge for `{{vars.x}}`
   * templates. `provider` scopes the SecretPicker to one ConnectedAccount
   * provider (e.g. `'github'`, `'postgres'`).
   */
  typeOptions?: { rows?: number; expression?: boolean; provider?: string };
}

/** I18n string accepted by Operari's editor. Plain strings are also fine. */
export type PluginStepLocalized = string | { en?: string; es?: string };

/**
 * Optional palette / form metadata. Plumbed through the backend
 * loader to a NodeType row in Postgres on plugin discovery so the
 * editor's NodePalette and PropertiesPanel render this step type
 * the same way they render the built-ins.
 *
 * Every field is optional — a plugin author who only cares about
 * the runtime contract can ignore the whole interface.
 */
export interface PluginStepMetadata {
  /** Human-readable name. Defaults to the `type` string. */
  label?: PluginStepLocalized;
  /** One-line description shown in the palette tooltip. */
  description?: PluginStepLocalized;
  /** Lucide icon name, e.g. `'Send'`, `'Database'`. */
  icon?: string;
  /** Tailwind background class, e.g. `'bg-pink-500'`. */
  color?: string;
  /** Palette section, e.g. `'integrations'`, `'devops'`, `'custom'`. */
  category?: string;
  /** Input ports on the canvas node. Defaults to a single `main`. */
  inputs?: { name: string; type: string }[];
  /** Output ports. Defaults to a single `main`. */
  outputs?: { name: string; type: string }[];
  /** Auto-form descriptors. Empty array → JSON textarea fallback. */
  properties?: PluginStepProperty[];
}

export interface DefineStepOptions<TConfig> extends PluginStepMetadata {
  /**
   * Unique type identifier. Use a reverse-DNS-ish namespace to avoid
   * collisions with built-in steps or other plugins:
   *   `myorg.slack-notify`, `acme.aws-rds-snapshot`.
   * Reserving the unprefixed `shell` / `approval` / `notify` /
   * `wait` / `ssh` / `runbook` / `operari.*` prefixes for the core.
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
export interface PluginStep<TConfig = unknown> extends PluginStepMetadata {
  readonly type: string;
  readonly configSchema: StepConfigSchema<TConfig>;
  execute: (config: TConfig, context: PluginContext) => Promise<PluginResult>;
}
