'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { content as contentEn } from '../../content/en';

type Story = typeof contentEn.story;
type Safety = typeof contentEn.safety;

type ChapterKind = 'story' | 'safety';
type Chapter = {
  id: string;
  kind: ChapterKind;
  number: string;
  title: string;
  body: string;
  code?: string;
};

/**
 * Product — long-form guided tour.
 *
 * Distinct from the landing in three ways:
 *   1. Single column of "chapters", each with a massive number on the
 *      left and a code example on the right. The landing condenses the
 *      same 3 story beats into 3 cards; this page lets each one breathe.
 *   2. A scroll-progress rail (left edge) ticks through the 7 chapters
 *      so the reader always knows where they are in the tour.
 *   3. Numbers cross-fade through a gradient as you scroll past them so
 *      the page feels like reading a book, not browsing a feature list.
 */
export default function ProductView({
  story,
  safety,
  lang,
}: {
  story: Story;
  safety: Safety;
  lang: string;
}) {
  const chapters = buildChapters(story, safety);
  const [active, setActive] = useState(chapters[0].id);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    chapters.forEach(c => {
      const el = sectionRefs.current.get(c.id);
      if (!el) return;
      const io = new IntersectionObserver(
        entries => {
          entries.forEach(e => {
            if (e.isIntersecting) setActive(c.id);
          });
        },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [chapters]);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroNumberY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  return (
    <main className="bg-background relative">
      {/* HERO — title only; scroll cue invites the tour */}
      <section
        ref={heroRef}
        className="border-border/40 relative flex min-h-[80vh] items-center overflow-hidden border-b"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(62,207,142,0.6) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse 60% 70% at 50% 40%, black 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 60% 70% at 50% 40%, black 30%, transparent 75%)',
          }}
          aria-hidden="true"
        />

        <div className="container relative mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">
          <motion.div
            style={{ y: heroNumberY }}
            className="pointer-events-none absolute -left-6 -top-10 select-none sm:-left-12"
            aria-hidden="true"
          >
            <span className="text-primary/[0.06] font-serif text-[14rem] tabular-nums leading-none sm:text-[18rem]">
              {String(chapters.length).padStart(2, '0')}
            </span>
          </motion.div>

          <div className="relative">
            <span className="border-primary/30 bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              {lang === 'es' ? 'Tour del producto' : 'Product tour'}
            </span>
            <h1 className="text-foreground max-w-3xl text-5xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl md:text-7xl">
              {story.title}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {story.subtitle}
            </p>

            <div className="text-muted-foreground mt-12 flex items-center gap-3 text-sm">
              <ArrowDown className="text-primary h-4 w-4 animate-bounce" />
              <span>
                {chapters.length} {lang === 'es' ? 'capítulos · ~3 min' : 'chapters · ~3 min'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* TOUR — chapters with sticky progress rail */}
      <div className="relative">
        <ProgressRail chapters={chapters} active={active} />

        <div className="container mx-auto max-w-5xl space-y-28 px-4 py-20 sm:space-y-36 sm:px-6 sm:py-28">
          {chapters.map((chapter, i) => (
            <Chapter
              key={chapter.id}
              chapter={chapter}
              index={i}
              registerRef={el => {
                if (el) sectionRefs.current.set(chapter.id, el);
                else sectionRefs.current.delete(chapter.id);
              }}
              lang={lang}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="border-border/40 border-t">
        <div className="container mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-foreground mb-4 text-3xl font-bold sm:text-4xl">
            {lang === 'es' ? 'Tu turno.' : 'Your turn.'}
          </h2>
          <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-base">
            {lang === 'es'
              ? 'Cloná, levantá Docker y abrí el editor en localhost:3000. Tres minutos.'
              : 'Clone, run Docker, open the editor at localhost:3000. Three minutes.'}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={`/${lang}/signup`}
              className="bg-primary text-primary-foreground shadow-primary/25 hover:bg-primary/90 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-md"
            >
              {lang === 'es' ? 'Probar la API' : 'Try the API'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${lang}/templates`}
              className="border-border bg-secondary/30 text-foreground hover:bg-secondary/60 inline-flex h-12 items-center gap-2 rounded-xl border px-6 text-sm font-medium"
            >
              {lang === 'es' ? 'Ver templates' : 'Browse templates'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function buildChapters(story: Story, safety: Safety): Chapter[] {
  const chapters: Chapter[] = [];
  story.blocks.forEach(b => {
    chapters.push({
      id: `story-${b.number}`,
      kind: 'story',
      number: b.number,
      title: b.title,
      body: b.description,
      code: b.caption,
    });
  });
  safety.rails.forEach((r, i) => {
    chapters.push({
      id: `safety-${i}`,
      kind: 'safety',
      number: String(story.blocks.length + i + 1).padStart(2, '0'),
      title: r.title,
      body: r.description,
      code: r.example,
    });
  });
  return chapters;
}

function Chapter({
  chapter,
  index,
  registerRef,
  lang,
}: {
  chapter: Chapter;
  index: number;
  registerRef: (el: HTMLElement | null) => void;
  lang: string;
}) {
  const flip = index % 2 === 1;
  const isCode =
    chapter.kind === 'safety' ||
    /(\$|curl|kubectl|helm|name:|onError|defineStep|import |- id:)/.test(chapter.code ?? '');

  return (
    <motion.section
      ref={el => registerRef(el as HTMLElement | null)}
      id={chapter.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-120px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`grid scroll-mt-24 items-start gap-10 md:grid-cols-[180px,1fr] md:gap-14 ${flip ? 'md:[direction:rtl]' : ''}`}
    >
      <div
        className={`${flip ? 'md:[direction:ltr]' : ''} flex items-baseline gap-3 md:flex-col md:items-start md:gap-2`}
      >
        <span className="from-primary to-primary/60 bg-gradient-to-br via-emerald-300 bg-clip-text font-serif text-7xl font-bold tabular-nums leading-none text-transparent sm:text-8xl md:text-[8.5rem]">
          {chapter.number}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
            chapter.kind === 'story'
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
          }`}
        >
          {chapter.kind === 'story'
            ? lang === 'es'
              ? 'Cómo funciona'
              : 'How it works'
            : lang === 'es'
              ? 'Safety rail'
              : 'Safety rail'}
        </span>
      </div>

      <div className={`${flip ? 'md:[direction:ltr]' : ''} min-w-0`}>
        <h2 className="text-foreground mb-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {chapter.title}
        </h2>
        <p className="text-muted-foreground mb-7 text-base leading-relaxed sm:text-lg">
          {chapter.body}
        </p>

        {chapter.code && (
          <div className="border-border/60 bg-card/60 overflow-hidden rounded-xl border shadow-xl shadow-black/30 backdrop-blur-md">
            <div className="border-border/40 bg-background/40 flex items-center gap-1.5 border-b px-4 py-2.5">
              <span className="h-2 w-2 rounded-full bg-red-500/50" />
              <span className="h-2 w-2 rounded-full bg-amber-500/50" />
              <span className="bg-primary/60 h-2 w-2 rounded-full" />
              <span className="text-muted-foreground ml-3 font-mono text-[10px] uppercase tracking-wider">
                {isCode ? 'snippet' : 'note'}
              </span>
            </div>
            <pre className="text-foreground/90 overflow-x-auto whitespace-pre p-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
              {chapter.code}
            </pre>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function ProgressRail({ chapters, active }: { chapters: Chapter[]; active: string }) {
  const activeIndex = Math.max(
    0,
    chapters.findIndex(c => c.id === active)
  );
  return (
    <aside
      aria-hidden="true"
      className="fixed left-6 top-1/2 z-10 hidden -translate-y-1/2 lg:block"
    >
      <div className="flex flex-col items-center gap-3">
        {chapters.map((c, i) => (
          <a key={c.id} href={`#${c.id}`} className="group relative flex items-center">
            <span
              className={`block rounded-full transition-all ${
                i === activeIndex
                  ? 'bg-primary h-6 w-1.5'
                  : i < activeIndex
                    ? 'bg-primary/70 h-1.5 w-1.5'
                    : 'bg-border/60 group-hover:bg-foreground/40 h-1.5 w-1.5'
              }`}
            />
            <span
              className={`ml-3 font-mono text-[10px] tabular-nums transition-opacity ${
                i === activeIndex
                  ? 'text-primary opacity-100'
                  : 'text-muted-foreground opacity-0 group-hover:opacity-50'
              }`}
            >
              {c.number}
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
