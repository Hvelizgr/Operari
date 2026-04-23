'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { VISUALIZATION_DEFAULTS } from './defaults';
import { applyToDocument } from './dom';
import { readStored, writeStored } from './storage';
import type {
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
} from './types';

/**
 * React provider for Appearance prefs.
 *
 * Cross-cutting visual knobs for the editor that the user wants to
 * tune *separately* from the theme palette: how dense the nodes pack,
 * how the connections are drawn, whether the flowing-orb animation
 * runs, and so on.
 *
 * Persisted in localStorage (see ./storage) and applied to <html> as
 * `data-*` attributes (see ./dom) so CSS rules and the canvas renderer
 * can react without any prop drilling. The renderer reads
 * `data-line-style` directly off `document.documentElement` on each
 * frame, so toggles take effect immediately.
 *
 * Splitting rationale:
 * - `./types`    — unions + the `VisualizationPrefs` interface
 * - `./defaults` — factory values + hex/multiplier maps (also consumed
 *                  by the first-paint bootstrap script via JSON)
 * - `./storage`  — localStorage round-trip + legacy field upgrade
 * - `./dom`      — the `applyToDocument` single choke point
 * - this file    — just the provider + hook + setters
 */

interface VisualizationContextValue extends VisualizationPrefs {
  setAnimationsEnabled: (value: boolean) => void;
  setAnimationSpeed: (value: AnimationSpeed) => void;
  setFlowAnimationsEnabled: (value: boolean) => void;
  setNodeDensity: (value: NodeDensity) => void;
  setNodeStyle: (value: NodeStyle) => void;
  setLineStyle: (value: LineStyle) => void;
  setFlowStyle: (value: FlowStyle) => void;
  setGlowIntensity: (value: number) => void;
  setAccentColor: (value: AccentColor) => void;
  setNodeRadiusBoost: (value: number) => void;
  setNodeScale: (value: number) => void;
  setNodeShadowPreset: (value: NodeShadowPreset) => void;
  setNodeIconSize: (value: NodeIconSize) => void;
  setStatusColor: (key: keyof StatusColors, hex: string | null) => void;
  setEdgeThickness: (value: number) => void;
  setEdgeArrowEnabled: (value: boolean) => void;
  setEdgeArrowSize: (value: number) => void;
  setEdgeDashPattern: (value: EdgeDashPattern) => void;
  setEdgeIdleOpacity: (value: number) => void;
  setFlowParticleCount: (value: number) => void;
  setFlowParticleSize: (value: number) => void;
  setFlowSpeed: (value: FlowSpeed) => void;
  setRunningPulseVariant: (value: RunningPulseVariant) => void;
  setCompletionFlashVariant: (value: CompletionFlashVariant) => void;
  setBgPattern: (value: BgPattern) => void;
  setBgGridSize: (value: number) => void;
  setBgGridOpacity: (value: number) => void;
  setMinimapPosition: (value: MinimapPosition) => void;
  /** Replace every preference in one shot (used by preset apply +
   *  import). Does a deep-merge for nested objects so partial patches
   *  don't wipe the statusColors the caller didn't touch. */
  applyPrefs: (next: Partial<VisualizationPrefs>) => void;
  /** Restore every preference to the factory default. */
  resetToDefaults: () => void;
}

const VisualizationContext = createContext<VisualizationContextValue | null>(null);

