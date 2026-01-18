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
    Settings
} from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface EditorSidebarProps {
    lang: 'en' | 'es';
}

export default function EditorSidebar({ lang }: EditorSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    const menuItems = [
        { id: 'dashboard', label: lang === 'en' ? 'Dashboard' : 'Panel', icon: LayoutDashboard, href: `/${lang}/dashboard` },
        { id: 'scheduler', label: lang === 'en' ? 'Schedules' : 'Horarios', icon: CalendarClock, href: `/${lang}/scheduler` },
        { id: 'workflows', label: lang === 'en' ? 'Workflows' : 'Flujos', icon: Share2, href: `/${lang}/workflows` },
        { id: 'editor', label: lang === 'en' ? 'Editor' : 'Editor', icon: Activity, href: `/${lang}/editor` },
        { id: 'monitors', label: lang === 'en' ? 'Monitors' : 'Monitores', icon: Activity, href: `/${lang}/monitors` },
        { id: 'events', label: lang === 'en' ? 'Events' : 'Eventos', icon: Zap, href: `/${lang}/events` },
        { id: 'utilities', label: lang === 'en' ? 'Utilities' : 'Utilidades', icon: Wrench, href: `/${lang}/utilities` },
        { id: 'admin', label: lang === 'en' ? 'Admin' : 'Admin', icon: ShieldCheck, href: `/${lang}/admin` },
    ];

    return (
        <motion.div
            className="h-screen bg-[var(--sidebar-background-color)] flex flex-col border-r border-[var(--border-color)] relative z-50 text-[var(--sidebar-text-color)]"
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
            {/* Header / Logo */}
            <div className="h-[50px] flex items-center justify-between px-3 border-b border-[var(--border-color)] bg-[rgba(0,0,0,0.1)]">
                {!collapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-bold text-lg tracking-wider text-white"
                    >
                        NanoFlow
                    </motion.div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-2">
                {menuItems.map(item => {
                    const isActive = pathname?.includes(item.id) || (item.id === 'editor' && pathname?.includes('/editor'));
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`
                                flex items-center cursor-pointer mx-2 my-1 px-3 py-2 rounded-md transition-all duration-200
                                ${isActive ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-white/5 text-gray-400 hover:text-white'}
                            `}
                            title={collapsed ? item.label : ''}
                        >
                            <div className="min-w-[20px] flex justify-center">
                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            {!collapsed && (
                                <motion.span
                                    className="ml-3 text-sm font-medium truncate"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    {item.label}
                                </motion.span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Footer / User */}
            <div className="p-2 border-t border-[var(--border-color)] bg-[rgba(0,0,0,0.2)]">
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'px-2'} py-2 rounded hover:bg-white/5 cursor-pointer text-gray-400 hover:text-white transition-colors`}>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                        <User size={16} />
                    </div>
                    {!collapsed && (
                        <motion.div
                            className="ml-3 overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="text-xs font-bold text-white truncate">Administrator</div>
                            <div className="text-[10px] text-gray-500 truncate">admin@xyops.io</div>
                        </motion.div>
                    )}
                </div>
                <div className={`mt-1 flex items-center ${collapsed ? 'justify-center' : 'justify-end gap-2'}`}>
                    <button className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white" title="Settings">
                        <Settings size={14} />
                    </button>
                    {!collapsed && (
                        <button className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white" title="Logout">
                            <LogOut size={14} />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
