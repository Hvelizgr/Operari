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
  const t = LABELS[lang];

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
      action: go(`/${lang}/dashboard`),
    },
    {
      id: 'nav:runbooks',
      label: t.runbooks,
      subLabel: t.navigate,
      icon: <Share2 size={16} />,
      shortcut: ['G', 'R'],
      action: go(`/${lang}/runbooks`),
    },
    {
      id: 'nav:runs',
      label: t.runs,
      subLabel: t.navigate,
      icon: <History size={16} />,
      action: go(`/${lang}/runs`),
    },
    {
      id: 'nav:inbox',
      label: t.inbox,
      subLabel: t.navigate,
      icon: <Inbox size={16} />,
      shortcut: ['G', 'I'],
      action: go(`/${lang}/inbox`),
    },
    {
      id: 'nav:monitors',
      label: t.monitors,
      subLabel: t.navigate,
      icon: <Activity size={16} />,
      action: go(`/${lang}/monitors`),
    },
    {
      id: 'nav:events',
      label: t.events,
      subLabel: t.navigate,
      icon: <Zap size={16} />,
      action: go(`/${lang}/events`),
    },
    {
      id: 'nav:schedules',
      label: t.schedules,
      subLabel: t.navigate,
      icon: <CalendarClock size={16} />,
      action: go(`/${lang}/schedules`),
    },
    {
      id: 'nav:sql',
      label: t.sqlEditor,
      subLabel: t.navigate,
      icon: <Database size={16} />,
      shortcut: ['G', 'S'],
      action: go(`/${lang}/sql-editor`),
    },
    {
      id: 'nav:lineage',
      label: t.lineage,
      subLabel: t.navigate,
      icon: <Network size={16} />,
      shortcut: ['G', 'L'],
      action: go(`/${lang}/lineage`),
    },
    {
      id: 'nav:http-tester',
      label: t.httpTester,
      subLabel: t.navigate,
      icon: <Send size={16} />,
      shortcut: ['G', 'A'],
      action: go(`/${lang}/http-tester`),
    },
    {
      id: 'nav:agents',
      label: t.agents,
      subLabel: t.navigate,
      icon: <Bot size={16} />,
      action: go(`/${lang}/agents`),
    },
    {
      id: 'nav:chat',
      label: t.chat,
      subLabel: t.navigate,
      icon: <MessageSquare size={16} />,
      action: go(`/${lang}/chat`),
    },
    {
      id: 'nav:utilities',
      label: t.utilities,
      subLabel: t.navigate,
      icon: <Wrench size={16} />,
      action: go(`/${lang}/utilities`),
    },
    {
      id: 'nav:admin',
      label: t.admin,
      subLabel: t.navigate,
      icon: <ShieldCheck size={16} />,
      action: go(`/${lang}/admin`),
    },
    {
      id: 'nav:settings',
      label: t.settings,
      subLabel: t.navigate,
      icon: <Settings size={16} />,
      action: go(`/${lang}/settings`),
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
      <CommandPalette isOpen={open} onClose={() => setOpen(false)} actions={actions} lang={lang} />
      <ShortcutHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} lang={lang} />
    </>
  );
}
