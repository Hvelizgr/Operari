import { VISUALIZATION_DEFAULTS, type VisualizationPrefs } from '@/context/VisualizationContext';

import type { Strings } from './strings';

export interface BuiltinPreset {
  id: string;
  labelKey: keyof Strings;
  descriptionKey: keyof Strings;
  patch: Partial<VisualizationPrefs>;
}

/**
 * Curated visual presets. Each `patch` is merged over the current
 * prefs (via applyPrefs) so picking one doesn't reset the prefs the
 * preset didn't touch — the user can layer a preset onto their
 * existing work.
 */
export const BUILTIN_PRESETS: BuiltinPreset[] = [
  {
    id: 'default',
    labelKey: 'presetDefaultLabel',
    descriptionKey: 'presetDefaultDesc',
    patch: VISUALIZATION_DEFAULTS,
  },
  {
    id: 'neon',
    labelKey: 'presetNeonLabel',
    descriptionKey: 'presetNeonDesc',
    patch: {
      nodeStyle: 'neon',
      accentColor: 'violet',
      flowStyle: 'dashes',
      glowIntensity: 1.8,
      nodeShadowPreset: 'xl',
      runningPulseVariant: 'wave',
      edgeThickness: 2,
      bgPattern: 'dots',
      bgGridOpacity: 0.35,
    },
  },
  {
    id: 'minimal-print',
    labelKey: 'presetMinimalLabel',
    descriptionKey: 'presetMinimalDesc',
    patch: {
      nodeStyle: 'minimal',
      accentColor: 'slate',
      flowStyle: 'off',
      animationSpeed: 'off',
      nodeShadowPreset: 'none',
      glowIntensity: 0,
      edgeThickness: 1,
      edgeArrowEnabled: true,
      bgPattern: 'none',
      runningPulseVariant: 'none',
      completionFlashVariant: 'none',
    },
  },
  {
    id: 'retro-crt',
    labelKey: 'presetRetroLabel',
    descriptionKey: 'presetRetroDesc',
    patch: {
      nodeStyle: 'bold',
      accentColor: 'emerald',
      flowStyle: 'comet',
      flowSpeed: 'slow',
      lineStyle: 'step',
      glowIntensity: 2,
      bgPattern: 'lines',
      bgGridOpacity: 0.3,
      runningPulseVariant: 'ripple',
      edgeThickness: 2.4,
    },
  },
  {
    id: 'midnight-flow',
    labelKey: 'presetMidnightLabel',
    descriptionKey: 'presetMidnightDesc',
    patch: {
      nodeStyle: 'glass',
      accentColor: 'sky',
      flowStyle: 'gradient',
      flowSpeed: 'normal',
      glowIntensity: 1.4,
      bgPattern: 'dots',
      runningPulseVariant: 'breathe',
      edgeDashPattern: 'short-dash',
      nodeShadowPreset: 'lg',
    },
  },
  {
    id: 'neo-brutalism',
    labelKey: 'presetBrutalismLabel',
    descriptionKey: 'presetBrutalismDesc',
    patch: {
      nodeStyle: 'bold',
      accentColor: 'amber',
      flowStyle: 'dashes',
      lineStyle: 'step',
      nodeShadowPreset: 'xl',
      nodeRadiusBoost: 0,
      edgeThickness: 3,
      edgeArrowEnabled: true,
      edgeArrowSize: 12,
      bgPattern: 'grid',
      glowIntensity: 0,
      runningPulseVariant: 'none',
    },
  },
];

export const CUSTOM_PRESETS_KEY = 'operari-appearance-presets';
/** Hard cap so a user who clicks "Save" forever can't blow their
 *  localStorage quota. Well above any realistic use (the UI surfaces
 *  the cap when it trips). */
export const MAX_CUSTOM_PRESETS = 20;

export interface CustomPreset {
  id: string;
  name: string;
  patch: VisualizationPrefs;
}

export function loadCustomPresets(): CustomPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: CustomPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* noop — localStorage full or blocked; the in-memory list
     * still works for the current session. */
  }
}

/**
 * Pull just the persisted prefs out of the context value. The context
 * returns setters mixed in with the state, so this strips those away
 * before the payload gets serialized to a preset or JSON export.
 */
export function extractPrefs(source: VisualizationPrefs): VisualizationPrefs {
  return {
    animationsEnabled: source.animationsEnabled,
    animationSpeed: source.animationSpeed,
    flowAnimationsEnabled: source.flowAnimationsEnabled,
    nodeDensity: source.nodeDensity,
    nodeStyle: source.nodeStyle,
    lineStyle: source.lineStyle,
    flowStyle: source.flowStyle,
    glowIntensity: source.glowIntensity,
    accentColor: source.accentColor,
    nodeRadiusBoost: source.nodeRadiusBoost,
    nodeScale: source.nodeScale,
    nodeShadowPreset: source.nodeShadowPreset,
    nodeIconSize: source.nodeIconSize,
    statusColors: { ...source.statusColors },
    edgeThickness: source.edgeThickness,
    edgeArrowEnabled: source.edgeArrowEnabled,
    edgeArrowSize: source.edgeArrowSize,
    edgeDashPattern: source.edgeDashPattern,
    edgeIdleOpacity: source.edgeIdleOpacity,
    flowParticleCount: source.flowParticleCount,
    flowParticleSize: source.flowParticleSize,
    flowSpeed: source.flowSpeed,
    runningPulseVariant: source.runningPulseVariant,
    completionFlashVariant: source.completionFlashVariant,
    bgPattern: source.bgPattern,
    bgGridSize: source.bgGridSize,
    bgGridOpacity: source.bgGridOpacity,
    minimapPosition: source.minimapPosition,
    theme: source.theme,
    fontScale: source.fontScale,
    reducedMotion: source.reducedMotion,
    nodeVariant: source.nodeVariant,
    nodeCorners: source.nodeCorners,
    nodeHeaderBand: source.nodeHeaderBand,
    nodeShape: source.nodeShape,
    nodeDensityV2: source.nodeDensityV2,
    flowFlavor: source.flowFlavor,
  };
}
