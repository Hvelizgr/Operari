'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    <div className="bg-secondary/50 border-border flex items-center gap-1 rounded-full border p-1 backdrop-blur-sm">
      {['en', 'es'].map(locale => {
        const isActive = lang === locale;
        return (
          <Link key={locale} href={switchLang(locale)} scroll={false}>
            <div className="relative z-10 cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors">
              {isActive && (
                <motion.div
                  layoutId="activeLang"
                  className="bg-background border-border absolute inset-0 rounded-full border shadow-sm"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {locale.toUpperCase()}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
