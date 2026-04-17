'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Menu, X, Github, ArrowRight } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';

type NavbarProps = {
    content: typeof content.navigation;
    lang: string;
};

/**
 * Navbar — minimal, post-pivot.
 *
 * Removed every "#" placeholder link from the previous version. The
 * landing has 6 sections, all on one page, so we either anchor-link
 * to them or send users to GitHub. Pricing/Solutions are gone — they
 * were aspirational and we are pre-launch.
 */
export default function Navbar({ content, lang }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-3 sm:pt-4 px-3 sm:px-4">
            <div
                className={`w-full max-w-6xl rounded-xl sm:rounded-2xl flex items-center justify-between px-4 sm:px-5 py-3 transition-all duration-300 ${isScrolled ? 'bg-background/80 backdrop-blur-xl border border-border/60 shadow-lg shadow-black/20' : 'bg-transparent border border-transparent'}`}
            >
                {/* Logo */}
                <Link
                    href={`/${lang}`}
                    className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-foreground"
                >
                    <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M4 18 L12 6 L20 18 Z" />
                            <path d="M8 14 L16 14" />
                        </svg>
                    </div>
                    NanoRun
                </Link>

                {/* Desktop nav — anchor links + real page routes */}
                <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
                    <a href="#story" className="hover:text-foreground transition-colors">
                        {content.product}
                    </a>
                    <a href="#triggers" className="hover:text-foreground transition-colors">
                        Triggers
                    </a>
                    <Link href={`/${lang}/pricing`} className="hover:text-foreground transition-colors">
                        {lang === 'es' ? 'Precios' : 'Pricing'}
                    </Link>
                    <a href="#compare" className="hover:text-foreground transition-colors">
                        {lang === 'es' ? 'Comparar' : 'Compare'}
                    </a>
                    <a
                        href={repo.readme}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                    >
                        {content.docs}
                    </a>
                </nav>

                {/* Right actions */}
                <div className="hidden md:flex items-center gap-3">
                    <LanguageSwitcher lang={lang} />
                    <a
                        href={repo.base}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Github className="w-5 h-5" />
                    </a>
                    <Link
                        href={`/${lang}/editor`}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {lang === 'es' ? 'Entrar' : 'Sign in'}
                    </Link>
                    <Link
                        href={`/${lang}/editor`}
                        className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 inline-flex items-center gap-1.5"
                    >
                        {lang === 'es' ? 'Abrir editor' : 'Open editor'}
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Mobile toggle */}
                <button
                    className="md:hidden p-2 text-foreground"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-20 left-4 right-4 bg-card border border-border rounded-xl shadow-2xl p-6 flex flex-col gap-6 md:hidden"
                >
                    <nav className="flex flex-col gap-4 text-base font-medium">
                        <a href="#story" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">
                            {content.product}
                        </a>
                        <a href="#triggers" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">
                            Triggers
                        </a>
                        <Link href={`/${lang}/pricing`} onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">
                            {lang === 'es' ? 'Precios' : 'Pricing'}
                        </Link>
                        <a href="#compare" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">
                            {lang === 'es' ? 'Comparar' : 'Compare'}
                        </a>
                        <a
                            href={repo.readme}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary"
                        >
                            {content.docs}
                        </a>
                    </nav>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                        <LanguageSwitcher lang={lang} />
                        <a
                            href={repo.base}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="GitHub"
                        >
                            <Github className="w-5 h-5" />
                        </a>
                    </div>
                    <Link
                        href={`/${lang}/editor`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-center shadow-md shadow-primary/20 inline-flex items-center justify-center gap-2"
                    >
                        {lang === 'es' ? 'Abrir editor' : 'Open editor'}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                        href="#self-host"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-center text-sm text-muted-foreground hover:text-foreground"
                    >
                        {content.getStarted}
                    </a>
                </motion.div>
            )}
        </motion.header>
    );
}
