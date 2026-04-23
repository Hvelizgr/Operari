import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  VisualizationProvider,
  useVisualization,
  VISUALIZATION_DEFAULTS,
} from '@/context/VisualizationContext';
import type { VisualizationPrefs } from '@/context/VisualizationContext';
import {
  extractPrefs,
  loadCustomPresets,
  saveCustomPresets,
  MAX_CUSTOM_PRESETS,
  CUSTOM_PRESETS_KEY,
} from '@/components/Settings/appearance/presets';
import type { CustomPreset } from '@/components/Settings/appearance/presets';

/* ─────────────────────────────────────────────────────────────
   Tests for the Appearance preferences plumbing.

   Covers:
   - Defaults are applied on first render with an empty localStorage.
   - Back-compat with the pre-Appearance `animationsEnabled` boolean
     (older payloads should derive the new `animationSpeed` field).
   - Partial updates via setters preserve every other field.
   - applyPrefs() performs a deep merge for nested objects (statusColors).
   - resetToDefaults() restores every field.
   - statusColors.null sends removeProperty() so CSS fallback works.
   - extractPrefs() strips setter functions from the context value.
   - Custom preset cap at MAX_CUSTOM_PRESETS.
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'nanorun-visualization';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VisualizationProvider>{children}</VisualizationProvider>
);

/** Minimal wrapper around window.localStorage that tracks calls without
 *  actually persisting anything between tests. Saves from leaking
 *  state across tests and lets us assert set/get behavior directly. */
function setupLocalStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  Storage.prototype.getItem = jest.fn((key: string) => store[key] ?? null);
  Storage.prototype.setItem = jest.fn((key: string, value: string) => {
    store[key] = value;
  });
  Storage.prototype.removeItem = jest.fn((key: string) => {
    delete store[key];
  });
  return store;
}

beforeEach(() => {
  // Clear any document.documentElement inline styles/attrs that a
  // previous test's applyToDocument() wrote.
  document.documentElement.removeAttribute('data-anim');
  document.documentElement.removeAttribute('data-anim-speed');
  document.documentElement.removeAttribute('data-flow');
  document.documentElement.removeAttribute('data-density');
  document.documentElement.removeAttribute('data-node-style');
  document.documentElement.removeAttribute('data-line-style');
  document.documentElement.removeAttribute('data-flow-style');
  document.documentElement.removeAttribute('data-accent');
  document.documentElement.removeAttribute('data-node-shadow');
  document.documentElement.removeAttribute('data-node-icon');
  document.documentElement.removeAttribute('data-edge-dash');
  document.documentElement.removeAttribute('data-edge-arrow');
  document.documentElement.removeAttribute('data-flow-speed');
  document.documentElement.removeAttribute('data-pulse-variant');
  document.documentElement.removeAttribute('data-flash-variant');
  document.documentElement.removeAttribute('data-bg-pattern');
  document.documentElement.removeAttribute('data-minimap');
  document.documentElement.removeAttribute('style');
});

describe('VisualizationContext defaults', () => {
  it('applies factory defaults when localStorage is empty', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    expect(result.current.animationSpeed).toBe('default');
    expect(result.current.nodeStyle).toBe('modern');
    expect(result.current.flowStyle).toBe('orbs');
    expect(result.current.accentColor).toBe('emerald');
    expect(result.current.nodeScale).toBe(1);
    expect(result.current.edgeThickness).toBe(1.6);
    expect(result.current.bgPattern).toBe('dots');
    expect(result.current.minimapPosition).toBe('bottom-right');
  });

  it('reflects defaults on <html> data-* attributes on mount', () => {
    setupLocalStorage();
    renderHook(() => useVisualization(), { wrapper });

    const html = document.documentElement;
    expect(html.getAttribute('data-anim')).toBe('on');
    expect(html.getAttribute('data-line-style')).toBe('bezier');
    expect(html.getAttribute('data-flow-style')).toBe('orbs');
    expect(html.getAttribute('data-bg-pattern')).toBe('dots');
    expect(html.style.getPropertyValue('--edge-thickness')).toBe('1.6');
  });
});

