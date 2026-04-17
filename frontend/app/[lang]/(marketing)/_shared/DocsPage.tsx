'use client';

import { useEffect, useState } from 'react';

interface DocsSection {
  heading: string;
  body: string;
}

interface DocsPageProps {
  title: string;
  subtitle: string;
  updated: string;
  sections: DocsSection[];
  /** e.g. "§" (terms) or "#" (privacy) — prefixed in the TOC */
  numberStyle?: 'decimal' | 'section' | 'none';
  tocLabel: string;
}

/**
 * Shared docs layout for /privacy and /terms.
 *
 * Distinct from /security (marketing grid) and /changelog (feed): this is
 * a desktop two-column docs page with a sticky TOC on the left and
 * anchor-linked numbered sections on the right. On mobile the TOC
 * collapses into a bar at the top.
 */
export default function DocsPage({
  title,
  subtitle,
  updated,
  sections,
  numberStyle = 'decimal',
  tocLabel,
}: DocsPageProps) {
  const [active, setActive] = useState<string>(slugify(sections[0]?.heading ?? ''));

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sections.forEach((s) => {
      const id = slugify(s.heading);
      const el = document.getElementById(id);
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(id);
          });
        },
        { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  return (
    <main className="relative bg-background">
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl pt-28 pb-24 sm:pt-32">
        <header className="mb-10 sm:mb-14 pb-8 border-b border-border/50">
          <p className="font-mono text-xs text-primary uppercase tracking-[0.2em] mb-4">
            {updated}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3 leading-[1.05]">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">{subtitle}</p>
        </header>

        <div className="grid md:grid-cols-[220px,1fr] gap-8 sm:gap-12">
          {/* TOC — sticky sidebar on desktop, top bar on mobile */}
          <aside className="md:sticky md:top-28 md:self-start md:max-h-[calc(100vh-8rem)] md:overflow-y-auto">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-3 hidden md:block">
              {tocLabel}
            </p>
            <nav className="flex md:flex-col gap-0.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 border-border/40">
              {sections.map((s, i) => {
                const id = slugify(s.heading);
                const isActive = active === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`shrink-0 md:shrink px-3 py-1.5 text-xs rounded-md transition-all whitespace-nowrap md:whitespace-normal md:text-[13px] ${
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary md:rounded-l-none md:pl-2.5 font-semibold'
                        : 'text-muted-foreground hover:text-foreground md:border-l-2 md:border-transparent md:pl-2.5'
                    }`}
                  >
                    <span className="font-mono text-muted-foreground/60 mr-2">
                      {format(i + 1, numberStyle)}
                    </span>
                    {s.heading}
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Article body */}
          <article className="min-w-0 space-y-12 sm:space-y-14">
            {sections.map((s, i) => {
              const id = slugify(s.heading);
              return (
                <section key={id} id={id} className="scroll-mt-28">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-4 flex items-baseline gap-3">
                    <span className="font-mono text-sm text-primary font-semibold">
                      {format(i + 1, numberStyle)}
                    </span>
                    {s.heading}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {s.body}
                  </p>
                </section>
              );
            })}
          </article>
        </div>
      </div>
    </main>
  );
}

function format(n: number, style: 'decimal' | 'section' | 'none') {
  if (style === 'none') return '';
  if (style === 'section') return `§${n}`;
  return `${String(n).padStart(2, '0')}.`;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
