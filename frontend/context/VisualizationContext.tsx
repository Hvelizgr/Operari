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
export type LineStyle = 'bezier' | 'straight' | 'step';
/**
 * How the "something is flowing along this connection" animation is
 * rendered on a RUNNING or SUCCESS edge.
 * - `orbs`: a single emerald orb travels the path (classic).
 * - `dashes`: a line of short dashes march along the path.
 * - `pulse`: the whole line breathes in opacity + width.
 * - `off`: no per-frame animation on the line body.
 */
export type FlowStyle = 'orbs' | 'dashes' | 'pulse' | 'off';
/**
 * Named animation-speed presets. `off` kills every transition + keyframe
 * the same way animationsEnabled=false used to. `calm` / `default` /
 * `lively` multiply every animation duration by a factor so the
 * operator can dial the canvas from "meditative" to "snappy" without
 * ever falling off the edge into strobe territory.
 */
export type AnimationSpeed = 'off' | 'calm' | 'default' | 'lively';
/**
 * Named accent colors. Each maps to a concrete hex in applyToDocument()
 * and gets exposed as `--accent-override` for CSS, or as a direct hex
 * constant for the canvas renderer that can't use CSS variables.
 */
export type AccentColor = 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate';
/**
 * Visual shape + shadow preset for the job cards. Density controls
 * packing (padding/min-width); node style controls aesthetic (sharp
 * vs. soft vs. heavy). Orthogonal.
 */
export type NodeStyle = 'modern' | 'minimal' | 'bold' | 'neon' | 'glass';

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
}

const DEFAULTS: VisualizationPrefs = {
    animationsEnabled: true,
    animationSpeed: 'default',
    flowAnimationsEnabled: true,
    nodeDensity: 'comfortable',
    nodeStyle: 'modern',
    lineStyle: 'bezier',
    flowStyle: 'orbs',
    glowIntensity: 1,
    accentColor: 'emerald',
};

/** Hex values keyed by AccentColor. Kept in-file so the inline
 *  bootstrap script in app/layout.tsx can reuse the same mapping
 *  without another import round-trip. */
export const ACCENT_HEX: Record<AccentColor, string> = {
    emerald: '#3ecf8e',
    sky: '#0ea5e9',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    rose: '#f43f5e',
    slate: '#64748b',
};

/** Duration multiplier applied to every animation. Values >1 slow the
 *  animation down, values <1 speed it up, 0 freezes. */
const ANIMATION_SPEED_MULT: Record<AnimationSpeed, number> = {
    off: 0,
    calm: 1.5,
    default: 1,
    lively: 0.6,
};

const STORAGE_KEY = 'nanorun-visualization';

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
}

const VisualizationContext = createContext<VisualizationContextValue | null>(null);

function readStored(): VisualizationPrefs {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw) as Partial<VisualizationPrefs>;
        const merged = { ...DEFAULTS, ...parsed };
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
    // data-anim stays for backwards-compat with existing CSS rules that
    // gate transitions with html[data-anim="off"]. It's flipped to
    // "off" whenever animationSpeed is "off".
    html.setAttribute('data-anim', prefs.animationSpeed === 'off' ? 'off' : 'on');
    html.setAttribute('data-anim-speed', prefs.animationSpeed);
    html.setAttribute('data-flow', prefs.flowAnimationsEnabled ? 'on' : 'off');
    html.setAttribute('data-density', prefs.nodeDensity);
    html.setAttribute('data-node-style', prefs.nodeStyle);
    html.setAttribute('data-line-style', prefs.lineStyle);
    html.setAttribute('data-flow-style', prefs.flowStyle);
    html.setAttribute('data-accent', prefs.accentColor);
    html.style.setProperty('--editor-glow', String(prefs.glowIntensity));
    html.style.setProperty(
        '--anim-duration-mult',
        String(ANIMATION_SPEED_MULT[prefs.animationSpeed] || 1),
    );
    html.style.setProperty('--accent-override', ACCENT_HEX[prefs.accentColor]);
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
            setAnimationsEnabled: (v) =>
                update({
                    animationsEnabled: v,
                    animationSpeed: v ? (prefs.animationSpeed === 'off' ? 'default' : prefs.animationSpeed) : 'off',
                }),
            setAnimationSpeed: (v) => update({
                animationSpeed: v,
                animationsEnabled: v !== 'off',
            }),
            setFlowAnimationsEnabled: (v) => update({ flowAnimationsEnabled: v }),
            setNodeDensity: (v) => update({ nodeDensity: v }),
            setNodeStyle: (v) => update({ nodeStyle: v }),
            setLineStyle: (v) => update({ lineStyle: v }),
            setFlowStyle: (v) => update({ flowStyle: v }),
            setGlowIntensity: (v) => update({ glowIntensity: v }),
            setAccentColor: (v) => update({ accentColor: v }),
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
            setAnimationSpeed: () => { /* noop */ },
            setFlowAnimationsEnabled: () => { /* noop */ },
            setNodeDensity: () => { /* noop */ },
            setNodeStyle: () => { /* noop */ },
            setLineStyle: () => { /* noop */ },
            setFlowStyle: () => { /* noop */ },
            setGlowIntensity: () => { /* noop */ },
            setAccentColor: () => { /* noop */ },
        };
    }
    return ctx;
}
