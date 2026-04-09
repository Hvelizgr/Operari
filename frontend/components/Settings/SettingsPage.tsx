'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Settings as SettingsIcon,
    Palette,
    Save,
    Grid3x3,
    Languages,
    User,
    Check,
    Sparkles,
    Box as BoxIcon,
    Spline,
    Zap as ZapIcon,
} from 'lucide-react';
import { THEMES, useTheme, type Theme } from '@/context/ThemeContext';
import { useVisualization, type NodeDensity, type LineStyle } from '@/context/VisualizationContext';

const STRINGS = {
    en: {
        title: 'Settings',
        subtitle:
            'Personal preferences for the editor and the app shell. Stored locally on this device — they survive reloads but do not sync across machines yet.',
        themeTitle: 'Theme',
        themeHint: 'Pick the palette used by the dashboard, the editor, and every page chrome.',
        editorTitle: 'Editor',
        autosaveLabel: 'Autosave',
        autosaveHint: 'Persist changes every 2 seconds to localStorage and the backend.',
        snapLabel: 'Snap to grid',
        snapHint: 'When dragging a node, round its position to the nearest 20px.',
        langTitle: 'Language',
        langHint: 'Switch the UI between English and Spanish.',
        en: 'English',
        es: 'Español',
        profileTitle: 'Profile',
        profileHint: 'User profile sync is not wired in self-host mode yet.',
        profilePlaceholder: 'You are signed in as the default tenant admin.',
        on: 'On',
        off: 'Off',
        // Visualization
        vizTitle: 'Editor visualization',
        vizHint: 'Tune how nodes, lines and animations look on the canvas.',
        densityLabel: 'Node density',
        densityHint: 'How tightly nodes pack on the canvas.',
        densityCompact: 'Compact',
        densityComfortable: 'Comfortable',
        densitySpacious: 'Spacious',
        animLabel: 'Animations',
        animHint: 'Master switch for editor transitions and the running-node pulse.',
        flowLabel: 'Flow particles',
        flowHint: 'The blue orbs that travel along connections while a step is running.',
        lineStyleLabel: 'Connection style',
        lineStyleHint: 'How connection lines are drawn between steps.',
        lineBezier: 'Bezier (curved)',
        lineStraight: 'Straight',
        glowLabel: 'Glow intensity',
        glowHint: '0 = no shadow on running nodes. 1 = default. 2 = brighter.',
    },
    es: {
        title: 'Configuración',
        subtitle:
            'Preferencias personales del editor y del shell. Se guardan en este dispositivo — sobreviven recargas pero todavía no sincronizan entre máquinas.',
        themeTitle: 'Tema',
        themeHint: 'Elegí la paleta del dashboard, el editor y todas las páginas.',
        editorTitle: 'Editor',
        autosaveLabel: 'Autoguardado',
        autosaveHint: 'Persiste cambios cada 2 segundos a localStorage y al backend.',
        snapLabel: 'Snap a la grilla',
        snapHint: 'Al arrastrar un nodo, redondear su posición al múltiplo de 20px más cercano.',
        langTitle: 'Idioma',
        langHint: 'Cambiá la UI entre inglés y español.',
        en: 'English',
        es: 'Español',
        profileTitle: 'Perfil',
        profileHint: 'La sincronización de perfil todavía no está cableada en self-host.',
        profilePlaceholder: 'Estás autenticado como admin del tenant por defecto.',
        on: 'Encendido',
        off: 'Apagado',
        // Visualization
        vizTitle: 'Visualización del editor',
        vizHint: 'Ajustá cómo se ven los nodos, líneas y animaciones en el canvas.',
        densityLabel: 'Densidad de nodos',
        densityHint: 'Qué tan compacto empaquetan los nodos en el canvas.',
        densityCompact: 'Compacto',
        densityComfortable: 'Cómodo',
        densitySpacious: 'Espacioso',
        animLabel: 'Animaciones',
        animHint: 'Switch maestro para transiciones del editor y el pulso de nodos en ejecución.',
        flowLabel: 'Partículas de flujo',
        flowHint: 'Los orbes azules que viajan por las conexiones mientras un step corre.',
        lineStyleLabel: 'Estilo de conexión',
        lineStyleHint: 'Cómo se dibujan las líneas entre steps.',
        lineBezier: 'Bezier (curva)',
        lineStraight: 'Recta',
        glowLabel: 'Intensidad del brillo',
        glowHint: '0 = sin sombra en nodos en ejecución. 1 = default. 2 = más brillante.',
    },
} as const;

interface SettingsPageProps {
    lang: 'en' | 'es';
}

