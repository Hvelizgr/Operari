'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { content } from '@/app/[lang]/content/en';

type NavbarProps = {
    content: typeof content.navigation;
    lang: string;
};

export default function Navbar({ content, lang }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { scrollY } = useScroll();

    const backgroundOpacity = useTransform(scrollY, [0, 50], [0, 1]);
    const borderOpacity = useTransform(scrollY, [0, 50], [0, 1]);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        // Initial check
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.header
            className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 transition-all duration-300"
            style={{
                backgroundColor: `rgba(9, 9, 11, ${isScrolled ? 0.6 : 0})`, // #09090b with opacity
                backdropFilter: isScrolled ? "blur(16px)" : "none",
            }}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-20">
                {/* Logo */}
                <Link href={`/${lang}`} className="flex items-center gap-2 font-bold text-xl tracking-tighter">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                    </div>
                    NanoFlow
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
                    <Link href={`/${lang}/automation`} className="hover:text-foreground transition-colors">{content.product}</Link>
                    <Link href={`/${lang}/solutions`} className="hover:text-foreground transition-colors">{content.solutions}</Link>
                    <Link href={`/${lang}/pricing`} className="hover:text-foreground transition-colors">{content.pricing}</Link>
                    <Link href={`/${lang}/docs`} className="hover:text-foreground transition-colors">{content.docs}</Link>
                </nav>

                {/* Listeners & Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <LanguageSwitcher lang={lang} />
                    <Link href={`/${lang}/login`} className="text-sm font-medium hover:text-primary transition-colors">
                        {content.login}
                    </Link>
                    <Link
                        href={`/${lang}/register`}
                        className="text-sm font-bold bg-foreground text-background px-4 py-2 rounded-lg hover:bg-foreground/80 transition-colors"
                    >
                        {content.getStarted}
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="md:hidden p-2 text-foreground"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-20 left-4 right-4 bg-card border border-border rounded-xl shadow-2xl p-6 flex flex-col gap-6 md:hidden"
                >
                    <nav className="flex flex-col gap-4 text-lg font-medium">
                        <Link href={`/${lang}/automation`} className="hover:text-primary">{content.product}</Link>
                        <Link href={`/${lang}/solutions`} className="hover:text-primary">{content.solutions}</Link>
                        <Link href={`/${lang}/pricing`} className="hover:text-primary">{content.pricing}</Link>
                        <Link href={`/${lang}/docs`} className="hover:text-primary">{content.docs}</Link>
                    </nav>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">{content.login}</span>
                        <LanguageSwitcher lang={lang} />
                    </div>
                    <Link href={`/${lang}/register`} className="w-full">
                        <button className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl">
                            {content.getStarted}
                        </button>
                    </Link>
                </motion.div>
            )}
        </motion.header>
    );
}
