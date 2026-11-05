'use client';

import {
  Activity,
  CalendarClock,
  Columns3,
  Database,
  FolderKanban,
  History,
  Inbox,
  Keyboard,
  LayoutDashboard,
  MessageSquare,
  Plug,
  ScrollText,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  SquareTerminal,
  Wrench,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import CommandPalette, { type CommandAction } from '@/components/Editor/CommandPalette';

import ShortcutHelpModal from './ShortcutHelpModal';

interface GlobalCommandPaletteProps {
  lang: 'en' | 'es';
}

const LABELS = {
  en: {
    dashboard: 'Home',
    runbooks: 'Runbooks',
    projects: 'Projects',
    runs: 'Run history',
    sessions: 'Runs in progress',
    inbox: 'Approvals',
    monitors: 'Monitors',
    events: 'Audit log',
    schedules: 'Schedules',
    sqlEditor: 'SQL Editor',
    httpTester: 'API Tester',
    mcpTester: 'MCP Tester',
    terminal: 'Terminal',
    agents: 'Event rules',
    chat: 'AI Assistant',
    utilities: 'API keys & webhooks',
    admin: 'Workspace overview',
    settings: 'Settings',
    navigate: 'Navigate',
    help: 'Keyboard shortcuts',
    helpSub: 'Show cheat sheet',
  },
  es: {
    dashboard: 'Inicio',
    runbooks: 'Runbooks',
    projects: 'Proyectos',
    runs: 'Historial de corridas',
    sessions: 'Corridas en curso',
    inbox: 'Aprobaciones',
    monitors: 'Monitores',
    events: 'Auditoría',
    schedules: 'Programados',
    sqlEditor: 'Editor SQL',
    httpTester: 'Probador de API',
    mcpTester: 'Probador MCP',
    terminal: 'Terminal',
    agents: 'Reglas de eventos',
    chat: 'Asistente IA',
    utilities: 'API keys y webhooks',
    admin: 'Resumen del workspace',
    settings: 'Ajustes',
    navigate: 'Navegar',
    help: 'Atajos de teclado',
    helpSub: 'Ver atajos',
  },
} as const;

export const G_ROUTES: Record<string, string> = {
  h: 'dashboard',
  r: 'runbooks',
  p: 'projects',
  i: 'inbox',
  s: 'sql-editor',
  a: 'http-tester',
  m: 'mcp-tester',
  t: 'terminal',
};
const G_WINDOW_MS = 1200;

function isTyping(target: HTMLElement | null): boolean {
  return Boolean(
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  );
}

// App-wide ⌘K / Ctrl-K palette. Mounted once per app shell (inside the
// sidebar component) so every authenticated page gets it without each
// page having to wire its own listener.
export default function GlobalCommandPalette({ lang }: GlobalCommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const t = LABELS[lang];
  const gPressedAt = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      if (!e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(target)) {
        const key = e.key.toLowerCase();
        if (gPressedAt.current && Date.now() - gPressedAt.current <= G_WINDOW_MS) {
          gPressedAt.current = 0;
          const route = G_ROUTES[key];
          if (route) {
            e.preventDefault();
            router.push(`/${lang}/${route}`);
            return;
          }
        } else if (key === 'g' && !e.shiftKey) {
          gPressedAt.current = Date.now();
          return;
        }
      }

      // ⌘K / Ctrl-K — toggle the command palette. Respect nested
      // scopes (editor's own ⌘K) so they don't double-fire.
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        // Pages with their own palette (the editor) mark their root; focus
        // usually sits on <body>, so checking the event target missed it.
        if (document.querySelector('[data-cmdk-scope]')) return;
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
  }, [lang, router]);

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
      id: 'nav:projects',
      label: t.projects,
      subLabel: t.navigate,
      icon: <FolderKanban size={16} />,
      shortcut: ['G', 'P'],
      action: go(`/${lang}/projects`),
    },
    {
      id: 'nav:runs',
      label: t.runs,
      subLabel: t.navigate,
      icon: <History size={16} />,
      action: go(`/${lang}/runs`),
    },
    {
      id: 'nav:sessions',
      label: t.sessions,
      subLabel: t.navigate,
      icon: <Columns3 size={16} />,
      action: go(`/${lang}/sessions`),
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
      icon: <ScrollText size={16} />,
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
      id: 'nav:terminal',
      label: t.terminal,
      subLabel: t.navigate,
      icon: <SquareTerminal size={16} />,
      shortcut: ['G', 'T'],
      action: go(`/${lang}/terminal`),
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
      id: 'nav:mcp-tester',
      label: t.mcpTester,
      subLabel: t.navigate,
      icon: <Plug size={16} />,
      shortcut: ['G', 'M'],
      action: go(`/${lang}/mcp-tester`),
    },
    {
      id: 'nav:agents',
      label: t.agents,
      subLabel: t.navigate,
      icon: <Zap size={16} />,
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
      action: go(`/${lang}/settings?tab=integrations`),
    },
    {
      id: 'nav:admin',
      label: t.admin,
      subLabel: t.navigate,
      icon: <ShieldCheck size={16} />,
      action: go(`/${lang}/settings?tab=workspace`),
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