export default function SettingsPage({ lang }: SettingsPageProps) {
    const t = STRINGS[lang];
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const viz = useVisualization();
    const [autosave, setAutosave] = useState<boolean>(true);
    const [snap, setSnap] = useState<boolean>(false);

    useEffect(() => {
        try {
            setAutosave(localStorage.getItem('nanoflow-autosave-enabled') !== 'false');
            setSnap(localStorage.getItem('nanorun-editor-snap-to-grid') === '1');
        } catch {
            /* noop */
        }
    }, []);

    const handleAutosave = (next: boolean) => {
        setAutosave(next);
        try {
            localStorage.setItem('nanoflow-autosave-enabled', next ? 'true' : 'false');
        } catch { /* noop */ }
    };

    const handleSnap = (next: boolean) => {
        setSnap(next);
        try {
            localStorage.setItem('nanorun-editor-snap-to-grid', next ? '1' : '0');
        } catch { /* noop */ }
    };

    const switchLang = (target: 'en' | 'es') => {
        if (target === lang) return;
        // Replace the first segment of the URL.
        const path = window.location.pathname.replace(/^\/(en|es)/, `/${target}`);
        router.push(path + window.location.search);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <SettingsIcon size={22} className="text-[var(--accent-color)]" />
                        {t.title}
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">{t.subtitle}</p>
                </div>

                {/* Theme picker */}
                <Section icon={<Palette size={16} />} title={t.themeTitle} hint={t.themeHint}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {THEMES.map((opt) => (
                            <ThemeCard
                                key={opt.id}
                                id={opt.id}
                                label={opt.label[lang]}
                                description={opt.description[lang]}
                                active={theme === opt.id}
                                onClick={() => setTheme(opt.id)}
                            />
                        ))}
                    </div>
                </Section>

                {/* Editor preferences */}
                <Section icon={<Save size={16} />} title={t.editorTitle}>
                    <ToggleRow
                        label={t.autosaveLabel}
                        hint={t.autosaveHint}
                        value={autosave}
                        onChange={handleAutosave}
                        on={t.on}
                        off={t.off}
                    />
                    <ToggleRow
                        icon={<Grid3x3 size={14} />}
                        label={t.snapLabel}
                        hint={t.snapHint}
                        value={snap}
                        onChange={handleSnap}
                        on={t.on}
                        off={t.off}
                    />
                </Section>

                {/* Visualization preferences */}
                <Section
                    icon={<Sparkles size={16} />}
                    title={t.vizTitle}
                    hint={t.vizHint}
                >
                    {/* Density picker */}
                    <div className="py-2 border-t border-[var(--panel-border)] first:border-t-0">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <BoxIcon size={14} />
                            {t.densityLabel}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.densityHint}
                        </div>
                        <div className="flex gap-2">
                            {(
                                [
                                    { id: 'compact' as NodeDensity, label: t.densityCompact },
                                    { id: 'comfortable' as NodeDensity, label: t.densityComfortable },
                                    { id: 'spacious' as NodeDensity, label: t.densitySpacious },
                                ]
                            ).map((opt) => (
                                <PillButton
                                    key={opt.id}
                                    active={viz.nodeDensity === opt.id}
                                    onClick={() => viz.setNodeDensity(opt.id)}
                                >
                                    {opt.label}
                                </PillButton>
                            ))}
                        </div>
                    </div>

                    {/* Line style picker */}
                    <div className="py-2 border-t border-[var(--panel-border)]">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <Spline size={14} />
                            {t.lineStyleLabel}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.lineStyleHint}
                        </div>
                        <div className="flex gap-2">
                            {(
                                [
                                    { id: 'bezier' as LineStyle, label: t.lineBezier },
                                    { id: 'straight' as LineStyle, label: t.lineStraight },
                                ]
                            ).map((opt) => (
                                <PillButton
                                    key={opt.id}
                                    active={viz.lineStyle === opt.id}
                                    onClick={() => viz.setLineStyle(opt.id)}
                                >
                                    {opt.label}
                                </PillButton>
                            ))}
                        </div>
                    </div>

                    {/* Animations toggle */}
                    <ToggleRow
                        icon={<Sparkles size={14} />}
                        label={t.animLabel}
                        hint={t.animHint}
                        value={viz.animationsEnabled}
                        onChange={viz.setAnimationsEnabled}
                        on={t.on}
                        off={t.off}
                    />

                    {/* Flow particles toggle */}
                    <ToggleRow
                        icon={<ZapIcon size={14} />}
                        label={t.flowLabel}
                        hint={t.flowHint}
                        value={viz.flowAnimationsEnabled}
                        onChange={viz.setFlowAnimationsEnabled}
                        on={t.on}
                        off={t.off}
                    />

                    {/* Glow intensity slider */}
                    <div className="py-2 border-t border-[var(--panel-border)]">
                        <div className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                            <span>{t.glowLabel}</span>
                            <span className="text-xs text-[var(--text-muted)] font-mono">
                                {viz.glowIntensity.toFixed(1)}x
                            </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.glowHint}
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={2}
                            step={0.1}
                            value={viz.glowIntensity}
                            onChange={(e) => viz.setGlowIntensity(parseFloat(e.target.value))}
                            className="w-full accent-[var(--accent-color)]"
                        />
                    </div>
                </Section>

                {/* Language */}
                <Section icon={<Languages size={16} />} title={t.langTitle} hint={t.langHint}>
                    <div className="flex gap-2">
                        <LangButton active={lang === 'en'} onClick={() => switchLang('en')}>
                            {t.en}
                        </LangButton>
                        <LangButton active={lang === 'es'} onClick={() => switchLang('es')}>
                            {t.es}
                        </LangButton>
                    </div>
                </Section>

                {/* Profile placeholder */}
                <Section icon={<User size={16} />} title={t.profileTitle} hint={t.profileHint}>
                    <div className="text-sm text-[var(--text-muted)]">{t.profilePlaceholder}</div>
                </Section>
            </div>
        </div>
    );
}

