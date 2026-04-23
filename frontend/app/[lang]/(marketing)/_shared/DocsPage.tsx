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
 * Treated as a "legal book" rather than another marketing page:
 *   - serif headings (font-serif) for H1 + section titles, breaking
 *     from the geometric H1 used everywhere else on marketing
 *   - slim 65ch article column flanked by a sticky numbered TOC
 *   - each section opens with a serif drop-cap on the first letter so
 *     the page reads as paginated long-form, not as a flat KB article
 *   - monospace version banner at the top — small, subdued, no big pill
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
    sections.forEach(s => {
      const id = slugify(s.heading);
      const el = document.getElementById(id);
      if (!el) return;
      const io = new IntersectionObserver(
        entries => {
          entries.forEach(e => {
            if (e.isIntersecting) setActive(id);
          });
        },
        { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [sections]);

  return (
    <main className="bg-background relative">
      {/* Faux-paper rule: a thin top stripe + a parchment-warm tint to
          keep the page from looking like the rest of the dark marketing
          surface. Subtle on purpose. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.035]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 60% at 50% 0%, rgba(245,235,215,0.5), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        {/* Header — serif, no eyebrow pill */}
        <header className="border-border/40 mb-14 border-b pb-8 sm:mb-16">
          <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.18em]">
              {updated}
            </p>
            <p className="text-muted-foreground/60 font-mono text-[11px]">
              {sections.length} {sections.length === 1 ? 'section' : 'sections'}
            </p>
          </div>
          <h1 className="text-foreground mb-3 font-serif text-5xl leading-[1.02] tracking-[-0.01em] sm:text-6xl">
            {title}
          </h1>
          <p className="text-foreground/70 max-w-2xl font-serif text-lg italic sm:text-xl">
            {subtitle}
          </p>
        </header>

        <div className="grid gap-10 sm:gap-14 md:grid-cols-[220px,1fr]">
          {/* TOC — sticky sidebar on desktop, top bar on mobile */}
          <aside className="md:sticky md:top-28 md:max-h-[calc(100vh-8rem)] md:self-start md:overflow-y-auto">
            <p className="text-muted-foreground mb-3 hidden font-mono text-[10px] uppercase tracking-[0.2em] md:block">
              {tocLabel}
            </p>
            <nav className="border-border/40 flex gap-0.5 overflow-x-auto border-b pb-2 md:flex-col md:overflow-visible md:border-b-0 md:pb-0">
              {sections.map((s, i) => {
                const id = slugify(s.heading);
                const isActive = active === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-all md:shrink md:whitespace-normal md:text-[13px] ${
                      isActive
                        ? 'bg-primary/10 text-primary border-primary border-l-2 font-semibold md:rounded-l-none md:pl-2.5'
                        : 'text-muted-foreground hover:text-foreground md:border-l-2 md:border-transparent md:pl-2.5'
                    }`}
                  >
                    <span className="text-muted-foreground/60 mr-2 font-serif italic">
                      {format(i + 1, numberStyle)}
                    </span>
                    {s.heading}
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Article body — slim column for readability */}
          <article className="min-w-0 max-w-[65ch] space-y-12 sm:space-y-14">
            {sections.map((s, i) => {
              const id = slugify(s.heading);
              const isFirst = i === 0;
              return (
                <section key={id} id={id} className="scroll-mt-28">
                  <div className="text-primary/80 mb-2 font-mono text-[10px] uppercase tracking-[0.22em]">
                    {format(i + 1, numberStyle)}
                  </div>
                  <h2 className="text-foreground mb-4 font-serif text-2xl leading-tight tracking-[-0.01em] sm:text-3xl">
                    {s.heading}
                  </h2>
                  <p
                    className={`text-foreground/80 font-serif text-base leading-[1.75] sm:text-[17px] ${
                      isFirst
                        ? 'first-letter:text-primary first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-serif first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.9] sm:first-letter:text-6xl'
                        : ''
                    }`}
                  >
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
