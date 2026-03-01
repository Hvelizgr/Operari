'use client';

import { Card, Link } from "@heroui/react";
import { useParams, usePathname } from "next/navigation";
import { User, CreditCard, Monitor, Shield, BookOpen, ChevronRight, Sparkles } from "lucide-react";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const params = useParams();
    const lang = (params?.lang as string) || 'en';

    const menuItems = [
        { id: 'profile', label: 'Profile', icon: User, href: `/settings/profile` },
        { id: 'billing', label: 'Billing & Plans', icon: CreditCard, href: `/settings/billing` },
        { id: 'editor', label: 'Editor Preferences', icon: Monitor, href: `/settings/editor` },
        { id: 'skills', label: 'AI Skills', icon: Sparkles, href: `/settings/skills` },
        { id: 'team', label: 'Team Members', icon: Shield, href: `/settings/team` }, // Future
        { id: 'audit', label: 'Audit Logs', icon: BookOpen, href: `/settings/audit` }, // Future
    ];

    return (
        <div className="flex h-full min-h-screen bg-black text-white">
            {/* Settings Sidebar */}
            <div className="w-64 border-r border-[#27272a] bg-[#09090b] p-6 hidden md:block">
                <h2 className="text-xl font-bold mb-6 px-2">Settings</h2>
                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname?.includes(item.href);
                        return (
                            <Link
                                key={item.id}
                                href={`/${lang}${item.href}`}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    isActive 
                                        ? 'bg-blue-600/10 text-blue-500' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-black">
                <div className="max-w-5xl mx-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