describe('VisualizationContext back-compat', () => {
  it('derives animationSpeed from legacy animationsEnabled=false', () => {
    setupLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ animationsEnabled: false }),
    });
    const { result } = renderHook(() => useVisualization(), { wrapper });
    expect(result.current.animationSpeed).toBe('off');
    expect(result.current.animationsEnabled).toBe(false);
  });

  it('derives animationSpeed from legacy animationsEnabled=true', () => {
    setupLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ animationsEnabled: true }),
    });
    const { result } = renderHook(() => useVisualization(), { wrapper });
    expect(result.current.animationSpeed).toBe('default');
  });

  it('fills in new fields when a legacy payload is missing them', () => {
    setupLocalStorage({
      [STORAGE_KEY]: JSON.stringify({
        animationsEnabled: true,
        nodeDensity: 'compact',
        nodeStyle: 'bold',
        accentColor: 'violet',
      }),
    });
    const { result } = renderHook(() => useVisualization(), { wrapper });

    // Legacy fields survive.
    expect(result.current.nodeDensity).toBe('compact');
    expect(result.current.nodeStyle).toBe('bold');
    expect(result.current.accentColor).toBe('violet');
    // New fields come from defaults.
    expect(result.current.nodeRadiusBoost).toBe(0);
    expect(result.current.nodeScale).toBe(1);
    expect(result.current.edgeThickness).toBe(1.6);
    expect(result.current.statusColors).toEqual({
      running: null,
      success: null,
      failed: null,
      idle: null,
    });
  });

  it('recovers from malformed JSON by falling back to defaults', () => {
    setupLocalStorage({ [STORAGE_KEY]: '{not valid json' });
    const { result } = renderHook(() => useVisualization(), { wrapper });
    expect(result.current.nodeStyle).toBe('modern');
    expect(result.current.flowStyle).toBe('orbs');
  });
});

describe('VisualizationContext setters', () => {
  it('updates a single field without touching others', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => result.current.setAccentColor('violet'));
    expect(result.current.accentColor).toBe('violet');
    // Every other field untouched.
    expect(result.current.nodeStyle).toBe('modern');
    expect(result.current.flowStyle).toBe('orbs');
  });

  it('setStatusColor merges into statusColors without overwriting siblings', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => result.current.setStatusColor('running', '#ff00ff'));
    expect(result.current.statusColors.running).toBe('#ff00ff');
    expect(result.current.statusColors.success).toBeNull();

    act(() => result.current.setStatusColor('success', '#00ff00'));
    expect(result.current.statusColors.running).toBe('#ff00ff');
    expect(result.current.statusColors.success).toBe('#00ff00');
  });

  it('setStatusColor(null) clears the override and removes the inline CSS var', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => result.current.setStatusColor('running', '#ff00ff'));
    expect(document.documentElement.style.getPropertyValue('--status-running')).toBe('#ff00ff');

    act(() => result.current.setStatusColor('running', null));
    expect(result.current.statusColors.running).toBeNull();
    // Gate selector `html[style*="--status-running:"]` must not match
    // after a reset — property fully removed.
    expect(document.documentElement.style.getPropertyValue('--status-running')).toBe('');
    expect(document.documentElement.getAttribute('style') ?? '').not.toContain('--status-running');
  });

  it('setAnimationSpeed("off") keeps animationsEnabled in sync', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => result.current.setAnimationSpeed('off'));
    expect(result.current.animationSpeed).toBe('off');
    expect(result.current.animationsEnabled).toBe(false);
    expect(document.documentElement.getAttribute('data-anim')).toBe('off');
  });
});

