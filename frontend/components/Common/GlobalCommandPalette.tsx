'use client';

import {
  Activity,
  Bot,
  CalendarClock,
  Database,
  History,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Share2,
  ShieldCheck,
  Wrench,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import CommandPalette, { type CommandAction } from '@/components/Editor/CommandPalette';

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
    agents: 'Agents',
    chat: 'AI Assistant',
    utilities: 'Utilities',
    admin: 'Admin',
    settings: 'Settings',
    navigate: 'Navigate',
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
    agents: 'Agentes',
    chat: 'Asistente IA',
    utilities: 'Utilidades',
    admin: 'Admin',
    settings: 'Configuración',
    navigate: 'Navegar',
  },
} as const;

// App-wide ⌘K / Ctrl-K palette. Mounted once per app shell (inside the
// sidebar component) so every authenticated page gets it without each
// page having to wire its own listener.
export default function GlobalCommandPalette({ lang }: GlobalCommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const t = LABELS[lang];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K';
      if (!isK) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      // Respect any nested palette scope (e.g. the editor's own ⌘K).
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-cmdk-scope]')) return;
      e.preventDefault();
      setOpen(o => !o);
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
  ];

  return (
    <CommandPalette isOpen={open} onClose={() => setOpen(false)} actions={actions} lang={lang} />
  );
}
