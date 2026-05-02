import type {
  AccentColor,
  AnimationSpeed,
  FlowSpeed,
  NodeShadowPreset,
  StatusColors,
  VisualizationPrefs,
} from './types';

/**
 * Factory defaults for every Appearance preference.
 *
 * These are the values a fresh install starts with. The "Reset" button
 * on the Presets tab restores everything to this baseline, and the
 * built-in "Default" preset is a direct reference to this object.
 * Kept on its own for two reasons:
 * 1. The provider and the `<html>` bootstrap script both need to read
 *    these values — having them in a leaf file means no cycle risk.
 * 2. Tests can assert the defaults without instantiating the provider.
 */
export const VISUALIZATION_DEFAULTS: VisualizationPrefs = {
  animationsEnabled: true,
  animationSpeed: 'default',
  flowAnimationsEnabled: true,
  nodeDensity: 'comfortable',
  nodeStyle: 'modern',
  lineStyle: 'bezier',
  flowStyle: 'orbs',
  glowIntensity: 1,
  accentColor: 'emerald',
  nodeRadiusBoost: 0,
  nodeScale: 1,
  nodeShadowPreset: 'md',
  nodeIconSize: 'md',
  statusColors: {
    running: null,
    success: null,
    failed: null,
    idle: null,
  },
  edgeThickness: 1.6,
  edgeArrowEnabled: false,
  edgeArrowSize: 8,
  edgeDashPattern: 'solid',
  edgeIdleOpacity: 0.55,
  flowParticleCount: 3,
  flowParticleSize: 3.5,
  flowSpeed: 'normal',
  runningPulseVariant: 'breathe',
  completionFlashVariant: 'flash',
  bgPattern: 'dots',
  bgGridSize: 20,
  bgGridOpacity: 0.55,
  minimapPosition: 'bottom-right',
  // V2 additions
  theme: 'dark',
  fontScale: 'md',
  reducedMotion: false,
  nodeVariant: 'default',
  nodeCorners: 'rounded',
  nodeHeaderBand: true,
  nodeShape: 'rounded-rect',
  nodeDensityV2: 'comfortable',
  flowFlavor: 'all',
};

/** Font-scale multipliers applied as `--font-scale` on <html>.
 *  CSS reads `font-size: calc(var(--font-scale, 1) * 1rem)` etc. */
export const FONT_SCALE_MULT: Record<'sm' | 'md' | 'lg' | 'xl', number> = {
  sm: 0.875,
  md: 1,
  lg: 1.125,
  xl: 1.25,
};

/** Hex values keyed by AccentColor. Consumed by applyToDocument (runtime),
 *  the first-paint bootstrap script (via JSON.stringify), and the
 *  LivePreview previews. Single source of truth — every other
 *  accent-color consumer must import from here. */
export const ACCENT_HEX: Record<AccentColor, string> = {
  emerald: '#3ecf8e',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
};

/** Default hex values for each status when no override is set. The
 *  canvas renderer falls back to these literal values; CSS rules use
 *  color-mix against var(--accent-override) for neon/glow surfaces. */
export const STATUS_HEX_DEFAULTS: Record<keyof StatusColors, string> = {
  running: '#3ecf8e',
  success: '#3ecf8e',
  failed: '#ef4444',
  idle: '#96969a',
};

/** Shadow preset → CSS box-shadow value. Applied additively on top of
 *  the nodeStyle preset so the user can layer a bold shape with a
 *  light shadow, or a minimal shape with a heavy drop. */
export const NODE_SHADOW_HEX: Record<NodeShadowPreset, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.12)',
  md: '0 4px 10px rgba(0, 0, 0, 0.25)',
  lg: '0 8px 22px rgba(0, 0, 0, 0.32)',
  xl: '0 14px 38px rgba(0, 0, 0, 0.45)',
};

/** Duration multiplier applied to every animation. Values >1 slow the
 *  animation down, values <1 speed it up, 0 freezes. */
export const ANIMATION_SPEED_MULT: Record<AnimationSpeed, number> = {
  off: 0,
  calm: 1.5,
  default: 1,
  lively: 0.6,
};

/** Per-frame advance of the flow phase for each speed bucket. The
 *  canvas renderer reads this as `--flow-speed-mult` and multiplies
 *  its flowOffset increment. */
export const FLOW_SPEED_MULT: Record<FlowSpeed, number> = {
  slow: 0.5,
  normal: 1,
  fast: 1.8,
};
