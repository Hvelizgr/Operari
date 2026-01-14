'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LanguageSwitcher({ lang }: { lang: string }) {
    const pathname = usePathname();

    // Helper to switch language in current path
    const switchLang = (targetLang: string) => {
        if (!pathname) return `/${targetLang}`;
        const segments = pathname.split('/');
        segments[1] = targetLang;
        return segments.join('/');
    };

    return (
        <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-1 border border-border backdrop-blur-sm">
            {['en', 'es'].map((locale) => {
                const isActive = lang === locale;
                return (
                    <Link key={locale} href={switchLang(locale)} scroll={false}>
                        <div className="relative px-3 py-1.5 rounded-full text-xs font-bold transition-colors z-10 cursor-pointer">
                            {isActive && (
                                <motion.div
                                    layoutId="activeLang"
                                    className="absolute inset-0 bg-background rounded-full shadow-sm border border-border"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={`relative z-10 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                {locale.toUpperCase()}
                            </span>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
