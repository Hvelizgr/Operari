/**
 * Named timeout + retry constants used across the frontend.
 *
 * The goal is to stop the pattern of `setTimeout(..., 2000)` scattered
 * across twelve files where nobody knows why 2000 was picked. Every
 * constant here has a short comment explaining the rationale so a
 * future change is informed, not a guess.
 */

/**
 * Debounce window between a user edit in the editor and the autosave
 * POST. 2s is the n8n convention — short enough that a reload after a
 * crash recovers nearly all work, long enough that rapid typing
 * doesn't trigger a request per keystroke.
 */
export const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * How long "Copied!" confirmations stay visible after a copy-to-clipboard
 * button click. Matches GitHub's copy-SHA behavior; long enough to
 * notice, short enough to not block subsequent clicks.
 */
export const COPY_FEEDBACK_MS = 1500;

/**
 * Window-size observer debounce. Layout recomputation on resize is
 * expensive (triggers ReactFlow-style measurement); 150ms is the
 * sweet spot between snappy and over-firing.
 */
export const RESIZE_DEBOUNCE_MS = 150;

/**
 * Toast auto-dismiss window for successful actions (save, copy,
 * delete). Error toasts stay until dismissed — that's handled by the
 * toast component, not by a constant.
 */
export const TOAST_SUCCESS_MS = 3000;

/**
 * Health-check request timeout for the dashboard's /api/health polling.
 * Short because a healthy backend responds <100ms; anything longer is
 * a degradation we want to surface quickly.
 */
export const HEALTH_CHECK_TIMEOUT_MS = 1500;
