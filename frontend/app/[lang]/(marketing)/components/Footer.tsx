'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Github } from 'lucide-react';
import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';

interface FooterProps {
    content: typeof content.footer;
}

/**
 * Footer — minimal, honest, only links that actually exist.
 *
 * The previous footer had Twitter/LinkedIn icons that pointed nowhere
 * and "About / Blog / Careers" links to nothing. Killed all of that.
 * Every link in this footer goes to a real page on GitHub. The
 * tagline restates the wedge so the last thing the visitor reads is
 * the positioning, not boilerplate "© 2024".
 */
export default function Footer({ content }: FooterProps) {
    const year = new Date().getFullYear();
    const params = useParams();
    const lang = (params?.lang as string) || 'en';

    return (
        <footer className="pt-16 pb-8 bg-background border-t border-border/60">
            <div className="container px-4 md:px-6 mx-auto max-w-6xl">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    {/* Brand block */}
                    <div className="col-span-2">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M4 18 L12 6 L20 18 Z" />
                                    <path d="M8 14 L16 14" />
                                </svg>
                            </div>
                            <span className="font-bold text-xl tracking-tight text-foreground">NanoRun</span>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
                            {content.tagline}
                        </p>
                        <a
                            href={repo.base}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Github className="w-4 h-4" />
                            {repo.displayHost}
                        </a>
                    </div>

                    {/* Link columns from content */}
                    {content.columns.map((column) => (
                        <div key={column.title}>
                            <h4 className="font-semibold mb-4 text-foreground text-xs uppercase tracking-wider">
                                {column.title}
                            </h4>
                            <ul className="space-y-2.5 text-sm text-muted-foreground">
                                {column.links.map((link) => {
                                    const isInternal = link.href.startsWith('/');
                                    return (
                                        <li key={link.label}>
                                            {isInternal ? (
                                                <Link
                                                    href={`/${lang}${link.href}`}
                                                    className="hover:text-foreground transition-colors"
                                                >
                                                    {link.label}
                                                </Link>
                                            ) : (
                                                <a
                                                    href={link.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:text-foreground transition-colors"
                                                >
                                                    {link.label}
                                                </a>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="pt-8 border-t border-border/40 text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
                    <p>© {year} NanoRun · {content.rights}</p>
                    <div className="flex gap-6">
                        <Link href="/en" className="hover:text-foreground transition-colors">English</Link>
                        <Link href="/es" className="hover:text-foreground transition-colors">Español</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
