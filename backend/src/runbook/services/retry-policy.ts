/**
 * Per-step retry policy resolution + backoff math.
 *
 * The engine reads `node.config._retry` for each step it dispatches.
 * Shape (matches RetryPolicy in runbook-spec.ts):
 *   {
 *     count: number,                    // additional attempts after first failure
 *     backoff?: 'fixed' | 'exponential',
 *     delayMs?: number,                 // base delay
 *     maxDelayMs?: number,              // cap for exponential growth
 *   }
 *
 * Defaults are applied here, NOT in the YAML — emitting only what
 * differs from default keeps round-tripped YAML readable.
 */

export interface ResolvedRetryPolicy {
  count: number;
  backoff: 'fixed' | 'exponential';
  delayMs: number;
  maxDelayMs: number;
}

const DEFAULTS = {
  backoff: 'fixed' as const,
  delayMs: 1_000,
  maxDelayMs: 60_000,
};

/**
 * Read + validate the retry policy off a node's config. Returns null
 * when no policy is set or when the policy parses as a no-op
 * (count <= 0). Bad shapes are dropped silently — a malformed
 * `_retry` block should not crash the engine.
 */
export function readRetryPolicy(node: { config?: unknown }): ResolvedRetryPolicy | null {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const raw = config._retry;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const count = typeof r.count === 'number' && r.count > 0 ? Math.floor(r.count) : 0;
  if (count <= 0) return null;

  const backoff: 'fixed' | 'exponential' =
    r.backoff === 'exponential' ? 'exponential' : DEFAULTS.backoff;
  const delayMs =
    typeof r.delayMs === 'number' && r.delayMs >= 0 ? Math.floor(r.delayMs) : DEFAULTS.delayMs;
  const maxDelayMs =
    typeof r.maxDelayMs === 'number' && r.maxDelayMs > 0
      ? Math.floor(r.maxDelayMs)
      : DEFAULTS.maxDelayMs;

  // Hard cap on count to keep retry loops bounded — past 20 attempts
  // you want a different recovery strategy, not more retries. Same
  // shape as the workspace defaults UI cap (10) but stricter only
  // there because "operator hand-tuned per-step" wins.
  return { count: Math.min(count, 20), backoff, delayMs, maxDelayMs };
}

/**
 * Compute the wait between attempt N and attempt N+1.
 *
 * - fixed:       always `delayMs`
 * - exponential: delayMs * 2^attempt, capped at maxDelayMs
 *
 * `attempt` is the zero-based index of the FAILURE that just
 * happened (0 = first failure, retrying for the first time).
 */
export function computeBackoffDelay(policy: ResolvedRetryPolicy, attempt: number): number {
  if (policy.backoff === 'fixed') return policy.delayMs;
  // exponential: 1x, 2x, 4x, 8x, ... — clamp at maxDelayMs
  const grown = policy.delayMs * 2 ** attempt;
  return Math.min(grown, policy.maxDelayMs);
}
