'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Rss } from 'lucide-react';
import type { content as contentEn } from '../../content/en';

type Changelog = typeof contentEn.changelog;
type Entry = Changelog['entries'][number];

const TAG_COLORS: Record<string, string> = {
  feature: 'bg-primary/15 text-primary border-primary/40',
  refactor: 'bg-foreground/10 text-foreground/80 border-foreground/20',
  fix: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  sdk: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
};

const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ChangelogView({ content, lang }: { content: Changelog; lang: string }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(() => Array.from(new Set(content.entries.map((e) => e.tag))), [content.entries]);
  const filtered = useMemo(
    () => (activeTag ? content.entries.filter((e) => e.tag === activeTag) : content.entries),
    [activeTag, content.entries]
  );

  // Group by year-month
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    filtered.forEach((e) => {
      const key = e.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const months = lang === 'es' ? MONTH_ES : MONTH_EN;

  return (
    <main className="relative bg-background">
      {/* Subtle vertical-line paper texture that reads "editorial / feed". */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.6), rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px)',
        }}
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-4 sm:px-6 max-w-3xl pt-28 pb-24 sm:pt-32">
        {/* Header — left-aligned, editorial */}
        <header className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 border-b border-border/50 pb-8">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-primary mb-3">
              <Rss className="w-3.5 h-3.5" />
              {content.eyebrow}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3 leading-[1.05]">
              {content.title}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              {content.subtitle}
            </p>
          </div>

          {/* Tag filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={activeTag === null}
              onClick={() => setActiveTag(null)}
              label={lang === 'es' ? 'Todo' : 'All'}
            />
            {tags.map((t) => (
              <FilterChip
                key={t}
                active={activeTag === t}
                onClick={() => setActiveTag(t)}
                label={t}
                tone={t}
              />
            ))}
          </div>
        </header>

        {/* Month-grouped feed */}
        <div className="space-y-14">
          {grouped.map(([yearMonth, entries]) => {
            const [year, month] = yearMonth.split('-');
            const label = `${months[parseInt(month, 10) - 1]} ${year}`;
            return (
              <section key={yearMonth}>
                {/* Month heading sticks to the left, mimics a blog archive */}
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-3">
                  {label}
                  <span className="flex-1 h-px bg-border/40" />
                </h2>

                <div className="space-y-6">
                  {entries.map((entry, i) => (
                    <EntryCard key={entry.version} entry={entry} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: string;
}) {
  if (active) {
    return (
      <button
        onClick={onClick}
        className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${tone ? TAG_COLORS[tone] : 'bg-primary text-primary-foreground border-primary'} capitalize`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors capitalize"
    >
      {label}
    </button>
  );
}

function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.35, delay: Math.min(index, 3) * 0.05 }}
      className="group relative rounded-xl border border-border/60 bg-card/40 p-5 sm:p-6 hover:border-primary/40 transition-colors"
    >
      <header className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold rounded-md px-2 py-0.5 border ${TAG_COLORS[entry.tag] ?? TAG_COLORS.feature}`}
        >
          {entry.tag}
        </span>
        <span className="font-mono text-xs font-semibold text-foreground/90">{entry.version}</span>
        <span className="font-mono text-xs text-muted-foreground">{entry.date}</span>
      </header>
      <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 leading-snug">
        {entry.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{entry.body}</p>
    </motion.article>
  );
}
