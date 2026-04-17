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
import { BillingPanel } from './BillingPanel';
import { UpgradeWelcomeModal } from './UpgradeWelcomeModal';
import { TeamPanel } from './TeamPanel';
import { DangerZone } from './DangerZone';
import {
    useVisualization,
    ACCENT_HEX,
    type NodeDensity,
    type NodeStyle,
    type LineStyle,
    type FlowStyle,
    type AnimationSpeed,
    type AccentColor,
} from '@/context/VisualizationContext';

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
        accentLabel: 'Accent color',
        accentHint: 'Brand color for poles, running nodes and the selected connection.',
        accentEmerald: 'Emerald',
        accentSky: 'Sky',
        accentViolet: 'Violet',
        accentAmber: 'Amber',
        accentRose: 'Rose',
        accentSlate: 'Slate',
        nodeStyleLabel: 'Node style',
        nodeStyleHint: 'Shape + shadow preset for job cards. Independent from density.',
        nodeStyleModern: 'Modern',
        nodeStyleMinimal: 'Minimal',
        nodeStyleBold: 'Bold',
        nodeStyleNeon: 'Neon',
        nodeStyleGlass: 'Glass',
        animSpeedLabel: 'Animation speed',
        animSpeedHint: 'How fast the running-pulse, flash and progress animations play.',
        animSpeedOff: 'Off',
        animSpeedCalm: 'Calm',
        animSpeedDefault: 'Default',
        animSpeedLively: 'Lively',
        lineStep: 'Step',
        flowStyleLabel: 'Line animation',
        flowStyleHint: 'How an active connection animates while a step is running.',
        flowStyleOrbs: 'Orbs',
        flowStyleDashes: 'Dashes',
        flowStylePulse: 'Pulse',
        flowStyleOff: 'Static',
        previewLabel: 'Live preview',
        previewHint: 'All editor tweaks above are reflected here in real time.',
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
        accentLabel: 'Color de acento',
        accentHint: 'Color de marca para poles, nodos corriendo y la conexión seleccionada.',
        accentEmerald: 'Esmeralda',
        accentSky: 'Cielo',
        accentViolet: 'Violeta',
        accentAmber: 'Ámbar',
        accentRose: 'Rosa',
        accentSlate: 'Pizarra',
        nodeStyleLabel: 'Estilo de nodo',
        nodeStyleHint: 'Preset de forma + sombra para las tarjetas. Independiente de la densidad.',
        nodeStyleModern: 'Moderno',
        nodeStyleMinimal: 'Minimal',
        nodeStyleBold: 'Marcado',
        nodeStyleNeon: 'Neón',
        nodeStyleGlass: 'Glass',
        animSpeedLabel: 'Velocidad de animación',
        animSpeedHint: 'Qué tan rápido corren el pulso, flash y progress.',
        animSpeedOff: 'Apagado',
        animSpeedCalm: 'Tranquilo',
        animSpeedDefault: 'Default',
        animSpeedLively: 'Enérgico',
        lineStep: 'Escalón',
        flowStyleLabel: 'Animación de línea',
        flowStyleHint: 'Cómo se anima la conexión mientras un step corre.',
        flowStyleOrbs: 'Orbes',
        flowStyleDashes: 'Rayas',
        flowStylePulse: 'Pulso',
        flowStyleOff: 'Estática',
        previewLabel: 'Vista previa',
        previewHint: 'Todos los ajustes del editor se reflejan acá en tiempo real.',
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

                {/* Post-checkout celebration. Fires once on
                    /settings?checkout=success, self-dismisses and
                    strips the query param so reload doesn't re-show. */}
                <UpgradeWelcomeModal lang={lang} />

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
                    {/* Live preview */}
                    <div className="py-2 first:border-t-0">
                        <div className="flex items-center justify-between text-sm text-[var(--text-primary)] mb-1">
                            <span>{t.previewLabel}</span>
                            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                                {viz.nodeStyle} · {viz.lineStyle} · {viz.flowStyle}
                            </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mb-2">
                            {t.previewHint}
                        </div>
                        <LivePreview
                            nodeStyle={viz.nodeStyle}
                            lineStyle={viz.lineStyle}
                            flowStyle={viz.flowStyle}
                            accent={ACCENT_HEX[viz.accentColor]}
                            animsOn={viz.animationSpeed !== 'off'}
                        />
                    </div>

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

                    {/* Node style picker */}
                    <div className="py-2 border-t border-[var(--panel-border)]">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <BoxIcon size={14} />
                            {t.nodeStyleLabel}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.nodeStyleHint}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {(
                                [
                                    { id: 'modern' as NodeStyle, label: t.nodeStyleModern },
                                    { id: 'minimal' as NodeStyle, label: t.nodeStyleMinimal },
                                    { id: 'bold' as NodeStyle, label: t.nodeStyleBold },
                                    { id: 'neon' as NodeStyle, label: t.nodeStyleNeon },
                                    { id: 'glass' as NodeStyle, label: t.nodeStyleGlass },
                                ]
                            ).map((opt) => (
                                <PreviewCard
                                    key={opt.id}
                                    active={viz.nodeStyle === opt.id}
                                    label={opt.label}
                                    onClick={() => viz.setNodeStyle(opt.id)}
                                >
                                    <NodeStylePreview
                                        style={opt.id}
                                        accent={ACCENT_HEX[viz.accentColor]}
                                    />
                                </PreviewCard>
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
                        <div className="grid grid-cols-3 gap-2">
                            {(
                                [
                                    { id: 'bezier' as LineStyle, label: t.lineBezier },
                                    { id: 'straight' as LineStyle, label: t.lineStraight },
                                    { id: 'step' as LineStyle, label: t.lineStep },
                                ]
                            ).map((opt) => (
                                <PreviewCard
                                    key={opt.id}
                                    active={viz.lineStyle === opt.id}
                                    label={opt.label}
                                    onClick={() => viz.setLineStyle(opt.id)}
                                >
                                    <LineStylePreview
                                        style={opt.id}
                                        accent={ACCENT_HEX[viz.accentColor]}
                                    />
                                </PreviewCard>
                            ))}
                        </div>
                    </div>

                    {/* Flow animation picker */}
                    <div className="py-2 border-t border-[var(--panel-border)]">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <ZapIcon size={14} />
                            {t.flowStyleLabel}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.flowStyleHint}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(
                                [
                                    { id: 'orbs' as FlowStyle, label: t.flowStyleOrbs },
                                    { id: 'dashes' as FlowStyle, label: t.flowStyleDashes },
                                    { id: 'pulse' as FlowStyle, label: t.flowStylePulse },
                                    { id: 'off' as FlowStyle, label: t.flowStyleOff },
                                ]
                            ).map((opt) => (
                                <PreviewCard
                                    key={opt.id}
                                    active={viz.flowStyle === opt.id}
                                    label={opt.label}
                                    onClick={() => viz.setFlowStyle(opt.id)}
                                >
                                    <FlowStylePreview
                                        style={opt.id}
                                        accent={ACCENT_HEX[viz.accentColor]}
                                    />
                                </PreviewCard>
                            ))}
                        </div>
                    </div>

                    {/* Accent color picker */}
                    <div className="py-2 border-t border-[var(--panel-border)]">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <Palette size={14} />
                            {t.accentLabel}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.accentHint}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    { id: 'emerald' as AccentColor, label: t.accentEmerald },
                                    { id: 'sky' as AccentColor, label: t.accentSky },
                                    { id: 'violet' as AccentColor, label: t.accentViolet },
                                    { id: 'amber' as AccentColor, label: t.accentAmber },
                                    { id: 'rose' as AccentColor, label: t.accentRose },
                                    { id: 'slate' as AccentColor, label: t.accentSlate },
                                ]
                            ).map((opt) => {
                                const active = viz.accentColor === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => viz.setAccentColor(opt.id)}
                                        title={opt.label}
                                        aria-label={opt.label}
                                        aria-pressed={active}
                                        className={`group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                            active
                                                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--text-primary)]'
                                                : 'border-[var(--panel-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/40'
                                        }`}
                                    >
                                        <span
                                            className="inline-block w-4 h-4 rounded-full ring-1 ring-black/20 dark:ring-white/10"
                                            style={{ background: ACCENT_HEX[opt.id] }}
                                        />
                                        {opt.label}
                                        {active && <Check size={12} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Animation speed picker */}
                    <div className="py-2 border-t border-[var(--panel-border)]">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <Sparkles size={14} />
                            {t.animSpeedLabel}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                            {t.animSpeedHint}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    { id: 'off' as AnimationSpeed, label: t.animSpeedOff },
                                    { id: 'calm' as AnimationSpeed, label: t.animSpeedCalm },
                                    { id: 'default' as AnimationSpeed, label: t.animSpeedDefault },
                                    { id: 'lively' as AnimationSpeed, label: t.animSpeedLively },
                                ]
                            ).map((opt) => (
                                <PillButton
                                    key={opt.id}
                                    active={viz.animationSpeed === opt.id}
                                    onClick={() => viz.setAnimationSpeed(opt.id)}
                                >
                                    {opt.label}
                                </PillButton>
                            ))}
                        </div>
                    </div>

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

                {/* Team */}
                <Section
                    icon={<User size={16} />}
                    title={lang === 'es' ? 'Equipo' : 'Team'}
                    hint={
                        lang === 'es'
                            ? 'Invitá usuarios a este workspace. Los links de invitación duran 7 días.'
                            : 'Invite teammates to this workspace. Invite links expire in 7 days.'
                    }
                >
                    <TeamPanel lang={lang} />
                </Section>

                {/* Plan & billing */}
                <Section
                    icon={<Sparkles size={16} />}
                    title={lang === 'es' ? 'Plan y facturación' : 'Plan & billing'}
                    hint={
                        lang === 'es'
                            ? 'Suscribite, gestioná la suscripción o bajá facturas. Self-host queda gratis para siempre.'
                            : 'Upgrade, manage your subscription, or download invoices. Self-host stays free forever.'
                    }
                >
                    <BillingPanel lang={lang} />
                </Section>

                {/* Profile placeholder */}
                <Section icon={<User size={16} />} title={t.profileTitle} hint={t.profileHint}>
                    <div className="text-sm text-[var(--text-muted)]">{t.profilePlaceholder}</div>
                </Section>

                {/* Danger zone — self-serve GDPR account purge. Stays
                    at the very bottom of the page so a casual scroll
                    never lands on it; the modal still requires a
                    typed confirmation + password + MFA + workspace
                    opt-in before it fires. */}
                <DangerZone lang={lang} />
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

