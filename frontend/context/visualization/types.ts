/**
 * Type unions + the `VisualizationPrefs` interface that shape every
 * knob the user can set in Settings → Appearance. Kept in its own
 * file so UI code (AppearancePage tabs, live previews) can import the
 * unions without pulling in the whole provider + storage + DOM layer.
 */

export type NodeDensity = 'compact' | 'comfortable' | 'spacious';
export type LineStyle = 'bezier' | 'straight' | 'step';

/**
 * How the "something is flowing along this connection" animation is
 * rendered on a RUNNING or SUCCESS edge.
 * - `orbs`: a single emerald orb travels the path (classic).
 * - `dashes`: a line of short dashes march along the path.
 * - `pulse`: the whole line breathes in opacity + width.
 * - `comet`: an orb with a trailing fade-out tail.
 * - `particles`: multiple orbs staggered along the path.
 * - `gradient`: a moving color gradient along the stroke.
 * - `off`: no per-frame animation on the line body.
 */
export type FlowStyle = 'orbs' | 'dashes' | 'pulse' | 'comet' | 'particles' | 'gradient' | 'off';

/**
 * Named animation-speed presets. `off` kills every transition + keyframe
 * the same way animationsEnabled=false used to. `calm` / `default` /
 * `lively` multiply every animation duration by a factor so the
 * operator can dial the canvas from "meditative" to "snappy" without
 * ever falling off the edge into strobe territory.
 */
export type AnimationSpeed = 'off' | 'calm' | 'default' | 'lively';

/**
 * Named accent colors. Each maps to a concrete hex in defaults.ts and
 * gets exposed as `--accent-override` for CSS, or as a direct hex
 * constant for the canvas renderer that can't use CSS variables.
 */
export type AccentColor = 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate';

/**
 * Visual shape + shadow preset for the job cards. Density controls
 * packing (padding/min-width); node style controls aesthetic (sharp
 * vs. soft vs. heavy). Orthogonal.
 */
export type NodeStyle = 'modern' | 'minimal' | 'bold' | 'neon' | 'glass';

export type NodeShadowPreset = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type NodeIconSize = 'sm' | 'md' | 'lg';
export type EdgeDashPattern = 'solid' | 'dotted' | 'short-dash' | 'long-dash';
export type FlowSpeed = 'slow' | 'normal' | 'fast';
export type RunningPulseVariant = 'breathe' | 'wave' | 'ripple' | 'none';
export type CompletionFlashVariant = 'flash' | 'bounce' | 'none';
export type BgPattern = 'dots' | 'grid' | 'lines' | 'none';
export type MinimapPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'hidden';

/**
 * V2-only personalization prefs, added after the React Flow rebuild.
 * The originals above target V1 chrome (`.wf_node`, etc.); these
 * apply to the V2 canvas directly via root data-* attributes and
 * CSS variables consumed by Tailwind utilities.
 */
export type ThemeMode = 'dark' | 'light' | 'midnight';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';

/**
 * V2 node variants. Each maps to a CSS data-attribute on <html> and
 * a set of overrides for the `.rb-node` selector in globals.css.
 *   - default:  current shape — header band + body, rounded corners
 *   - minimal:  no shadow, thin border, header band kept
 *   - card:     elevated shadow, no header band, full-bleed body
 *   - outlined: 2px accent border, no fill, no shadow
 */
export type NodeVariant = 'default' | 'minimal' | 'card' | 'outlined';

/** V2 node corner radius preset. Independent from variant. */
export type NodeCorners = 'sharp' | 'rounded' | 'extra-rounded';

/**
 * V2 connection-animation flavor when a step is running.
 *   - all      → gradient slide + marching dashes + comet trail (default)
 *   - gradient → only the sliding gradient stroke
 *   - dashes   → only marching dashes (cleaner, lower-GPU)
 *   - comet    → only the orb trail riding the path
 *   - off      → no animation; same as flowAnimationsEnabled=false
 */
export type FlowFlavor = 'all' | 'gradient' | 'dashes' | 'comet' | 'off';

/**
 * Per-status color overrides. Each field is a hex string ('#rrggbb')
 * or null to fall back to the built-in palette (emerald for running,
 * pale emerald for success, red for failed, neutral gray for idle).
 * Applied to both the node border accent and the edge stroke so the
 * two always tell the same story.
 */
export interface StatusColors {
  running: string | null;
  success: string | null;
  failed: string | null;
  idle: string | null;
}

