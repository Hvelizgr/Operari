import { VISUALIZATION_DEFAULTS } from './defaults';
import type { VisualizationPrefs } from './types';

/** localStorage key used to persist the Appearance preferences across
 *  reloads. Also referenced verbatim by the first-paint bootstrap
 *  script in [app/layout.tsx] — update that script if you rename this. */
export const STORAGE_KEY = 'operari-visualization';

/**
 * Load the user's saved visualization preferences, merging with
 * factory defaults so newly-added fields don't leave `undefined` in
 * legacy payloads. Also derives `animationSpeed` from the pre-pivot
 * boolean `animationsEnabled` so a user who turned animations off
 * before the Appearance page existed sees them stay off.
 */
export function readStored(): VisualizationPrefs {
  if (typeof window === 'undefined') return VISUALIZATION_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return VISUALIZATION_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<VisualizationPrefs>;
    const merged: VisualizationPrefs = {
      ...VISUALIZATION_DEFAULTS,
      ...parsed,
      statusColors: {
        ...VISUALIZATION_DEFAULTS.statusColors,
        ...(parsed.statusColors ?? {}),
      },
    };
    // Backwards-compat: older payloads only have the boolean
    // `animationsEnabled` field. Derive `animationSpeed` from it so
    // an upgrade keeps the user's "animations off" choice without
    // forcing them back through Settings.
    if (!parsed.animationSpeed && typeof parsed.animationsEnabled === 'boolean') {
      merged.animationSpeed = parsed.animationsEnabled ? 'default' : 'off';
    }
    // Keep the boolean mirror in sync with the named speed so any
    // downstream code still reading the old field behaves correctly.
    merged.animationsEnabled = merged.animationSpeed !== 'off';
    return merged;
  } catch {
    return VISUALIZATION_DEFAULTS;
  }
}

export function writeStored(prefs: VisualizationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* noop — localStorage full, blocked by privacy settings, or
     * running in a context where it isn't available. The in-memory
     * prefs still work for the current session. */
  }
}
