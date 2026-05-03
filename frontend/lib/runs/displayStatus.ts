/**
 * Derive a richer display status from a persisted run's `(status,
 * error)` pair (trigger.dev parity, lightweight derivation).
 *
 * The DB enum stays at the v1 set (`PENDING / RUNNING / SUCCESS /
 * FAILED / PAUSED / CANCELLED`) so the wire format and downstream
 * consumers do not break, but the UI splits the FAILED bucket into
 * three sub-kinds operators care about during diagnosis:
 *
 *   TIMED_OUT  — the step or run exceeded its timeout. Different
 *                from FAILED because retrying with the same payload
 *                MAY succeed (or maybe the operator just needs to
 *                bump the timeout).
 *   CRASHED    — engine-side death (OOM, segfault, executor crash).
 *                Different from FAILED because the user code did
 *                not get to return — a retry is unlikely to land
 *                differently without bumping resources.
 *   EXPIRED    — trigger fired (scheduled/webhook) but the engine
 *                did not pick it up before the TTL elapsed. Suggests
 *                a backlog problem, not a user-code problem.
 *
 * Anything else FAILED stays FAILED. Non-FAILED statuses pass
 * through unchanged.
 */

export type StoredRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED';

export type DisplayRunStatus = StoredRunStatus | 'TIMED_OUT' | 'CRASHED' | 'EXPIRED';

export interface StoredErrorShape {
  /** Error code as emitted by the engine (`backend/src/errors/custom-error.ts`). */
  code?: string | null;
  /** Free-form message — kept for fallback heuristics on legacy rows. */
  message?: string | null;
}

/**
 * Map a stored status + optional error blob to a richer display
 * status. The error fields are read lightly: an exact `code` match
 * wins; otherwise the `message` is sniffed for known phrases. The
 * helper is pure and covered by unit tests so a future error-shape
 * change can land in one place.
 */
export function deriveDisplayStatus(
  status: StoredRunStatus,
  error?: StoredErrorShape | null
): DisplayRunStatus {
  if (status !== 'FAILED' || !error) return status;

  const code = (error.code ?? '').toUpperCase();
  const msg = (error.message ?? '').toLowerCase();

  if (code.includes('TIMEOUT') || /\btimeout\b|\btimed out\b/.test(msg)) {
    return 'TIMED_OUT';
  }
  if (
    code.includes('CRASH') ||
    code === 'NODE_OOM' ||
    /\boom\b|out of memory|killed by signal/.test(msg)
  ) {
    return 'CRASHED';
  }
  if (code.includes('EXPIRED') || code === 'TTL_EXCEEDED' || /\bexpired\b|ttl/.test(msg)) {
    return 'EXPIRED';
  }
  return 'FAILED';
}

/**
 * Operator-facing copy for each display status. Kept English-only
 * here; the consumers can localise via their own copy maps that
 * key on the same display status string.
 */
export const DISPLAY_STATUS_LABEL: Record<DisplayRunStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  TIMED_OUT: 'Timed out',
  CRASHED: 'Crashed',
  EXPIRED: 'Expired',
};

/**
 * "Why this is bad" copy — used as `title` on status icons so an
 * operator hovering during a postmortem learns what the new bucket
 * means without leaving the page.
 */
export const DISPLAY_STATUS_HINT: Record<DisplayRunStatus, string> = {
  PENDING: 'Waiting to start.',
  RUNNING: 'Currently executing.',
  SUCCESS: 'Completed successfully.',
  FAILED: 'A step returned an error.',
  PAUSED: 'Paused — waiting for an external signal (approval, wait, breakpoint).',
  CANCELLED: 'Cancelled by an operator or by the engine.',
  TIMED_OUT: 'A step or the whole run exceeded its timeout. A retry may succeed.',
  CRASHED:
    'Engine-side death (OOM, segfault, runner crash). User code did not return; consider bumping resources before retrying.',
  EXPIRED:
    'The trigger fired but the engine did not pick the run up before its TTL elapsed. Suggests a backlog problem, not a code problem.',
};