export interface VisualizationPrefs {
  /** Master switch for ALL editor animations (CSS keyframes + canvas
   * flow orbs + framer-motion transitions). Replaced by
   * animationSpeed below; kept on the prefs shape for
   * backwards-compat with old localStorage payloads. */
  animationsEnabled: boolean;
  /** Named speed preset. `off` = everything still, `calm` = slower
   * durations, `default` = current behavior, `lively` = shorter
   * durations. */
  animationSpeed: AnimationSpeed;
  /** Just the canvas flow orbs (the dashed dance and traveling
   * micro-mouse on running connections). Default true. */
  flowAnimationsEnabled: boolean;
  /** How tightly nodes pack on the canvas. Maps to padding +
   * border-radius CSS variables. */
  nodeDensity: NodeDensity;
  /** Visual aesthetic preset for the job card — drives border-radius
   * + shadow tone independently from density. */
  nodeStyle: NodeStyle;
  /** Renderer mode for connection lines. */
  lineStyle: LineStyle;
  /** Running-line animation flavor. Independent from `flowAnimationsEnabled`
   *  which kills ALL line animation; flowStyle picks the *flavor* when on. */
  flowStyle: FlowStyle;
  /** Glow intensity (0..2). 1 = default. 0 = no shadows. */
  glowIntensity: number;
  /** Brand accent override. Propagates to every pole, border, line
   * orb and selected outline in the canvas + CSS. */
  accentColor: AccentColor;
  /** Extra border radius in px added on top of the density default.
   * Range 0..20, default 0. */
  nodeRadiusBoost: number;
  /** Global node scale. 0.85..1.2, default 1. Multiplies the visual
   * size of the job cards via CSS `transform: scale()`. */
  nodeScale: number;
  /** Shadow intensity preset applied to the card itself, independent
   * from the nodeStyle shadow. Useful for users who love `minimal`
   * but want deeper shadows, or `bold` with no shadow. */
  nodeShadowPreset: NodeShadowPreset;
  /** Size of the icon square next to the node label. */
  nodeIconSize: NodeIconSize;
  /** Per-status color overrides for both node borders and edge
   * strokes. Null = use the built-in palette. */
  statusColors: StatusColors;
  /** Edge stroke width in px. 1..4, default 1.6. */
  edgeThickness: number;
  /** Whether edges render a directional arrowhead at the target end. */
  edgeArrowEnabled: boolean;
  /** Arrow marker size. 4..14 px, default 8. */
  edgeArrowSize: number;
  /** Stroke dash pattern for the IDLE state. The running/flow
   * animation overrides this while it plays. */
  edgeDashPattern: EdgeDashPattern;
  /** Idle-state stroke opacity. 0.3..1, default 0.55 (matches legacy). */
  edgeIdleOpacity: number;
  /** Number of particles rendered when flowStyle=`particles`. 1..5. */
  flowParticleCount: number;
  /** Radius of each flow orb/particle in px. 2..6, default 3.5. */
  flowParticleSize: number;
  /** Relative speed of the line-level flow animation. Independent
   * from animationSpeed which drives CSS keyframes. */
  flowSpeed: FlowSpeed;
  /** Visual flavor of the running-node glow/pulse. */
  runningPulseVariant: RunningPulseVariant;
  /** Flash animation played once when a step transitions to SUCCESS. */
  completionFlashVariant: CompletionFlashVariant;
  /** Canvas background pattern. */
  bgPattern: BgPattern;
  /** Grid cell size in px (before zoom). 10..80. */
  bgGridSize: number;
  /** Grid dot/line opacity. 0..1, default 0.55. */
  bgGridOpacity: number;
  /** Where the minimap is anchored (or hidden). */
  minimapPosition: MinimapPosition;
  /** V2: Theme variant for the editor + sidebars. Mirrors the
   *  ThemeContext value so a single store of truth drives both. */
  theme: ThemeMode;
  /** V2: Root font-size multiplier. Applied as `--font-scale` on
   *  <html> and consumed by Tailwind text utilities indirectly via
   *  the rem unit. */
  fontScale: FontScale;
  /** V2: When on, every editor animation freezes regardless of the
   *  `animationSpeed` setting. Same effect as setting animationSpeed
   *  to `off` but exposed as a clearer accessibility toggle. */
  reducedMotion: boolean;
  /** V2: Visual variant for `.rb-node` (BaseStepNode). */
  nodeVariant: NodeVariant;
  /** V2: Corner radius preset for `.rb-node`. Layered on top of
   *  variant so an operator can mix `outlined` with `extra-rounded`. */
  nodeCorners: NodeCorners;
  /** V2: Whether the colored category band atop each node renders.
   *  Off = the node is a flat card with the type icon inline. */
  nodeHeaderBand: boolean;
  /** V2: Which connection animation flavor to render on running edges. */
  flowFlavor: FlowFlavor;
}
