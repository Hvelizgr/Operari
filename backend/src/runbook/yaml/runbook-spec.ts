/**
 * RunbookSpec — canonical YAML schema for a Operari runbook.
 *
 * This is the source-of-truth representation that the editor, the YAML
 * view, the CLI, and Git-based workflows all share. It is intentionally
 * decoupled from the Prisma WorkflowNode/WorkflowConnection storage
 * model so we can evolve persistence and DSL independently.
 *
 * Design notes:
 *   - Steps are an ordered list, not a graph. Branches and parallel
 *     work are expressed via `next` (single id, list, or conditional
 *     map). Most runbooks are mostly linear; explicit graphs are an
 *     editor concern, not something humans want to read in YAML.
 *   - Step ids must be human-friendly slugs unique within a runbook —
 *     they appear in logs, retries, and the CLI ("operari resume <id>
 *     --from deploy-canary").
 *   - `position` is editor metadata. Round-tripping preserves it but
 *     YAML authors should never have to write it.
 */

export interface RunbookSpec {
  /** Schema version. Bump on breaking changes. */
  version: 1;
  /** Stable slug used by the CLI/SDK. */
  slug?: string;
  /** Human-readable name. */
  name: string;
  /** Optional one-line description. */
  description?: string;
  /** Free-form category (e.g. "deploy", "incident"). */
  category?: string;
  /** Cron expression if scheduled. */
  schedule?: string;
  /** Variables exposed via {{vars.foo}} at run time. */
  vars?: Record<string, unknown>;
  /** Ordered list of steps. */
  steps: RunbookStep[];
}

export interface RunbookStep {
  /** Unique id within the runbook. Slug-cased, e.g. "deploy-canary". */
  id: string;
  /** Step type matching a registered executor (shell, http, approval, ...). */
  type: string;
  /** Human-readable label shown in the UI. */
  name?: string;
  /** Whether this step runs. Defaults to true. */
  enabled?: boolean;
  /** Type-specific configuration (shell command, http url+method, ...). */
  config?: Record<string, unknown>;
  /**
   * Retry policy applied when the step's executor reports failure.
   * Cross-cutting (every step type honours it) so it lives at the
   * step level rather than inside `config`.
   */
  retry?: RetryPolicy;
  /**
   * Template expression evaluated before the step runs. If it
   * resolves to a falsy value the step is skipped (status: SKIPPED)
   * and execution continues with the next step. Mutually exclusive
   * with `skipIf` — if both are set, `skipIf` wins.
   */
  runIf?: string;
  /**
   * Inverse of `runIf`: if it resolves to truthy the step is
   * skipped. Useful for "skip on dry-run" patterns where the
   * positive expression is the noisy one.
   */
  skipIf?: string;
  /**
   * Successor step id(s). Omit on the final step. Strings are
   * resolved as the next step id. The graph form preserves the
   * original WorkflowConnection ports.
   */
  next?: string | string[] | StepConnection[];
  /** Editor-only metadata, preserved on round-trip. */
  position?: { x: number; y: number };
}

/**
 * Retry policy for an individual step.
 *
 *   count       — number of additional attempts after the first failure
 *                 (count: 3 ⇒ up to 4 total runs of the step)
 *   backoff     — strategy for the wait between attempts
 *   delayMs     — base delay; for exponential backoff this is the first delay
 *   maxDelayMs  — cap on backoff growth (only meaningful for exponential)
 *
 * Defaults are applied by the engine, not the YAML — emitting only
 * what differs from default keeps the YAML readable.
 */
export interface RetryPolicy {
  count: number;
  backoff?: 'fixed' | 'exponential';
  delayMs?: number;
  maxDelayMs?: number;
}

export interface StepConnection {
  /** Target step id. */
  to: string;
  /** Source port index on this step (defaults to 0). */
  fromPort?: number;
  /** Target port index on the destination step (defaults to 0). */
  toPort?: number;
}