// Thumbnail card that wraps any in-settings preview SVG. Tap-to-select
// pattern: active card shows the accent border + check mark so the
// user never has to guess which variant is currently live on the canvas.
function PreviewCard({
    active,
    label,
    onClick,
    children,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            aria-pressed={active}
            className={`group relative flex flex-col items-stretch gap-1.5 rounded-md border p-2 text-left transition-colors ${
                active
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                    : 'border-[var(--panel-border)] hover:border-[var(--accent-color)]/40'
            }`}
        >
            <div className="flex h-16 items-center justify-center overflow-hidden rounded bg-[var(--app-bg)]/70 px-2">
                {children}
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-primary)]">{label}</span>
                {active && <Check size={11} className="text-[var(--accent-color)]" />}
            </div>
        </button>
    );
}

// Mini node card rendered with the same CSS knobs each node-style
// preset flips. The preview is intentionally static so the user
// compares shape/shadow without the running-pulse distraction.
function NodeStylePreview({ style, accent }: { style: NodeStyle; accent: string }) {
    const presets: Record<
        NodeStyle,
        { shadow: string; radius: number; borderWidth: number; borderColor: string; bg: string; blur?: string }
    > = {
        modern: {
            shadow: '0 4px 10px rgba(0,0,0,0.25)',
            radius: 8,
            borderWidth: 1.5,
            borderColor: 'var(--panel-border)',
            bg: 'var(--panel-bg)',
        },
        minimal: {
            shadow: '0 1px 2px rgba(0,0,0,0.12)',
            radius: 2,
            borderWidth: 1,
            borderColor: 'var(--panel-border)',
            bg: 'var(--panel-bg)',
        },
        bold: {
            shadow: '0 6px 14px rgba(0,0,0,0.4)',
            radius: 12,
            borderWidth: 2.5,
            borderColor: 'var(--panel-border)',
            bg: 'var(--panel-bg)',
        },
        neon: {
            shadow: `0 0 0 1px ${hexAlpha(accent, 0.55)}, 0 0 12px ${hexAlpha(accent, 0.55)}`,
            radius: 8,
            borderWidth: 1,
            borderColor: hexAlpha(accent, 0.7),
            bg: 'var(--panel-bg)',
        },
        glass: {
            shadow: '0 4px 14px rgba(0,0,0,0.3)',
            radius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            bg: 'rgba(255,255,255,0.06)',
            blur: 'saturate(140%) blur(6px)',
        },
    };
    const p = presets[style];
    return (
        <div
            className="flex h-11 w-[88%] items-center gap-1.5 px-2"
            style={{
                background: p.bg,
                borderRadius: p.radius,
                border: `${p.borderWidth}px solid ${p.borderColor}`,
                boxShadow: p.shadow,
                backdropFilter: p.blur,
                WebkitBackdropFilter: p.blur,
                borderLeft: `3px solid ${accent}`,
            }}
        >
            <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: accent }}
            />
            <span className="flex-1 space-y-1">
                <span className="block h-1.5 rounded bg-[var(--text-muted)]/50" style={{ width: '70%' }} />
                <span className="block h-1 rounded bg-[var(--text-muted)]/30" style={{ width: '50%' }} />
            </span>
        </div>
    );
}

