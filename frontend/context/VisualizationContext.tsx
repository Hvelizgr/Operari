/**
 * Back-compat re-export shim for the Appearance preferences module.
 *
 * The implementation lives in [./visualization/] now, split into
 * types / defaults / storage / dom / provider. Downstream code that
 * still imports from `@/context/VisualizationContext` keeps working
 * thanks to this file. New code should import from
 * `@/context/visualization` directly.
 */

export { VisualizationProvider, useVisualization } from './visualization/VisualizationContext';
export {
  VISUALIZATION_DEFAULTS,
  ACCENT_HEX,
  STATUS_HEX_DEFAULTS,
  NODE_SHADOW_HEX,
  ANIMATION_SPEED_MULT,
  FLOW_SPEED_MULT,
} from './visualization/defaults';
export type {
  AccentColor,
  AnimationSpeed,
  BgPattern,
  CompletionFlashVariant,
  EdgeDashPattern,
  FlowSpeed,
  FlowStyle,
  LineStyle,
  MinimapPosition,
  NodeDensity,
  NodeIconSize,
  NodeShadowPreset,
  NodeStyle,
  RunningPulseVariant,
  StatusColors,
  VisualizationPrefs,
} from './visualization/types';