describe('VisualizationContext applyPrefs + reset', () => {
  it('applyPrefs merges statusColors deeply', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => result.current.setStatusColor('running', '#abcdef'));
    act(() => result.current.applyPrefs({ statusColors: { success: '#123456' } as any }));

    // success got patched, running survived, failed/idle remain null.
    expect(result.current.statusColors.running).toBe('#abcdef');
    expect(result.current.statusColors.success).toBe('#123456');
    expect(result.current.statusColors.failed).toBeNull();
    expect(result.current.statusColors.idle).toBeNull();
  });

  it('applyPrefs does not wipe untouched fields', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => result.current.setAccentColor('sky'));
    act(() => result.current.applyPrefs({ nodeStyle: 'neon' }));

    expect(result.current.nodeStyle).toBe('neon');
    expect(result.current.accentColor).toBe('sky'); // preserved
  });

  it('resetToDefaults restores every field to the baseline', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    act(() => {
      result.current.setAccentColor('rose');
      result.current.setNodeStyle('neon');
      result.current.setFlowStyle('comet');
      result.current.setStatusColor('failed', '#ff0000');
    });
    act(() => result.current.resetToDefaults());

    expect(result.current.accentColor).toBe(VISUALIZATION_DEFAULTS.accentColor);
    expect(result.current.nodeStyle).toBe(VISUALIZATION_DEFAULTS.nodeStyle);
    expect(result.current.flowStyle).toBe(VISUALIZATION_DEFAULTS.flowStyle);
    expect(result.current.statusColors).toEqual(VISUALIZATION_DEFAULTS.statusColors);
  });
});

describe('extractPrefs', () => {
  it('returns just the persisted prefs (no setter functions)', () => {
    setupLocalStorage();
    const { result } = renderHook(() => useVisualization(), { wrapper });

    const extracted = extractPrefs(result.current);
    // Shape matches VisualizationPrefs exactly.
    const keys = Object.keys(extracted).sort();
    const expectedKeys = Object.keys(VISUALIZATION_DEFAULTS).sort();
    expect(keys).toEqual(expectedKeys);
    // No function values leaked in.
    for (const value of Object.values(extracted)) {
      expect(typeof value).not.toBe('function');
    }
  });

  it('deep-clones statusColors so further mutations do not leak back', () => {
    const source: VisualizationPrefs = {
      ...VISUALIZATION_DEFAULTS,
      statusColors: { running: '#ff0000', success: null, failed: null, idle: null },
    };
    const extracted = extractPrefs(source);
    extracted.statusColors.running = '#00ff00';
    expect(source.statusColors.running).toBe('#ff0000');
  });
});

describe('custom presets', () => {
  it('loadCustomPresets returns [] when storage is empty', () => {
    setupLocalStorage();
    expect(loadCustomPresets()).toEqual([]);
  });

  it('loadCustomPresets recovers from malformed JSON', () => {
    setupLocalStorage({ [CUSTOM_PRESETS_KEY]: '{garbage' });
    expect(loadCustomPresets()).toEqual([]);
  });

  it('loadCustomPresets rejects non-array payloads', () => {
    setupLocalStorage({ [CUSTOM_PRESETS_KEY]: '{"not":"an array"}' });
    expect(loadCustomPresets()).toEqual([]);
  });

  it('saveCustomPresets round-trips an array via localStorage', () => {
    const store = setupLocalStorage();
    const preset: CustomPreset = {
      id: 'c-1',
      name: 'My preset',
      patch: VISUALIZATION_DEFAULTS,
    };
    saveCustomPresets([preset]);
    expect(store[CUSTOM_PRESETS_KEY]).toBe(JSON.stringify([preset]));
    expect(loadCustomPresets()).toEqual([preset]);
  });

  it('exposes MAX_CUSTOM_PRESETS as a sane upper bound (>0, <1000)', () => {
    expect(MAX_CUSTOM_PRESETS).toBeGreaterThan(0);
    expect(MAX_CUSTOM_PRESETS).toBeLessThan(1000);
  });
});
