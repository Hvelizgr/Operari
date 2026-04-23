import { colorWithAlpha } from './color';

/**
 * Canvas-renderer view of the user's Appearance preferences. Read
 * fresh from the DOM on every frame — the Appearance page writes to
 * `<html>` as data-* attrs + CSS custom properties, so the renderer
 * picks up changes instantly without prop drilling or React re-renders.
 */

export type UpstreamStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED';

export interface RenderPrefs {
  lineStyle: 'bezier' | 'straight' | 'step';
  flowStyle: 'orbs' | 'dashes' | 'pulse' | 'comet' | 'particles' | 'gradient' | 'off';
  flowEnabled: boolean;
  animEnabled: boolean;
  /** Stroke width in px. Running state boosts this automatically. */
  edgeThickness: number;
  /** Idle-line alpha (0..1) — applied when the upstream is not
   *  RUNNING/SUCCESS/FAILED. */
  edgeIdleOpacity: number;
  /** Dash pattern for idle lines. Overridden by the running dashOffset
   *  and the `dashes` flowStyle while those are active. */
  edgeDashPattern: 'solid' | 'dotted' | 'short-dash' | 'long-dash';
  /** Draw an arrowhead at the target end of every stroked path. */
  edgeArrowEnabled: boolean;
  edgeArrowSize: number;
  /** Particle count for flowStyle=`particles`. */
  particleCount: number;
  /** Radius of the flow orb / particle / comet head. */
  particleSize: number;
  /** Per-status hex color overrides — '' means "fall back to the
   *  built-in palette". */
  statusColor: Record<UpstreamStatus, string>;
  /** Color used when upstream is idle (no status). */
  idleColor: string;
}

/** Palette fallbacks used when the user has not set a color override.
 *  Matches the legacy hardcoded values so a fresh install looks
 *  identical to pre-Appearance-page NanoRun. */
export const BUILT_IN_STATUS_COLORS: RenderPrefs['statusColor'] = {
  RUNNING: '#3ecf8e',
  SUCCESS: 'rgba(62, 207, 142, 0.65)',
  FAILED: 'rgba(239, 68, 68, 0.7)',
  PAUSED: '#3ecf8e',
  SKIPPED: 'rgba(62, 207, 142, 0.4)',
  CANCELLED: 'rgba(150, 150, 160, 0.55)',
};

export const BUILT_IN_IDLE_COLOR = 'rgba(150, 150, 160, 0.55)';

function readNumberVar(html: HTMLElement, name: string, fallback: number): number {
  const raw = html.style.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readStringVar(html: HTMLElement, name: string, fallback: string): string {
  const raw = html.style.getPropertyValue(name).trim();
  return raw || fallback;
}

export function readPrefs(): RenderPrefs {
  const html = document.documentElement;

  const rawLineStyle = html.getAttribute('data-line-style');
  const lineStyle: RenderPrefs['lineStyle'] =
    rawLineStyle === 'straight' ? 'straight' : rawLineStyle === 'step' ? 'step' : 'bezier';

  const rawFlowStyle = html.getAttribute('data-flow-style');
  const flowStyle: RenderPrefs['flowStyle'] =
    rawFlowStyle === 'dashes'
      ? 'dashes'
      : rawFlowStyle === 'pulse'
        ? 'pulse'
        : rawFlowStyle === 'comet'
          ? 'comet'
          : rawFlowStyle === 'particles'
            ? 'particles'
            : rawFlowStyle === 'gradient'
              ? 'gradient'
              : rawFlowStyle === 'off'
                ? 'off'
                : 'orbs';

  const rawDashPattern = html.getAttribute('data-edge-dash');
  const edgeDashPattern: RenderPrefs['edgeDashPattern'] =
    rawDashPattern === 'dotted'
      ? 'dotted'
      : rawDashPattern === 'short-dash'
        ? 'short-dash'
        : rawDashPattern === 'long-dash'
          ? 'long-dash'
          : 'solid';

  const flowEnabled = html.getAttribute('data-flow') !== 'off';
  const animEnabled = html.getAttribute('data-anim') !== 'off';
  const edgeArrowEnabled = html.getAttribute('data-edge-arrow') === 'on';

  const edgeThickness = readNumberVar(html, '--edge-thickness', 1.6);
  const edgeIdleOpacity = readNumberVar(html, '--edge-idle-opacity', 0.55);
  const edgeArrowSize = readNumberVar(html, '--edge-arrow-size', 8);
  const particleCount = readNumberVar(html, '--flow-particle-count', 3);
  const particleSize = readNumberVar(html, '--flow-particle-size', 3.5);

  const running = readStringVar(html, '--status-running', BUILT_IN_STATUS_COLORS.RUNNING);
  const successHex = readStringVar(html, '--status-success', '');
  const failedHex = readStringVar(html, '--status-failed', '');
  const idle = readStringVar(html, '--status-idle', BUILT_IN_IDLE_COLOR);

  return {
    lineStyle,
    flowStyle,
    flowEnabled,
    animEnabled,
    edgeThickness,
    edgeIdleOpacity,
    edgeDashPattern,
    edgeArrowEnabled,
    edgeArrowSize,
    particleCount,
    particleSize,
    statusColor: {
      RUNNING: running || BUILT_IN_STATUS_COLORS.RUNNING,
      SUCCESS: successHex ? colorWithAlpha(successHex, 0.75) : BUILT_IN_STATUS_COLORS.SUCCESS,
      FAILED: failedHex ? colorWithAlpha(failedHex, 0.85) : BUILT_IN_STATUS_COLORS.FAILED,
      PAUSED: running || BUILT_IN_STATUS_COLORS.PAUSED,
      SKIPPED: BUILT_IN_STATUS_COLORS.SKIPPED,
      CANCELLED: BUILT_IN_STATUS_COLORS.CANCELLED,
    },
    idleColor: idle || BUILT_IN_IDLE_COLOR,
  };
}

/** Per-frame multiplier for the flow phase advance. The Appearance
 *  page writes this to `--flow-speed-mult` on <html>; fast = 1.8,
 *  normal = 1, slow = 0.5. Default 1 if the var is missing or malformed. */
export function readFlowSpeedMult(): number {
  const raw = document.documentElement.style.getPropertyValue('--flow-speed-mult').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
