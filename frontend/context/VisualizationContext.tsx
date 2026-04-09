'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

/**
 * NanoRun visualization preferences.
 *
 * Cross-cutting visual knobs for the editor that the user wants to
 * tune *separately* from the theme palette: how dense the nodes pack,
 * how the connections are drawn, whether the flowing-orb animation
 * runs, and so on.
 *
 * Persisted in localStorage and applied to <html> as `data-*`
 * attributes so CSS rules and the canvas renderer can react without
 * any prop drilling. The renderer reads `data-line-style` directly
 * off `document.documentElement` on each frame, so toggles take
 * effect immediately.
 */

export type NodeDensity = 'compact' | 'comfortable' | 'spacious';
export type LineStyle = 'bezier' | 'straight';

export interface VisualizationPrefs {
    /** Master switch for ALL editor animations (CSS keyframes + canvas
     * flow orbs + framer-motion transitions). Default true. */
    animationsEnabled: boolean;
    /** Just the canvas flow orbs (the dashed dance and traveling
     * micro-mouse on running connections). Default true. */
    flowAnimationsEnabled: boolean;
    /** How tightly nodes pack on the canvas. Maps to padding +
     * border-radius CSS variables. */
    nodeDensity: NodeDensity;
    /** Renderer mode for connection lines. */
    lineStyle: LineStyle;
    /** Glow intensity (0..2). 1 = default. 0 = no shadows. */
    glowIntensity: number;
}

const DEFAULTS: VisualizationPrefs = {
    animationsEnabled: true,
    flowAnimationsEnabled: true,
    nodeDensity: 'comfortable',
    lineStyle: 'bezier',
    glowIntensity: 1,
};

const STORAGE_KEY = 'nanorun-visualization';

interface VisualizationContextValue extends VisualizationPrefs {
    setAnimationsEnabled: (value: boolean) => void;
    setFlowAnimationsEnabled: (value: boolean) => void;
    setNodeDensity: (value: NodeDensity) => void;
    setLineStyle: (value: LineStyle) => void;
    setGlowIntensity: (value: number) => void;
}

const VisualizationContext = createContext<VisualizationContextValue | null>(null);

function readStored(): VisualizationPrefs {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
    } catch {
        return DEFAULTS;
    }
}

function writeStored(prefs: VisualizationPrefs) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        /* noop */
    }
}

function applyToDocument(prefs: VisualizationPrefs) {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.setAttribute('data-anim', prefs.animationsEnabled ? 'on' : 'off');
    html.setAttribute('data-flow', prefs.flowAnimationsEnabled ? 'on' : 'off');
    html.setAttribute('data-density', prefs.nodeDensity);
    html.setAttribute('data-line-style', prefs.lineStyle);
    html.style.setProperty('--editor-glow', String(prefs.glowIntensity));
}

export function VisualizationProvider({ children }: { children: React.ReactNode }) {
    const [prefs, setPrefs] = useState<VisualizationPrefs>(DEFAULTS);

    useEffect(() => {
        const stored = readStored();
        setPrefs(stored);
        applyToDocument(stored);
    }, []);

    const update = useCallback((patch: Partial<VisualizationPrefs>) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            writeStored(next);
            applyToDocument(next);
            return next;
        });
    }, []);

    const value = useMemo<VisualizationContextValue>(
        () => ({
            ...prefs,
            setAnimationsEnabled: (v) => update({ animationsEnabled: v }),
            setFlowAnimationsEnabled: (v) => update({ flowAnimationsEnabled: v }),
            setNodeDensity: (v) => update({ nodeDensity: v }),
            setLineStyle: (v) => update({ lineStyle: v }),
            setGlowIntensity: (v) => update({ glowIntensity: v }),
        }),
        [prefs, update],
    );

    return (
        <VisualizationContext.Provider value={value}>
            {children}
        </VisualizationContext.Provider>
    );
}

export function useVisualization(): VisualizationContextValue {
    const ctx = useContext(VisualizationContext);
    if (!ctx) {
        // SSR-safe fallback so marketing and other no-provider pages
        // don't crash if a component reaches in defensively.
        return {
            ...DEFAULTS,
            setAnimationsEnabled: () => { /* noop */ },
            setFlowAnimationsEnabled: () => { /* noop */ },
            setNodeDensity: () => { /* noop */ },
            setLineStyle: () => { /* noop */ },
            setGlowIntensity: () => { /* noop */ },
        };
    }
    return ctx;
}
