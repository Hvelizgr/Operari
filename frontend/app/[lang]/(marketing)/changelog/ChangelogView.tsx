'use client';

import { motion } from 'framer-motion';
import { GitMerge, Package, Rss, Sparkles, Tag, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { content as contentEn } from '../../content/en';

type Changelog = typeof contentEn.changelog;
type Entry = Changelog['entries'][number];

const TAG_META: Record<
  string,
  {
    color: string;
    border: string;
    text: string;
    icon: typeof Sparkles;
  }
> = {
  feature: {
    color: 'bg-primary/15',
    border: 'border-primary/40',
    text: 'text-primary',
    icon: Sparkles,
  },
  refactor: {
    color: 'bg-foreground/10',
    border: 'border-foreground/20',
    text: 'text-foreground/80',
    icon: GitMerge,
  },
  fix: {
    color: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    icon: Wrench,
  },
  sdk: {
    color: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    icon: Package,
  },
};

const MONTH_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Changelog — timeline rail.
 *
 * Differs from a generic feed: there is no big H1 hero. The page opens
 * straight into a vertical rail (sticky month labels on the left, entry
 * cards on the right). Each entry card carries a tag-specific mini
 * "release strip" that visually signals what shipped without us having
 * to author per-entry custom illustrations.
 */
export default function ChangelogView({ content, lang }: { content: Changelog; lang: string }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(
    () => Array.from(new Set(content.entries.map(e => e.tag))),
    [content.entries]
  );
  const filtered = useMemo(
    () => (activeTag ? content.entries.filter(e => e.tag === activeTag) : content.entries),
    [activeTag, content.entries]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    filtered.forEach(e => {
      const key = e.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const months = lang === 'es' ? MONTH_ES : MONTH_EN;

  return (
    <main className="bg-background relative min-h-screen">
      {/* Top toolbar — eyebrow + tag filters. No big H1. */}
      <div className="border-border/50 bg-background/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border-primary/30 text-primary flex h-9 w-9 items-center justify-center rounded-lg border">
              <Rss className="h-4 w-4" />
            </div>
            <div>
              <p className="text-primary font-mono text-[10px] font-semibold uppercase tracking-[0.2em]">
                {content.eyebrow}
              </p>
              <p className="text-foreground text-sm font-semibold">{content.title}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={activeTag === null}
              onClick={() => setActiveTag(null)}
              label={lang === 'es' ? 'Todo' : 'All'}
            />
            {tags.map(t => (
              <FilterChip
                key={t}
                active={activeTag === t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
                label={t}
                tone={t}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6">
        {grouped.map(([yearMonth, entries]) => {
          const [year, month] = yearMonth.split('-');
          const label = `${months[parseInt(month, 10) - 1]} ${year}`;
          return (
            <section
              key={yearMonth}
              className="mb-14 grid gap-6 last:mb-0 md:grid-cols-[160px,1fr] md:gap-10"
            >
              {/* Sticky month label */}
              <div className="md:sticky md:top-24 md:self-start">
                <h2 className="text-muted-foreground font-mono text-xs uppercase tracking-[0.18em]">
                  {label}
                </h2>
                <div className="bg-primary/40 mt-2 hidden h-px w-12 md:block" />
              </div>

              {/* Entries on the rail */}
              <div className="relative pl-8">
                {/* Vertical rail */}
                <div className="bg-border/40 absolute bottom-2 left-2 top-2 w-px" />

                <div className="space-y-8">
                  {entries.map((entry, i) => (
                    <EntryRow key={entry.version} entry={entry} index={i} lang={lang} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
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
  const meta = tone ? TAG_META[tone] : undefined;
  if (active) {
    return (
      <button
        onClick={onClick}
        className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold capitalize ${
          meta
            ? `${meta.color} ${meta.border} ${meta.text}`
            : 'bg-primary text-primary-foreground border-primary'
        }`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold capitalize transition-colors"
    >
      {label}
    </button>
  );
}

function EntryRow({ entry, index, lang }: { entry: Entry; index: number; lang: string }) {
  const meta = TAG_META[entry.tag] ?? TAG_META.feature;
  const Icon = meta.icon;

  return (
    <motion.article
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.35, delay: Math.min(index, 4) * 0.05 }}
      className="relative"
    >
      {/* Rail dot */}
      <div
        className={`absolute -left-[28px] top-2 h-4 w-4 rounded-full border-2 ${meta.border} ${meta.color} flex items-center justify-center`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${meta.text.replace('text-', 'bg-')}`} />
      </div>

      <div className="border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/60 overflow-hidden rounded-xl border transition-colors">
        {/* Tag-colored header strip */}
        <div
          className={`flex items-center justify-between border-b px-4 py-2.5 sm:px-5 ${meta.border} ${meta.color}`}
        >
          <div className="flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
            <span
              className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${meta.text}`}
            >
              {entry.tag}
            </span>
          </div>
          <div className="text-foreground/70 flex items-center gap-3 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3 opacity-60" />
              {entry.version}
            </span>
            <span className="text-muted-foreground">{entry.date}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4 sm:px-5">
          <h3 className="text-foreground mb-2 text-base font-bold leading-snug sm:text-lg">
            {entry.title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{entry.body}</p>
        </div>

        {/* Tag-typed mini demo strip */}
        <ReleaseStrip entry={entry} lang={lang} />
      </div>
    </motion.article>
  );
}

/**
 * Mini "release strip" — a small, tag-typed visual at the bottom of
 * each entry. We don't hand-author per-entry illustrations; instead we
 * pick one of four templates by tag so the strip *visually changes* as
 * you scroll the feed. It's the difference between "list of cards" and
 * "moving timeline".
 */
function ReleaseStrip({ entry, lang }: { entry: Entry; lang: string }) {
  if (entry.tag === 'feature') {
    return (
      <div className="border-border/40 bg-background/40 text-muted-foreground flex items-center gap-3 border-t px-4 py-3 font-mono text-[11px] sm:px-5">
        <span className="text-emerald-400">+</span>
        <span>{lang === 'es' ? 'capacidad nueva en la API' : 'new capability on the API'}</span>
        <span className="text-primary/80 ml-auto">{entry.version}</span>
      </div>
    );
  }
  if (entry.tag === 'refactor') {
    return (
      <div className="border-border/40 bg-background/40 text-muted-foreground flex items-center gap-2 border-t px-4 py-3 font-mono text-[11px] sm:px-5">
        <span>workflow_*</span>
        <GitMerge className="text-foreground/60 h-3 w-3" />
        <span>runbook_*</span>
        <span className="text-foreground/70 ml-auto">{entry.version}</span>
      </div>
    );
  }
  if (entry.tag === 'sdk') {
    return (
      <div className="border-border/40 bg-background/40 flex items-center gap-3 border-t px-4 py-3 font-mono text-[11px] sm:px-5">
        <Package className="h-3.5 w-3.5 text-emerald-300" />
        <span className="text-emerald-300">@cairn/sdk</span>
        <span className="text-muted-foreground">→ npm</span>
        <span className="ml-auto text-emerald-300">{entry.version}</span>
      </div>
    );
  }
  return (
    <div className="border-border/40 bg-background/40 text-muted-foreground flex items-center gap-2 border-t px-4 py-3 font-mono text-[11px] sm:px-5">
      <Wrench className="h-3 w-3 text-amber-300" />
      <span>{lang === 'es' ? 'parche aplicado' : 'patch applied'}</span>
      <span className="ml-auto text-amber-300">{entry.version}</span>
    </div>
  );
}
