'use client';

import {
  Activity,
  Bot,
  CalendarClock,
  Database,
  History,
  Inbox,
  Keyboard,
  LayoutDashboard,
  MessageSquare,
  Network,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Wrench,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import CommandPalette, { type CommandAction } from '@/components/Editor/CommandPalette';

import ShortcutHelpModal from './ShortcutHelpModal';

interface GlobalCommandPaletteProps {
  lang: 'en' | 'es';
}

const LABELS = {
  en: {
    dashboard: 'Dashboard',
    runbooks: 'Runbooks',
    runs: 'Run history',
    inbox: 'Inbox',
    monitors: 'Monitors',
    events: 'Events',
    schedules: 'Schedules',
    sqlEditor: 'SQL Editor',
    lineage: 'Runbook lineage',
    httpTester: 'API Tester',
    agents: 'Agents',
    chat: 'AI Assistant',
    utilities: 'Utilities',
    admin: 'Admin',
    settings: 'Settings',
    navigate: 'Navigate',
    help: 'Keyboard shortcuts',
    helpSub: 'Show cheat sheet',
  },
  es: {
    dashboard: 'Panel',
    runbooks: 'Runbooks',
    runs: 'Historial',
    inbox: 'Bandeja',
    monitors: 'Monitores',
    events: 'Eventos',
    schedules: 'Horarios',
    sqlEditor: 'SQL Editor',
    lineage: 'Lineage de runbooks',
    httpTester: 'Probador de API',
    agents: 'Agentes',
    chat: 'Asistente IA',
    utilities: 'Utilidades',
    admin: 'Admin',
    settings: 'Configuración',
    navigate: 'Navegar',
    help: 'Atajos de teclado',
    helpSub: 'Ver atajos',
  },
} as const;

// App-wide ⌘K / Ctrl-K palette. Mounted once per app shell (inside the
// sidebar component) so every authenticated page gets it without each
// page having to wire its own listener.
export default function GlobalCommandPalette({ lang }: GlobalCommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Guard against invalid locales reaching this component — when the
  // user lands on /editor without a locale prefix, [lang] resolves to
  // the next segment ("editor") and LABELS[lang] is undefined.
  const safeLang: 'en' | 'es' = lang === 'es' ? 'es' : 'en';
  const t = LABELS[safeLang];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // ⌘K / Ctrl-K — toggle the command palette. Respect nested
      // scopes (editor's own ⌘K) so they don't double-fire.
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        if (target?.closest('[data-cmdk-scope]')) return;
        e.preventDefault();
        setOpen(o => !o);
        return;
      }

      // `?` (Shift+/) — open the keyboard cheat sheet. Skip when the
      // user is typing in a form field so the `?` character still
      // lands where expected.
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const go = (path: string) => () => router.push(path);

  const actions: CommandAction[] = [
    {
      id: 'nav:dashboard',
      label: t.dashboard,
      subLabel: t.navigate,
      icon: <LayoutDashboard size={16} />,
      shortcut: ['G', 'H'],
      action: go(`/${safeLang}/dashboard`),
    },
    {
      id: 'nav:runbooks',
      label: t.runbooks,
      subLabel: t.navigate,
      icon: <Share2 size={16} />,
      shortcut: ['G', 'R'],
      action: go(`/${safeLang}/runbooks`),
    },
    {
      id: 'nav:runs',
      label: t.runs,
      subLabel: t.navigate,
      icon: <History size={16} />,
      action: go(`/${safeLang}/runs`),
    },
    {
      id: 'nav:inbox',
      label: t.inbox,
      subLabel: t.navigate,
      icon: <Inbox size={16} />,
      shortcut: ['G', 'I'],
      action: go(`/${safeLang}/inbox`),
    },
    {
      id: 'nav:monitors',
      label: t.monitors,
      subLabel: t.navigate,
      icon: <Activity size={16} />,
      action: go(`/${safeLang}/monitors`),
    },
    {
      id: 'nav:events',
      label: t.events,
      subLabel: t.navigate,
      icon: <Zap size={16} />,
      action: go(`/${safeLang}/events`),
    },
    {
      id: 'nav:schedules',
      label: t.schedules,
      subLabel: t.navigate,
      icon: <CalendarClock size={16} />,
      action: go(`/${safeLang}/schedules`),
    },
    {
      id: 'nav:sql',
      label: t.sqlEditor,
      subLabel: t.navigate,
      icon: <Database size={16} />,
      shortcut: ['G', 'S'],
      action: go(`/${safeLang}/sql-editor`),
    },
    {
      id: 'nav:lineage',
      label: t.lineage,
      subLabel: t.navigate,
      icon: <Network size={16} />,
      shortcut: ['G', 'L'],
      action: go(`/${safeLang}/lineage`),
    },
    {
      id: 'nav:http-tester',
      label: t.httpTester,
      subLabel: t.navigate,
      icon: <Send size={16} />,
      shortcut: ['G', 'A'],
      action: go(`/${safeLang}/http-tester`),
    },
    {
      id: 'nav:agents',
      label: t.agents,
      subLabel: t.navigate,
      icon: <Bot size={16} />,
      action: go(`/${safeLang}/agents`),
    },
    {
      id: 'nav:chat',
      label: t.chat,
      subLabel: t.navigate,
      icon: <MessageSquare size={16} />,
      action: go(`/${safeLang}/chat`),
    },
    {
      id: 'nav:utilities',
      label: t.utilities,
      subLabel: t.navigate,
      icon: <Wrench size={16} />,
      action: go(`/${safeLang}/utilities`),
    },
    {
      id: 'nav:admin',
      label: t.admin,
      subLabel: t.navigate,
      icon: <ShieldCheck size={16} />,
      action: go(`/${safeLang}/admin`),
    },
    {
      id: 'nav:settings',
      label: t.settings,
      subLabel: t.navigate,
      icon: <Settings size={16} />,
      action: go(`/${safeLang}/settings`),
    },
    {
      id: 'help:shortcuts',
      label: t.help,
      subLabel: t.helpSub,
      icon: <Keyboard size={16} />,
      shortcut: ['?'],
      action: () => setHelpOpen(true),
    },
  ];

  return (
    <>
      <CommandPalette
        isOpen={open}
        onClose={() => setOpen(false)}
        actions={actions}
        lang={safeLang}
      />
      <ShortcutHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} lang={safeLang} />
    </>
  );
}
