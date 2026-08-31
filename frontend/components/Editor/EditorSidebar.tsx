'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Database,
  FolderKanban,
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

import { DNAMark } from '@/components/Brand/DNAMark';
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
          id: 'projects',
          label: lang === 'en' ? 'Projects' : 'Proyectos',
          icon: FolderKanban,
          href: `/${lang}/projects`,
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
        <div className="flex h-[60px] items-center justify-between border-b border-[var(--panel-border)] bg-[rgba(255,255,255,0.02)] px-4">
          {showLabels && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <DNAMark size={24} primary="var(--op-moss)" />
              <span className="text-xl font-black tracking-tighter text-[var(--text-primary)]">
                Operari
              </span>
            </motion.div>
          )}
          {/* Collapsed sidebar still shows the mark so the brand never
              disappears when the user collapses the rail. */}
          {!showLabels && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto">
              <DNAMark size={24} primary="var(--op-moss)" />
            </motion.div>
          )}
          {showLabels && !isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-elevated)]"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Menu Groups */}
        <div className="custom-scrollbar flex-1 overflow-y-auto py-4">
          {menuGroups.map((group, groupIdx) => (
            <div key={group.id} className="mb-6">
              {showLabels && (
                <div className="mb-2 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-50">
                  {group.label}
                </div>
              )}
              {!showLabels && groupIdx > 0 && (
                <div className="mx-4 my-4 border-t border-[var(--panel-border)] opacity-30" />
              )}
              {group.items.map(item => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className={`group relative mx-3 my-1 flex cursor-pointer items-center rounded-xl px-3 py-2.5 transition-all duration-300 ${
                      isActive
                        ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]'
                    }`}
                    title={!showLabels ? item.label : ''}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute left-0 h-5 w-1 rounded-r-full bg-[var(--accent-color)]"
                      />
                    )}
                    <div
                      className={`flex min-w-0 items-center ${!showLabels ? 'min-w-0 justify-center' : ''}`}
                    >
                      <div className="flex w-6 justify-center">
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2.5 : 2}
                          className={isActive ? 'drop-shadow-[0_0_8px_rgba(62,207,142,0.5)]' : ''}
                        />
                      </div>
                      {showLabels && (
                        <span className="ml-3 text-sm font-bold tracking-tight">{item.label}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer / User */}
        <div className="border-t border-[var(--panel-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div
            className={`flex items-center ${!showLabels ? 'justify-center' : ''} group cursor-pointer rounded-xl p-2 transition-all hover:bg-[var(--panel-elevated)]`}
            onClick={() => router.push(`/${lang}/settings`)}
          >
            <div className="group-hover:border-[var(--accent-color)]/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-muted)] transition-all group-hover:text-[var(--accent-color)]">
              <User size={18} />
            </div>
            {showLabels && (
              <div className="ml-3 overflow-hidden">
                <div className="truncate text-xs font-black text-[var(--text-primary)]">
                  {displayName}
                </div>
                <div className="truncate text-[10px] font-medium text-[var(--text-muted)]">
                  {displayEmail}
                </div>
              </div>
            )}
          </div>

          {showLabels && (
            <div className="mt-4 flex items-center justify-between px-2">
              <button
                onClick={() => router.push(`/${lang}/settings`)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:bg-[var(--panel-elevated)] hover:text-[var(--text-primary)]"
                title={lang === 'en' ? 'Settings' : 'Configuración'}
              >
                <Settings size={16} />
              </button>
              {session && session.user.id !== 'anonymous' && (
                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="hover:bg-[var(--op-sunset)]/10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:text-[var(--op-sunset)] disabled:opacity-50"
                  title={lang === 'en' ? 'Sign out' : 'Cerrar sesión'}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
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
          className="fixed left-4 top-4 z-[60] rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2.5 text-[var(--text-primary)] shadow-2xl backdrop-blur-xl"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: drawerOpen ? 0 : '-100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed left-0 top-0 z-[56] flex h-screen w-[280px] flex-col border-r border-[var(--panel-border)] bg-[var(--app-bg)] text-[var(--text-primary)] shadow-2xl"
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
        className="relative z-50 flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-primary)] backdrop-blur-xl"
        initial={{ width: 240 }}
        animate={{ width: collapsed ? 70 : 240 }}
        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
      >
        {renderContents(false)}
      </motion.div>
    </>
  );
}
