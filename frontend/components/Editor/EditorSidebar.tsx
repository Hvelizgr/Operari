'use client';

import {
    LayoutDashboard,
    CalendarClock,
    Share2,
    Activity,
    Zap,
    Wrench,
    ShieldCheck,
    Inbox,
    History,
    LogOut,
    User,
    ChevronLeft,
    ChevronRight,
    Settings,
    MessageSquare,
    Bot,
    Menu,
    X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';

interface EditorSidebarProps {
    lang: 'en' | 'es';
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

    const displayName = session?.user.name?.trim() || session?.user.email?.split('@')[0] || (lang === 'en' ? 'Anonymous' : 'Anónimo');
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

    const menuItems = [
        { id: 'dashboard', label: lang === 'en' ? 'Dashboard' : 'Panel', icon: LayoutDashboard, href: `/${lang}/dashboard` },
        { id: 'chat', label: lang === 'en' ? 'AI Assistant' : 'Asistente IA', icon: MessageSquare, href: `/${lang}/chat` },
        { id: 'agents', label: lang === 'en' ? 'Agents' : 'Agentes', icon: Bot, href: `/${lang}/agents` },
        { id: 'schedules', label: lang === 'en' ? 'Schedules' : 'Horarios', icon: CalendarClock, href: `/${lang}/schedules` },
        { id: 'runbooks', label: lang === 'en' ? 'Runbooks' : 'Runbooks', icon: Share2, href: `/${lang}/runbooks` },
        { id: 'inbox', label: lang === 'en' ? 'Inbox' : 'Bandeja', icon: Inbox, href: `/${lang}/inbox` },
        { id: 'runs', label: lang === 'en' ? 'Run history' : 'Historial', icon: History, href: `/${lang}/runs` },
        { id: 'monitors', label: lang === 'en' ? 'Monitors' : 'Monitores', icon: Activity, href: `/${lang}/monitors` },
        { id: 'events', label: lang === 'en' ? 'Events' : 'Eventos', icon: Zap, href: `/${lang}/events` },
        { id: 'tools', label: lang === 'en' ? 'Utilities' : 'Utilidades', icon: Wrench, href: `/${lang}/utilities` },
        { id: 'admin', label: lang === 'en' ? 'Admin' : 'Admin', icon: ShieldCheck, href: `/${lang}/admin` },
    ];

    // The actual sidebar content (header, menu, footer). Extracted as
    // a function so the desktop and the mobile-drawer renders share
    // exactly the same JSX without duplication.
    const renderContents = (forceExpanded: boolean) => {
        const showLabels = !collapsed || forceExpanded;
        return (
            <>
                {/* Header / Logo */}
                <div className="h-[50px] flex items-center justify-between px-3 border-b border-[var(--border-color)] bg-[rgba(0,0,0,0.1)]">
                    {showLabels && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="font-bold text-lg tracking-wider text-white"
                        >
                            NanoRun
                        </motion.div>
                    )}
                    {!isMobile && (
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    )}
                    {isMobile && (
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            aria-label="Close menu"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto py-2">
                    {menuItems.map((item) => {
                        const href = 'href' in item ? item.href : undefined;
                        const isActive = href ? pathname.startsWith(href) : false;
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (href) router.push(href);
                                }}
                                className={`flex items-center cursor-pointer mx-2 my-1 px-3 py-2 rounded-md transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary text-white shadow-md'
                                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                                }`}
                                title={!showLabels ? item.label : ''}
                            >
                                <div className="min-w-[20px] flex justify-center">
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                {showLabels && (
                                    <motion.span
                                        className="ml-3 text-sm font-medium truncate"
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

                {/* Footer / User */}
                <div className="p-2 border-t border-[var(--border-color)] bg-[rgba(0,0,0,0.2)]">
                    <div className={`flex items-center ${!showLabels ? 'justify-center' : 'px-2'} py-2 rounded text-gray-400 transition-colors`}>
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                            <User size={16} />
                        </div>
                        {showLabels && (
                            <motion.div
                                className="ml-3 overflow-hidden"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <div className="text-xs font-bold text-white truncate">{displayName}</div>
                                <div className="text-[10px] text-gray-500 truncate">{displayEmail}</div>
                            </motion.div>
                        )}
                    </div>
                    <div className={`mt-1 flex items-center ${!showLabels ? 'justify-center' : 'justify-end gap-2'}`}>
                        <button
                            onClick={() => router.push(`/${lang}/settings`)}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                            title={lang === 'en' ? 'Settings' : 'Configuración'}
                        >
                            <Settings size={14} />
                        </button>
                        {showLabels && session && session.user.id !== 'anonymous' && (
                            <button
                                onClick={handleLogout}
                                disabled={signingOut}
                                className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white disabled:opacity-50"
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
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="fixed top-3 left-3 z-[60] p-2 rounded-md bg-[#2a2f3a] border border-white/10 text-white shadow-lg"
                    aria-label="Open menu"
                >
                    <Menu size={18} />
                </button>
                {drawerOpen && (
                    <div
                        className="fixed inset-0 z-[55] bg-black/60"
                        onClick={() => setDrawerOpen(false)}
                    />
                )}
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: drawerOpen ? 0 : '-100%' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                    className="fixed top-0 left-0 h-screen w-[240px] bg-[var(--sidebar-background-color)] flex flex-col border-r border-[var(--border-color)] z-[56] text-[var(--sidebar-text-color)]"
                    style={{
                        '--sidebar-background-color': '#2a2f3a',
                        '--sidebar-text-color': '#ccc',
                        '--sidebar-active-background': '#3ecf8e',
                        '--sidebar-active-text': '#fff',
                    } as any}
                >
                    {renderContents(true)}
                </motion.div>
            </>
        );
    }

    return (
        <motion.div
            className="h-screen bg-[var(--sidebar-background-color)] flex flex-col border-r border-[var(--border-color)] relative z-50 text-[var(--sidebar-text-color)] flex-shrink-0"
            initial={{ width: 220 }}
            animate={{ width: collapsed ? 50 : 220 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
                '--sidebar-background-color': '#2a2f3a',
                '--sidebar-text-color': '#ccc',
                '--sidebar-active-background': '#3b82f6',
                '--sidebar-active-text': '#fff'
            } as any}
        >
            {renderContents(false)}
        </motion.div>
    );
}
