/**
 * Brand color hex tokens mirrored from `app/globals.css` (`--op-*`).
 *
 * CSS variables cover 99% of color needs — components consume them via
 * `var(--op-moss)` directly. These constants exist for the narrow
 * cases where CSS variables don't reach:
 *
 *   - `og-image` routes (rendered in an isolated JSX runtime that
 *     doesn't have the app's CSS loaded)
 *   - SVG attributes set from JS (e.g. React Flow edge markers in
 *     `components/Editor/flow/`) that need literal hex strings
 *   - Third-party integrations configured by object literal (e.g.
 *     xterm.js theme in `components/Editor/terminal/LogTerminal.tsx`)
 *
 * If you're writing a regular component, prefer `var(--op-*)` or
 * `var(--accent-color)` — those flow through the theme system. Only
 * reach for these when CSS vars genuinely cannot resolve.
 *
 * Source of truth: `app/globals.css:13-25`. Keep in sync by hand; a
 * future build step could extract these but the five-value surface
 * isn't worth the tooling yet.
 */

export const BRAND_COLORS = {
  /** Supabase-inspired primary accent. Post-rebrand default. */
  moss: '#3ecf8e',
  /** Secondary brand accent — informational + link states. */
  sky: '#0ea5e9',
  /** Brand-neutral near-black for dark mode backgrounds. */
  granite: '#0a0a0a',
  /** Card + panel surface in dark mode. */
  graphite: '#171717',
  /** Subtle surface borders in dark mode. */
  weathered: '#262626',
  /** Light-mode foreground text. */
  snow: '#ededed',
  /** Muted text (both themes). */
  fog: '#a1a1aa',
  /** Success + brighter variant of moss. */
  lichen: '#24b47e',
  /** Warning (amber). */
  gold: '#f59e0b',
  /** Error (red). */
  sunset: '#ef4444',
  /** Info (brighter sky). */
  ice: '#38bdf8',
} as const;

/** Neutral slate used for idle connection strokes on the canvas. */
export const SLATE_600 = '#475569';
