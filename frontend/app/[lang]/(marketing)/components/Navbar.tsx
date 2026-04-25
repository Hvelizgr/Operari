'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Github, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { content } from '@/app/[lang]/content/en';
import { DNAMark } from '@/components/Brand/DNAMark';
import { repo } from '@/config/repo.config';

import LanguageSwitcher from './LanguageSwitcher';

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
    <motion.header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={`flex w-full max-w-6xl items-center justify-between rounded-xl px-4 py-3 transition-[background,border,box-shadow,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:rounded-2xl sm:px-5 ${
          isScrolled
            ? 'bg-background/70 border-border/60 border shadow-[0_10px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl'
            : 'border border-transparent bg-transparent'
        }`}
      >
        {/* Logo */}
        <Link
          href={`/${lang}`}
          className="text-foreground group flex items-center gap-2.5 text-lg font-bold tracking-tight"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[-4deg] group-hover:scale-[1.04]">
            <DNAMark size={20} />
          </div>
          NanoRun
        </Link>

        {/* Desktop nav — dedicated routes for Product/Triggers,
                    anchor for Compare (still landing-only). */}
        <nav className="text-muted-foreground hidden items-center gap-7 text-sm font-medium md:flex">
          <Link
            href={`/${lang}/product`}
            className="nav-link-slide hover:text-foreground transition-colors"
          >
            {content.product}
          </Link>
          <Link
            href={`/${lang}/triggers`}
            className="nav-link-slide hover:text-foreground transition-colors"
          >
            Triggers
          </Link>
          <Link
            href={`/${lang}/templates`}
            className="nav-link-slide hover:text-foreground transition-colors"
          >
            Templates
          </Link>
          <Link
            href={`/${lang}/pricing`}
            className="nav-link-slide hover:text-foreground transition-colors"
          >
            {lang === 'es' ? 'Precios' : 'Pricing'}
          </Link>
          <a href="#compare" className="nav-link-slide hover:text-foreground transition-colors">
            {lang === 'es' ? 'Comparar' : 'Compare'}
          </a>
          <a
            href={repo.readme}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link-slide hover:text-foreground transition-colors"
          >
            {content.docs}
          </a>
        </nav>

        {/* Right actions */}
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher lang={lang} />
          <a
            href={repo.base}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-5 w-5" />
          </a>
          <Link
            href={`/${lang}/editor`}
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            {lang === 'es' ? 'Entrar' : 'Sign in'}
          </Link>
          <Link
            href={`/${lang}/signup`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-md transition-colors"
          >
            {content.getStarted}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="text-foreground p-2 md:hidden"
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
          className="bg-card border-border absolute left-4 right-4 top-20 flex flex-col gap-6 rounded-xl border p-6 shadow-2xl md:hidden"
        >
          <nav className="flex flex-col gap-4 text-base font-medium">
            <Link
              href={`/${lang}/product`}
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-primary"
            >
              {content.product}
            </Link>
            <Link
              href={`/${lang}/triggers`}
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-primary"
            >
              Triggers
            </Link>
            <Link
              href={`/${lang}/templates`}
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-primary"
            >
              Templates
            </Link>
            <Link
              href={`/${lang}/pricing`}
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-primary"
            >
              {lang === 'es' ? 'Precios' : 'Pricing'}
            </Link>
            <a
              href="#compare"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-primary"
            >
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
          <div className="bg-border h-px" />
          <div className="flex items-center justify-between">
            <LanguageSwitcher lang={lang} />
            <a
              href={repo.base}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
          <Link
            href={`/${lang}/signup`}
            onClick={() => setMobileMenuOpen(false)}
            className="bg-primary text-primary-foreground shadow-primary/20 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-center font-semibold shadow-md"
          >
            {content.getStarted}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/${lang}/editor`}
            onClick={() => setMobileMenuOpen(false)}
            className="text-muted-foreground hover:text-foreground text-center text-sm"
          >
            {lang === 'es' ? 'Abrir editor' : 'Open editor'}
          </Link>
        </motion.div>
      )}
    </motion.header>
  );
}
