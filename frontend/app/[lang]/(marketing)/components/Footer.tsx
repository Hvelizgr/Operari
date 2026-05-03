'use client';

import { Github } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { content } from '@/app/[lang]/content/en';
import { DNAMark } from '@/components/Brand/DNAMark';
import { repo } from '@/config/repo.config';

import AuditHashTicker from './AuditHashTicker';

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
    <footer className="bg-background border-border/60 border-t">
      <AuditHashTicker lang={lang === 'es' ? 'es' : 'en'} />
      <div className="container mx-auto max-w-6xl px-4 pb-8 pt-16 md:px-6">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand block */}
          <div className="col-span-2">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 shadow-md shadow-emerald-500/10">
                <DNAMark size={20} />
              </div>
              <span className="text-foreground text-xl font-bold tracking-tight">Operari</span>
            </div>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm leading-relaxed">
              {content.tagline}
            </p>
            <a
              href={repo.base}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
            >
              <Github className="h-4 w-4" />
              {repo.displayHost}
            </a>
          </div>

          {/* Link columns from content */}
          {content.columns.map(column => (
            <div key={column.title}>
              <h4 className="text-foreground mb-4 text-xs font-semibold uppercase tracking-wider">
                {column.title}
              </h4>
              <ul className="text-muted-foreground space-y-2.5 text-sm">
                {column.links.map(link => {
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

        <div className="border-border/40 text-muted-foreground flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm md:flex-row">
          <p>
            © {year} Operari · {content.rights}
          </p>
          <div className="flex gap-6">
            <Link href="/en" className="hover:text-foreground transition-colors">
              English
            </Link>
            <Link href="/es" className="hover:text-foreground transition-colors">
              Español
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
