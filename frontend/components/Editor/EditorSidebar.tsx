'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CalendarClock,
  ChevronDown,
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
  Network,
  Send,
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

interface MenuSection {
  id: string;
  label: string;
  defaultOpen: boolean;
  items: MenuItem[];
}

// localStorage key for which collapsible sections are open. Survives
// navigations so the user doesn't have to re-expand "Tools" every page load.
const SECTIONS_STORAGE_KEY = 'operari:sidebar:sections';

export default function EditorSidebar({ lang }: EditorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { session, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? '';

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
  const isAdmin = session?.user.role === 'ADMIN';
  const isAuthenticated = !!session && session.user.id !== 'anonymous';

  // Mobile drawer state — at < 640px the sidebar disappears entirely
  // and is reachable through a floating hamburger button.
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // User menu popover anchored at the bottom-left footer row. Radix
  // `Popover.Root` owns the open/close state, focus trap, and ESC /
  // outside-click dismissal — the previous hand-rolled mousedown
  // listener missed several keyboard paths.
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

  // Close drawer + user menu on route change
  useEffect(() => {
    setDrawerOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Top-level (always-visible) primary nav. The handful of routes a
  // user hits first — kept flat so they're one click away.
  const primaryItems: MenuItem[] = [
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
  ];

  // Collapsible sections. Items here are real surfaces but used less
  // often than the primary nav, so they hide behind a section toggle
  // to reduce noise. Tools + Library default closed.
  const sections: MenuSection[] = [
    {
      id: 'observability',
      label: lang === 'en' ? 'Observability' : 'Observabilidad',
      defaultOpen: true,
      items: [
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
      id: 'tools',
      label: lang === 'en' ? 'Tools' : 'Herramientas',
      defaultOpen: false,
      items: [
        {
          id: 'sql',
          label: 'SQL Editor',
          icon: Database,
          href: `/${lang}/sql-editor`,
        },
        {
          id: 'lineage',
          label: 'Lineage',
          icon: Network,
          href: `/${lang}/lineage`,
        },
        {
          id: 'http-tester',
          label: lang === 'en' ? 'API Tester' : 'Probador API',
          icon: Send,
          href: `/${lang}/http-tester`,
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
      defaultOpen: false,
      items: [
        {
          id: 'schedules',
          label: lang === 'en' ? 'Schedules' : 'Horarios',
          icon: CalendarClock,
          href: `/${lang}/schedules`,
        },
        {
          id: 'utilities',
          label: lang === 'en' ? 'Utilities' : 'Utilidades',
          icon: Wrench,
          href: `/${lang}/utilities`,
        },
      ],
    },
  ];

  // Section open/close state, hydrated from localStorage. Auto-opens
  // any section whose item matches the current route so the user
  // always sees their active page highlighted.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    for (const s of sections) seed[s.id] = s.defaultOpen;
    return seed;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Record<string, boolean>;
        setOpenSections(prev => ({ ...prev, ...stored }));
      }
    } catch {
      // ignore corrupt JSON
    }
  }, []);

  useEffect(() => {
    // Force-open any section whose item matches the active route.
    const matching = sections.find(s => s.items.some(i => pathname.startsWith(i.href)));
    if (matching && !openSections[matching.id]) {
      setOpenSections(prev => ({ ...prev, [matching.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / privacy mode
      }
      return next;
    });
  };

  const renderItem = (item: MenuItem, showLabels: boolean) => {
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
          className={`flex min-w-[240px] items-center ${!showLabels ? 'min-w-0 justify-center' : ''}`}
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
  };

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

        {/* Nav */}
        <div className="custom-scrollbar flex-1 overflow-y-auto py-4">
          {/* Primary (flat) */}
          <div className="mb-4">{primaryItems.map(item => renderItem(item, showLabels))}</div>

          {/* Collapsible sections. In icon-only mode we skip the toggle
              and render section items flat with a divider, since the
              chevron has nowhere to go and the section header would
              collapse to a stub. */}
          {sections.map((section, idx) => {
            if (!showLabels) {
              return (
                <div key={section.id}>
                  <div className="mx-4 my-3 border-t border-[var(--panel-border)] opacity-30" />
                  {section.items.map(item => renderItem(item, false))}
                </div>
              );
            }
            const isOpen = openSections[section.id] ?? section.defaultOpen;
            return (
              <div key={section.id} className={idx > 0 ? 'mt-2' : ''}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="group flex w-full items-center justify-between px-6 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-60 transition-opacity hover:opacity-100"
                  aria-expanded={isOpen}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isOpen ? '' : '-rotate-90'}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1">
                        {section.items.map(item => renderItem(item, true))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer / User menu trigger + popover */}
        <div className="relative border-t border-[var(--panel-border)] bg-[rgba(255,255,255,0.02)] p-3">
          <PopoverPrimitive.Root open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverPrimitive.Trigger asChild>
              <button
                className={`group flex w-full items-center rounded-xl p-2 transition-all hover:bg-[var(--panel-elevated)] data-[state=open]:bg-[var(--panel-elevated)] ${
                  !showLabels ? 'justify-center' : ''
                }`}
                title={!showLabels ? displayName : ''}
              >
                <div className="group-hover:border-[var(--accent-color)]/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-muted)] transition-all group-hover:text-[var(--accent-color)]">
                  <User size={18} />
                </div>
                {showLabels && (
                  <>
                    <div className="ml-3 flex-1 overflow-hidden text-left">
                      <div className="truncate text-xs font-black text-[var(--text-primary)]">
                        {displayName}
                      </div>
                      <div className="truncate text-[10px] font-medium text-[var(--text-muted)]">
                        {displayEmail}
                      </div>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`ml-2 text-[var(--text-muted)] transition-transform ${
                        userMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                )}
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                side="top"
                align="start"
                sideOffset={8}
                className={`data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in data-[side=top]:data-[state=closed]:slide-out-to-bottom-2 data-[side=top]:data-[state=open]:slide-in-from-bottom-2 z-[60] overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-2xl backdrop-blur-xl ${
                  showLabels ? 'w-[208px]' : 'w-56'
                }`}
              >
                <div className="border-b border-[var(--panel-border)] px-3 py-2">
                  <div className="truncate text-xs font-black text-[var(--text-primary)]">
                    {displayName}
                  </div>
                  <div className="truncate text-[10px] font-medium text-[var(--text-muted)]">
                    {displayEmail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push(`/${lang}/settings`);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-elevated)]"
                >
                  <Settings size={16} className="text-[var(--text-muted)]" />
                  {lang === 'en' ? 'Settings' : 'Configuración'}
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push(`/${lang}/admin`);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--panel-elevated)]"
                  >
                    <ShieldCheck size={16} className="text-[var(--text-muted)]" />
                    Admin
                  </button>
                )}
                {isAuthenticated && (
                  <>
                    <div className="border-t border-[var(--panel-border)]" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={signingOut}
                      className="hover:bg-[var(--op-sunset)]/10 flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-bold text-[var(--text-primary)] transition-colors hover:text-[var(--op-sunset)] disabled:opacity-50"
                    >
                      <LogOut size={16} />
                      {lang === 'en' ? 'Sign out' : 'Cerrar sesión'}
                    </button>
                  </>
                )}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
      </>
    );
  };

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
        className="bg-[var(--panel-bg)]/50 relative z-50 flex h-screen flex-shrink-0 flex-col border-r border-[var(--panel-border)] text-[var(--text-primary)] backdrop-blur-xl"
        initial={{ width: 240 }}
        animate={{ width: collapsed ? 70 : 240 }}
        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
      >
        {renderContents(false)}
      </motion.div>
    </>
  );
}
