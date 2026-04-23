/**
 * Back-compat re-export shim for the Appearance preferences module.
 *
 * The implementation lives in [./visualization/] now, split into
 * types / defaults / storage / dom / provider. Downstream code that
 * still imports from `@/context/VisualizationContext` keeps working
 * thanks to this file. New code should import from
 * `@/context/visualization` directly.
 */

export {
  ACCENT_HEX,
  ANIMATION_SPEED_MULT,
  FLOW_SPEED_MULT,
  NODE_SHADOW_HEX,
  STATUS_HEX_DEFAULTS,
  VISUALIZATION_DEFAULTS,
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
export { useVisualization, VisualizationProvider } from './visualization/VisualizationContext';