function Section({
    icon,
    title,
    hint,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-6 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {icon}
                <span>{title}</span>
            </div>
            {hint && (
                <p className="text-[11px] text-[var(--text-muted)] mb-3">{hint}</p>
            )}
            {children}
        </div>
    );
}

function ThemeCard({
    id,
    label,
    description,
    active,
    onClick,
}: {
    id: Theme;
    label: string;
    description: string;
    active: boolean;
    onClick: () => void;
}) {
    // Hardcoded preview palettes mirror globals.css so the user sees
    // what the theme actually looks like before committing.
    const preview =
        id === 'light'
            ? { bg: '#f8fafc', panel: '#ffffff', accent: '#3b82f6', border: '#e2e8f0' }
            : id === 'dark'
              ? { bg: '#0f1218', panel: '#1a1f2a', accent: '#3b82f6', border: '#2a2f3a' }
              : { bg: '#050608', panel: '#0c0e13', accent: '#818cf8', border: '#1e293b' };

    return (
        <button
            onClick={onClick}
            className={`text-left rounded-md p-3 transition-colors border ${
                active
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                    : 'border-[var(--panel-border)] hover:border-[var(--accent-color)]/50'
            }`}
        >
            <div
                className="rounded-md mb-3 p-3 border"
                style={{
                    background: preview.bg,
                    borderColor: preview.border,
                }}
            >
                <div
                    className="rounded p-2 mb-1"
                    style={{ background: preview.panel, border: `1px solid ${preview.border}` }}
                >
                    <div className="flex gap-1 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: preview.accent }} />
                        <span className="w-12 h-2 rounded" style={{ background: preview.border }} />
                    </div>
                    <div className="w-full h-1 rounded" style={{ background: preview.border }} />
                </div>
                <div
                    className="rounded p-2"
                    style={{ background: preview.panel, border: `1px solid ${preview.border}` }}
                >
                    <div className="w-full h-1 rounded mb-1" style={{ background: preview.border }} />
                    <div className="w-2/3 h-1 rounded" style={{ background: preview.border }} />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                {active && <Check size={14} className="text-[var(--accent-color)]" />}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{description}</p>
        </button>
    );
}

function ToggleRow({
    icon,
    label,
    hint,
    value,
    onChange,
    on,
    off,
}: {
    icon?: React.ReactNode;
    label: string;
    hint: string;
    value: boolean;
    onChange: (next: boolean) => void;
    on: string;
    off: string;
}) {
    return (
        <div className="flex items-center justify-between py-2 border-t border-[var(--panel-border)] first:border-t-0">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    {icon}
                    {label}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{hint}</div>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                    value ? 'bg-[var(--accent-color)]' : 'bg-[var(--panel-border)]'
                }`}
                aria-label={value ? on : off}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        value ? 'translate-x-5' : 'translate-x-0.5'
                    } translate-y-0.5`}
                />
            </button>
        </div>
    );
}

function LangButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-md text-sm transition-colors border ${
                active
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--text-primary)]'
                    : 'border-[var(--panel-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
            {children}
        </button>
    );
}

function PillButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-md text-xs transition-colors border ${
                active
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--text-primary)]'
                    : 'border-[var(--panel-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/40'
            }`}
        >
            {children}
        </button>
    );
}