export function VisualizationProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<VisualizationPrefs>(VISUALIZATION_DEFAULTS);

  useEffect(() => {
    const stored = readStored();
    setPrefs(stored);
    applyToDocument(stored);
  }, []);

  const update = useCallback((patch: Partial<VisualizationPrefs>) => {
    setPrefs(prev => {
      const next: VisualizationPrefs = {
        ...prev,
        ...patch,
        statusColors: {
          ...prev.statusColors,
          ...(patch.statusColors ?? {}),
        },
      };
      writeStored(next);
      applyToDocument(next);
      return next;
    });
  }, []);

  const value = useMemo<VisualizationContextValue>(
    () => ({
      ...prefs,
      setAnimationsEnabled: v =>
        update({
          animationsEnabled: v,
          animationSpeed: v
            ? prefs.animationSpeed === 'off'
              ? 'default'
              : prefs.animationSpeed
            : 'off',
        }),
      setAnimationSpeed: v =>
        update({
          animationSpeed: v,
          animationsEnabled: v !== 'off',
        }),
      setFlowAnimationsEnabled: v => update({ flowAnimationsEnabled: v }),
      setNodeDensity: v => update({ nodeDensity: v }),
      setNodeStyle: v => update({ nodeStyle: v }),
      setLineStyle: v => update({ lineStyle: v }),
      setFlowStyle: v => update({ flowStyle: v }),
      setGlowIntensity: v => update({ glowIntensity: v }),
      setAccentColor: v => update({ accentColor: v }),
      setNodeRadiusBoost: v => update({ nodeRadiusBoost: v }),
      setNodeScale: v => update({ nodeScale: v }),
      setNodeShadowPreset: v => update({ nodeShadowPreset: v }),
      setNodeIconSize: v => update({ nodeIconSize: v }),
      setStatusColor: (key, hex) => update({ statusColors: { ...prefs.statusColors, [key]: hex } }),
      setEdgeThickness: v => update({ edgeThickness: v }),
      setEdgeArrowEnabled: v => update({ edgeArrowEnabled: v }),
      setEdgeArrowSize: v => update({ edgeArrowSize: v }),
      setEdgeDashPattern: v => update({ edgeDashPattern: v }),
      setEdgeIdleOpacity: v => update({ edgeIdleOpacity: v }),
      setFlowParticleCount: v => update({ flowParticleCount: v }),
      setFlowParticleSize: v => update({ flowParticleSize: v }),
      setFlowSpeed: v => update({ flowSpeed: v }),
      setRunningPulseVariant: v => update({ runningPulseVariant: v }),
      setCompletionFlashVariant: v => update({ completionFlashVariant: v }),
      setBgPattern: v => update({ bgPattern: v }),
      setBgGridSize: v => update({ bgGridSize: v }),
      setBgGridOpacity: v => update({ bgGridOpacity: v }),
      setMinimapPosition: v => update({ minimapPosition: v }),
      applyPrefs: next => update(next),
      resetToDefaults: () => update(VISUALIZATION_DEFAULTS),
    }),
    [prefs, update]
  );

  return <VisualizationContext.Provider value={value}>{children}</VisualizationContext.Provider>;
}

export function useVisualization(): VisualizationContextValue {
  const ctx = useContext(VisualizationContext);
  if (!ctx) {
    // SSR-safe fallback so marketing and other no-provider pages
    // don't crash if a component reaches in defensively.
    const noop = () => {
      /* noop */
    };
    return {
      ...VISUALIZATION_DEFAULTS,
      setAnimationsEnabled: noop,
      setAnimationSpeed: noop,
      setFlowAnimationsEnabled: noop,
      setNodeDensity: noop,
      setNodeStyle: noop,
      setLineStyle: noop,
      setFlowStyle: noop,
      setGlowIntensity: noop,
      setAccentColor: noop,
      setNodeRadiusBoost: noop,
      setNodeScale: noop,
      setNodeShadowPreset: noop,
      setNodeIconSize: noop,
      setStatusColor: noop,
      setEdgeThickness: noop,
      setEdgeArrowEnabled: noop,
      setEdgeArrowSize: noop,
      setEdgeDashPattern: noop,
      setEdgeIdleOpacity: noop,
      setFlowParticleCount: noop,
      setFlowParticleSize: noop,
      setFlowSpeed: noop,
      setRunningPulseVariant: noop,
      setCompletionFlashVariant: noop,
      setBgPattern: noop,
      setBgGridSize: noop,
      setBgGridOpacity: noop,
      setMinimapPosition: noop,
      applyPrefs: noop,
      resetToDefaults: noop,
    };
  }
  return ctx;
}
