'use client';

import {
  ArrowRight,
  Check,
  Grid3x3,
  Languages,
  Link2,
  Package,
  Palette,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { type Theme, THEMES, useTheme } from '@/context/ThemeContext';
import { storageRead, storageWrite } from '@/lib/storage-compat';

import ApiPrefsPanel from './ApiPrefsPanel';
import { BillingPanel } from './BillingPanel';
import ComputePrefsPanel from './ComputePrefsPanel';
import ConnectedAccountsPanel from './ConnectedAccountsPanel';
import EditorPrefsPanel from './EditorPrefsPanel';
import LineagePrefsPanel from './LineagePrefsPanel';
import PluginsPanel from './PluginsPanel';
import SqlPrefsPanel from './SqlPrefsPanel';
import WorkspaceComputeDefaultsPanel from './WorkspaceComputeDefaultsPanel';
import { DangerZone } from './DangerZone';
import { TeamPanel } from './TeamPanel';
import { UpgradeWelcomeModal } from './UpgradeWelcomeModal';

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
    // Appearance link card
    appearanceTitle: 'Appearance',
    appearanceHint:
      'Nodes, connections, flow animations, canvas patterns, presets — every visual knob lives on its own page.',
    appearanceCta: 'Open appearance settings',
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
    // Appearance link card
    appearanceTitle: 'Apariencia',
    appearanceHint:
      'Nodos, conexiones, animaciones, patrones del canvas y presets — todos los ajustes visuales tienen su propia página.',
    appearanceCta: 'Abrir ajustes de apariencia',
  },
} as const;

interface SettingsPageProps {
  lang: 'en' | 'es';
}

export default function SettingsPage({ lang }: SettingsPageProps) {
  const t = STRINGS[lang];
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [autosave, setAutosave] = useState<boolean>(true);
  const [snap, setSnap] = useState<boolean>(false);

  useEffect(() => {
    try {
      setAutosave(storageRead('operari-autosave-enabled') !== 'false');
      setSnap(localStorage.getItem('operari-editor-snap-to-grid') === '1');
    } catch {
      /* noop */
    }
  }, []);

  const handleAutosave = (next: boolean) => {
    setAutosave(next);
    try {
      storageWrite('operari-autosave-enabled', next ? 'true' : 'false');
    } catch {
      /* noop */
    }
  };

  const handleSnap = (next: boolean) => {
    setSnap(next);
    try {
      localStorage.setItem('operari-editor-snap-to-grid', next ? '1' : '0');
    } catch {
      /* noop */
    }
  };

  const switchLang = (target: 'en' | 'es') => {
    if (target === lang) return;
    // Replace the first segment of the URL.
    const path = window.location.pathname.replace(/^\/(en|es)/, `/${target}`);
    router.push(path + window.location.search);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <SettingsIcon size={22} className="text-[var(--accent-color)]" />
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{t.subtitle}</p>
        </div>

        {/* Post-checkout celebration. Fires once on
                    /settings?checkout=success, self-dismisses and
                    strips the query param so reload doesn't re-show. */}
        <UpgradeWelcomeModal lang={lang} />

        {/* Theme picker */}
        <Section icon={<Palette size={16} />} title={t.themeTitle} hint={t.themeHint}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {THEMES.map(opt => (
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

        {/* Appearance — separate page so this Settings panel stays
                    short. Every node/edge/flow/canvas knob + preset
                    manager lives at /settings/appearance. */}
        <Link
          href={`/${lang}/settings/appearance`}
          className="hover:border-[var(--accent-color)]/50 group mb-6 flex items-center justify-between rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">
              <Palette size={14} />
              <span>{t.appearanceTitle}</span>
            </div>
            <p className="text-sm text-[var(--text-primary)]">{t.appearanceCta}</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t.appearanceHint}</p>
          </div>
          <ArrowRight
            size={16}
            className="flex-shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-color)]"
          />
        </Link>

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

        {/* Connected accounts (GitHub today, more providers in time) */}
        <Section
          icon={<Link2 size={16} />}
          title={lang === 'es' ? 'Cuentas conectadas' : 'Connected accounts'}
        >
          <ConnectedAccountsPanel lang={lang} />
        </Section>

        {/* Tenant-scoped plugins. The runtime layout + registry are
            already shipped per ADR 0006 — the install endpoint stub
            returns 501 today; the panel surfaces the upload UX so
            admins see the affordance and the contract is documented. */}
        <Section
          icon={<Package size={16} />}
          title={lang === 'es' ? 'Plugins' : 'Plugins'}
          hint={
            lang === 'es'
              ? 'Subí plugins custom (.tar.gz) para extender este workspace. Solo admins.'
              : 'Upload custom plugins (.tar.gz) to extend this workspace. Admins only.'
          }
        >
          <PluginsPanel lang={lang} />
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

        {/* Per-feature preferences. Each panel owns its own
            localStorage slice via lib/userPrefs hooks; consumers in
            the editor/sql-editor/http-tester/lineage routes pick
            them up at render time. */}
        <SqlPrefsPanel lang={lang} />
        <ApiPrefsPanel lang={lang} />
        <EditorPrefsPanel lang={lang} />
        <LineagePrefsPanel lang={lang} />
        <ComputePrefsPanel lang={lang} />
        <WorkspaceComputeDefaultsPanel lang={lang} />

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
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">
        {icon}
        <span>{title}</span>
      </div>
      {hint && <p className="mb-3 text-[11px] text-[var(--text-muted)]">{hint}</p>}
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
      className={`rounded-md border p-3 text-left transition-colors ${
        active
          ? 'bg-[var(--accent-color)]/5 border-[var(--accent-color)]'
          : 'hover:border-[var(--accent-color)]/50 border-[var(--panel-border)]'
      }`}
    >
      <div
        className="mb-3 rounded-md border p-3"
        style={{
          background: preview.bg,
          borderColor: preview.border,
        }}
      >
        <div
          className="mb-1 rounded p-2"
          style={{ background: preview.panel, border: `1px solid ${preview.border}` }}
        >
          <div className="mb-1 flex gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: preview.accent }} />
            <span className="h-2 w-12 rounded" style={{ background: preview.border }} />
          </div>
          <div className="h-1 w-full rounded" style={{ background: preview.border }} />
        </div>
        <div
          className="rounded p-2"
          style={{ background: preview.panel, border: `1px solid ${preview.border}` }}
        >
          <div className="mb-1 h-1 w-full rounded" style={{ background: preview.border }} />
          <div className="h-1 w-2/3 rounded" style={{ background: preview.border }} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {active && <Check size={14} className="text-[var(--accent-color)]" />}
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{description}</p>
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
    <div className="flex items-center justify-between border-t border-[var(--panel-border)] py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          {icon}
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{hint}</div>
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
      className={`rounded-md border px-4 py-2 text-sm transition-colors ${
        active
          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--text-primary)]'
          : 'border-[var(--panel-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}