// SVG illustration of each line-shape variant. Uses the accent color
// so the preview stays in sync with the color picker above.
function LineStylePreview({ style, accent }: { style: LineStyle; accent: string }) {
    const d =
        style === 'straight'
            ? 'M8 32 L80 16'
            : style === 'step'
              ? 'M8 32 L44 32 L44 16 L80 16'
              : 'M8 32 C 32 32, 56 16, 80 16';
    return (
        <svg viewBox="0 0 88 48" className="h-full w-full">
            <circle cx="8" cy="32" r="3.5" fill={accent} />
            <circle cx="80" cy="16" r="3.5" fill={accent} />
            <path
                d={d}
                stroke={accent}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// Visual explanation of each line-animation flavor. `orbs`/`dashes`
// use SMIL so the thumbnail animates. `pulse` uses a CSS keyframe.
function FlowStylePreview({ style, accent }: { style: FlowStyle; accent: string }) {
    const pathD = 'M8 24 C 32 24, 56 24, 80 24';
    if (style === 'off') {
        return (
            <svg viewBox="0 0 88 48" className="h-full w-full">
                <path d={pathD} stroke={accent} strokeWidth="2" fill="none" />
            </svg>
        );
    }
    if (style === 'orbs') {
        return (
            <svg viewBox="0 0 88 48" className="h-full w-full">
                <path id="p" d={pathD} stroke={accent} strokeWidth="2" fill="none" />
                <circle r="3" fill={accent}>
                    <animateMotion dur="1.6s" repeatCount="indefinite">
                        <mpath href="#p" />
                    </animateMotion>
                </circle>
            </svg>
        );
    }
    if (style === 'dashes') {
        return (
            <svg viewBox="0 0 88 48" className="h-full w-full">
                <path
                    d={pathD}
                    stroke={accent}
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    fill="none"
                >
                    <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-22"
                        dur="0.8s"
                        repeatCount="indefinite"
                    />
                </path>
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 88 48" className="h-full w-full">
            <path d={pathD} stroke={accent} strokeWidth="2" fill="none">
                <animate
                    attributeName="opacity"
                    values="0.35;1;0.35"
                    dur="1.8s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="stroke-width"
                    values="1.5;3;1.5"
                    dur="1.8s"
                    repeatCount="indefinite"
                />
            </path>
        </svg>
    );
}

// Bigger "what will my canvas look like" panel. Composes the node +
// line + flow previews together so the user sees the combined effect
// without leaving the settings page.
function LivePreview({
    nodeStyle,
    lineStyle,
    flowStyle,
    accent,
    animsOn,
}: {
    nodeStyle: NodeStyle;
    lineStyle: LineStyle;
    flowStyle: FlowStyle;
    accent: string;
    animsOn: boolean;
}) {
    const path =
        lineStyle === 'straight'
            ? 'M60 60 L220 60'
            : lineStyle === 'step'
              ? 'M60 60 L140 60 L140 60 L220 60'
              : 'M60 60 C 110 60, 170 60, 220 60';
    return (
        <div className="relative rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)]/60 overflow-hidden" style={{ height: 128 }}>
            <svg viewBox="0 0 280 120" className="absolute inset-0 h-full w-full">
                {flowStyle === 'pulse' ? (
                    <path
                        d={path}
                        stroke={accent}
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {animsOn && (
                            <>
                                <animate
                                    attributeName="opacity"
                                    values="0.4;1;0.4"
                                    dur="1.8s"
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="stroke-width"
                                    values="1.5;3;1.5"
                                    dur="1.8s"
                                    repeatCount="indefinite"
                                />
                            </>
                        )}
                    </path>
                ) : flowStyle === 'dashes' ? (
                    <path
                        id="livePath"
                        d={path}
                        stroke={accent}
                        strokeWidth="2"
                        strokeDasharray="6 7"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {animsOn && (
                            <animate
                                attributeName="stroke-dashoffset"
                                from="0"
                                to="-26"
                                dur="0.8s"
                                repeatCount="indefinite"
                            />
                        )}
                    </path>
                ) : (
                    <>
                        <path
                            id="livePath"
                            d={path}
                            stroke={accent}
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {flowStyle === 'orbs' && animsOn && (
                            <circle r="4" fill={accent}>
                                <animateMotion dur="1.8s" repeatCount="indefinite">
                                    <mpath href="#livePath" />
                                </animateMotion>
                            </circle>
                        )}
                    </>
                )}
            </svg>
            <div
                className="absolute top-1/2 left-4 -translate-y-1/2"
                style={{ width: 56 }}
            >
                <NodeStylePreview style={nodeStyle} accent={accent} />
            </div>
            <div
                className="absolute top-1/2 right-4 -translate-y-1/2"
                style={{ width: 56 }}
            >
                <NodeStylePreview style={nodeStyle} accent={accent} />
            </div>
        </div>
    );
}

function hexAlpha(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
