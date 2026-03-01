'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    CalendarClock,
    Share2,
    Activity,
    Zap,
    Wrench,
    ShieldCheck,
    LogOut,
    User,
    ChevronLeft,
    ChevronRight,
    Settings,
    Key,
    BarChart3,
    CreditCard,
    BookOpen,
    Terminal,
    Bot
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '@/context/SubscriptionContext';

interface EditorSidebarProps {
    lang: 'en' | 'es';
}

export default function EditorSidebar({ lang }: EditorSidebarProps) {
    const pathname = usePathname();
    const isEditorPage = pathname?.endsWith('/editor') || pathname?.match(/\/[a-z]{2}\/editor$/);
    
    const [collapsed, setCollapsed] = useState(isEditorPage ? true : false);
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
    const { plan, features } = useSubscription();

    useEffect(() => {
        setMounted(true);
        if (isEditorPage) {
            setCollapsed(true);
        }
        const storedUser = localStorage.getItem('nanoflow_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to parse user', e);
            }
        }
    }, [isEditorPage]);

    const sections = [
        {
            title: lang === 'en' ? 'Main' : 'Principal',
            items: [
                { id: 'dashboard', label: lang === 'en' ? 'Dashboard' : 'Panel', icon: LayoutDashboard, href: `/${lang}/dashboard`, show: true },
                { id: 'workflows', label: lang === 'en' ? 'Workflows' : 'Flujos', icon: Share2, href: `/${lang}/workflows`, show: true },
                { id: 'agents', label: lang === 'en' ? 'Agents' : 'Agentes', icon: Bot, href: `/${lang}/agents`, show: true },
                { id: 'editor', label: lang === 'en' ? 'Editor' : 'Editor', icon: Activity, href: `/${lang}/editor`, show: true },
            ]
        },
        {
            title: lang === 'en' ? 'Activity' : 'Actividad',
            items: [
                { id: 'analytics', label: lang === 'en' ? 'Analytics' : 'Analíticas', icon: BarChart3, href: `/${lang}/analytics`, show: true },
                { id: 'monitors', label: lang === 'en' ? 'Monitors' : 'Monitores', icon: Activity, href: `/${lang}/monitors`, show: true },
                { id: 'events', label: lang === 'en' ? 'Events' : 'Eventos', icon: Zap, href: `/${lang}/events`, show: true },
            ]
        },
        {
            title: lang === 'en' ? 'Tools' : 'Herramientas',
            items: [
                { id: 'credentials', label: lang === 'en' ? 'Credentials' : 'Credenciales', icon: Key, href: `/${lang}/credentials`, show: true },
                { id: 'nodes', label: lang === 'en' ? 'Explore Nodes' : 'Explorar Nodos', icon: BookOpen, href: `/${lang}/nodes`, show: true },
                { id: 'scheduler', label: lang === 'en' ? 'Schedules' : 'Horarios', icon: CalendarClock, href: `/${lang}/scheduler`, show: true },
                { id: 'utilities', label: lang === 'en' ? 'Utilities' : 'Utilidades', icon: Terminal, href: `/${lang}/utilities`, show: true },
            ]
        }
    ];

    if (!mounted) return null;

    return (
        <motion.div
            className="h-screen bg-[#09090b] flex flex-col border-r border-[#27272a] relative z-50 text-[#a1a1aa] shadow-xl"
            initial={{ width: 240 }}
            animate={{ width: collapsed ? 64 : 240 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {/* Header / Logo */}
            <div className="h-[60px] flex items-center justify-between px-4 border-b border-[#27272a] bg-[#09090b]">
                {!collapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 font-bold text-lg tracking-tight text-white"
                    >
                        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                            <Zap size={14} className="text-white" fill="currentColor" />
                        </div>
                        NanoFlow
                    </motion.div>
                )}
                 {/* Mobile / Collapse Toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`p-1.5 hover:bg-[#27272a] rounded-md transition-colors text-[#a1a1aa] hover:text-white ${collapsed ? 'mx-auto' : ''}`}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 custom-scrollbar">
                {sections.map((section, idx) => {
                    const visibleItems = section.items.filter(i => i.show);
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={idx} className="mb-6">
                            {!collapsed && (
                                <div className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                                    {section.title}
                                </div>
                            )}
                            <div className="space-y-0.5 px-2">
                                {visibleItems.map(item => {
                                    const isActive = pathname?.includes(item.id) || (item.id === 'editor' && pathname?.includes('/editor'));
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.id}
                                            href={item.href}
                                            onClick={(e) => {
                                                if (isEditorPage && item.id === 'nodes') {
                                                    e.preventDefault();
                                                    // Trigger node palette via custom event since we can't easily pass props across layout boundary
                                                    window.dispatchEvent(new CustomEvent('nanoflow:open-node-palette'));
                                                }
                                            }}
                                            className={`
                                                flex items-center cursor-pointer px-3 py-2 rounded-md transition-all duration-200 group
                                                ${isActive 
                                                    ? 'bg-blue-600/10 text-blue-500' 
                                                    : 'hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]'}
                                            `}
                                            title={collapsed ? item.label : ''}
                                        >
                                            <div className={`min-w-[20px] flex justify-center ${isActive ? 'text-blue-500' : 'text-[#71717a] group-hover:text-[#f4f4f5]'}`}>
                                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                            </div>
                                            {!collapsed && (
                                                <motion.span
                                                    className="ml-3 text-sm font-medium truncate"
                                                    initial={{ opacity: 0, x: -5 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                >
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                            {collapsed && <div className="mx-2 my-2 h-[1px] bg-[#27272a]" />}
                        </div>
                    );
                })}
            </div>

            {/* Footer / User Area */}
            <div className="p-3 border-t border-[#27272a] bg-[#09090b]">
                {/* User Info Block */}
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'px-2'} py-2 mb-2 rounded-lg bg-[#27272a]/50 border border-[#27272a]`}>
                     <div className="w-8 h-8 min-w-[32px] rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center border border-white/10 shadow-inner">
                        <span className="text-xs font-bold text-white">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </span>
                    </div>
                    {!collapsed && (
                        <motion.div
                            className="ml-3 overflow-hidden flex-1"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="text-sm font-medium text-[#f4f4f5] truncate">{user?.name || 'Guest User'}</div>
                            <div className="text-xs text-[#71717a] truncate">{plan.toUpperCase()} PLAN</div>
                        </motion.div>
                    )}
                </div>

                {/* Settings Actions */}
                <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between gap-1'}`}>
                    <Link 
                        href={`/${lang}/settings/profile`}
                        className={`flex items-center justify-center p-2 hover:bg-[#27272a] rounded-md text-[#a1a1aa] hover:text-white transition-colors ${!collapsed ? 'flex-1' : 'w-full'}`}
                        title="User Settings"
                    >
                         <Settings size={16} />
                         {!collapsed && <span className="ml-2 text-xs">Settings</span>}
                    </Link>
                    
                    <button 
                         className={`flex items-center justify-center p-2 hover:bg-red-900/20 hover:text-red-400 rounded-md text-[#a1a1aa] transition-colors ${!collapsed ? 'flex-1' : 'w-full'}`}
                         title="Logout"
                         onClick={() => {
                             localStorage.clear();
                             window.location.href = `/${lang}/login`;
                         }}
                    >
                         <LogOut size={16} />
                         {!collapsed && <span className="ml-2 text-xs">Logout</span>}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
