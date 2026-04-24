'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquare,
  Settings,
  Share2,
  ShieldCheck,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import GlobalCommandPalette from '@/components/Common/GlobalCommandPalette';
import StatusPill from '@/components/Common/StatusPill';
import { useAuth } from '@/lib/auth';

interface EditorSidebarProps {
  lang: 'en' | 'es';
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

export default function EditorSidebar({ lang }: EditorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { session, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
    router.replace(`/${lang}/login`);
  }

  const displayName =
    session?.user.name?.trim() ||
    session?.user.email?.split('@')[0] ||
    (lang === 'en' ? 'Anonymous' : 'Anónimo');
  const displayEmail = session?.user.email ?? '';
  // Mobile drawer state — at < 640px the sidebar disappears entirely
  // and is reachable through a floating hamburger button. Tracks
  // viewport size with a matchMedia listener so the sidebar reacts
  // to window resizes without a reload.
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqMobile = window.matchMedia('(max-width: 640px)');
    const mqTablet = window.matchMedia('(max-width: 1024px)');
    const sync = () => {
      setIsMobile(mqMobile.matches);
      // Tablet (641-1024px) auto-collapses to icon-only.
      // Mobile (≤640px) hides the sidebar entirely (drawer mode).
      if (mqTablet.matches && !mqMobile.matches) setCollapsed(true);
      else if (!mqTablet.matches) setCollapsed(false);
    };
    sync();
    mqMobile.addEventListener('change', sync);
    mqTablet.addEventListener('change', sync);
    return () => {
      mqMobile.removeEventListener('change', sync);
      mqTablet.removeEventListener('change', sync);
    };
  }, []);

  // Close drawer on route change so the user doesn't have to dismiss it manually
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Grouped navigation. OPERATE = what a user hits first during an
  // incident. EXPLORE = investigative tools (SQL + dev surfaces).
  // LIBRARY = configuration-time stuff. ADMIN sits at the bottom by
  // gravity, separate from operational flow.
  const menuGroups: MenuGroup[] = [
    {
      id: 'operate',
      label: lang === 'en' ? 'Operate' : 'Operar',
      items: [
        {
          id: 'dashboard',
          label: lang === 'en' ? 'Dashboard' : 'Panel',
          icon: LayoutDashboard,
          href: `/${lang}/dashboard`,
        },
        {
          id: 'runbooks',
          label: 'Runbooks',
          icon: Share2,
          href: `/${lang}/runbooks`,
        },
        {
          id: 'runs',
          label: lang === 'en' ? 'Run history' : 'Historial',
          icon: History,
          href: `/${lang}/runs`,
        },
        {
          id: 'inbox',
          label: lang === 'en' ? 'Inbox' : 'Bandeja',
          icon: Inbox,
          href: `/${lang}/inbox`,
        },
        {
          id: 'monitors',
          label: lang === 'en' ? 'Monitors' : 'Monitores',
          icon: Activity,
          href: `/${lang}/monitors`,
        },
        {
          id: 'events',
          label: lang === 'en' ? 'Events' : 'Eventos',
          icon: Zap,
          href: `/${lang}/events`,
        },
      ],
    },
    {
      id: 'explore',
      label: lang === 'en' ? 'Explore' : 'Explorar',
      items: [
        {
          id: 'sql',
          label: lang === 'en' ? 'SQL Editor' : 'SQL Editor',
          icon: Database,
          href: `/${lang}/sql-editor`,
        },
        {
          id: 'agents',
          label: lang === 'en' ? 'Agents' : 'Agentes',
          icon: Bot,
          href: `/${lang}/agents`,
        },
        {
          id: 'chat',
          label: lang === 'en' ? 'AI Assistant' : 'Asistente IA',
          icon: MessageSquare,
          href: `/${lang}/chat`,
        },
      ],
    },
    {
      id: 'library',
      label: lang === 'en' ? 'Library' : 'Biblioteca',
      items: [
        {
          id: 'schedules',
          label: lang === 'en' ? 'Schedules' : 'Horarios',
          icon: CalendarClock,
          href: `/${lang}/schedules`,
        },
        {
          id: 'tools',
          label: lang === 'en' ? 'Utilities' : 'Utilidades',
          icon: Wrench,
          href: `/${lang}/utilities`,
        },
      ],
    },
    {
      id: 'admin',
      label: lang === 'en' ? 'Admin' : 'Admin',
      items: [
        {
          id: 'admin',
          label: lang === 'en' ? 'Admin' : 'Admin',
          icon: ShieldCheck,
          href: `/${lang}/admin`,
        },
      ],
    },
  ];

  // The actual sidebar content (header, menu, footer). Extracted as
  // a function so the desktop and the mobile-drawer renders share
  // exactly the same JSX without duplication.
  const renderContents = (forceExpanded: boolean) => {
    const showLabels = !collapsed || forceExpanded;
    return (
      <>
        {/* Header / Logo */}
        <div className="flex h-[50px] items-center justify-between border-b border-[var(--border-color)] bg-[rgba(0,0,0,0.1)] px-3">
          {showLabels && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold tracking-wider text-white"
            >
              NanoRun
            </motion.div>
          )}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded p-1 transition-colors hover:bg-white/10"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded p-1 transition-colors hover:bg-white/10"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Menu Groups */}
        <div className="flex-1 overflow-y-auto py-2">
          {menuGroups.map((group, groupIdx) => (
            <div key={group.id}>
              {/* Separator line between groups. When collapsed, a
                  plain hairline stands in for the label so the
                  grouping is still visible. */}
              {groupIdx > 0 && (
                <div className="mx-3 my-2 border-t border-white/5" aria-hidden="true" />
              )}
              {showLabels && (
                <div className="mb-1 mt-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className={`mx-2 my-0.5 flex cursor-pointer items-center rounded-md px-3 py-2 transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                    title={!showLabels ? item.label : ''}
                  >
                    <div className="flex min-w-[20px] justify-center">
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {showLabels && (
                      <motion.span
                        className="ml-3 truncate text-sm font-medium"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer / User */}
        <div className="border-t border-[var(--border-color)] bg-[rgba(0,0,0,0.2)] p-2">
          <div
            className={`flex items-center ${!showLabels ? 'justify-center' : 'px-2'} rounded py-2 text-gray-400 transition-colors`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-700">
              <User size={16} />
            </div>
            {showLabels && (
              <motion.div
                className="ml-3 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="truncate text-xs font-bold text-white">{displayName}</div>
                <div className="truncate text-[10px] text-gray-500">{displayEmail}</div>
              </motion.div>
            )}
          </div>
          <div
            className={`mt-1 flex items-center ${!showLabels ? 'justify-center' : 'justify-end gap-2'}`}
          >
            <button
              onClick={() => router.push(`/${lang}/settings`)}
              className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
              title={lang === 'en' ? 'Settings' : 'Configuración'}
            >
              <Settings size={14} />
            </button>
            {showLabels && session && session.user.id !== 'anonymous' && (
              <button
                onClick={handleLogout}
                disabled={signingOut}
                className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                title={lang === 'en' ? 'Sign out' : 'Cerrar sesión'}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  // Mobile: hamburger + drawer + backdrop. The hamburger lives at
  // top-left so it doesn't fight with the page TopBars.
  if (isMobile) {
    return (
      <>
        <StatusPill lang={lang} />
        <GlobalCommandPalette lang={lang} />
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed left-3 top-3 z-[60] rounded-md border border-white/10 bg-[#2a2f3a] p-2 text-white shadow-lg"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        {drawerOpen && (
          <div className="fixed inset-0 z-[55] bg-black/60" onClick={() => setDrawerOpen(false)} />
        )}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: drawerOpen ? 0 : '-100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 32 }}
          className="fixed left-0 top-0 z-[56] flex h-screen w-[240px] flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-background-color)] text-[var(--sidebar-text-color)]"
          style={
            {
              '--sidebar-background-color': '#2a2f3a',
              '--sidebar-text-color': '#ccc',
              '--sidebar-active-background': '#3ecf8e',
              '--sidebar-active-text': '#fff',
            } as React.CSSProperties
          }
        >
          {renderContents(true)}
        </motion.div>
      </>
    );
  }

  return (
    <>
      <StatusPill lang={lang} />
      <GlobalCommandPalette lang={lang} />
      <motion.div
        className="relative z-50 flex h-screen flex-shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-background-color)] text-[var(--sidebar-text-color)]"
        initial={{ width: 220 }}
        animate={{ width: collapsed ? 50 : 220 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={
          {
            '--sidebar-background-color': '#2a2f3a',
            '--sidebar-text-color': '#ccc',
            '--sidebar-active-background': '#3b82f6',
            '--sidebar-active-text': '#fff',
          } as React.CSSProperties
        }
      >
        {renderContents(false)}
      </motion.div>
    </>
  );
}
