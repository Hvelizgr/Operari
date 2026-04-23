'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, FileCode, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { TemplateLang, TemplateMeta } from './strings';

type Strings = {
  searchPlaceholder: string;
  countLabel: string;
  noResults: string;
  stepsLabel: string;
  previewLabel: string;
  viewCta: string;
  categoryAll: string;
};

/**
 * Templates page — shadcn-registry-style browser.
 *
 * Differs from the old categorized grid: the page no longer leads with a
 * giant marketing H1. Instead it opens with an instant-search bar +
 * category chips + counter, so the page reads as a *browsable catalog*
 * (Vercel templates / shadcn registry / Linear icons) rather than a
 * landing variant.
 *
 * Cards render in CSS columns for a masonry-ish flow (heights vary by
 * step count + description length), and each card slides up a YAML
 * preview on hover.
 */
export default function TemplatesRegistry({
  templates,
  lang,
  strings,
}: {
  templates: TemplateMeta[];
  lang: TemplateLang;
  strings: Strings;
}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(t => {
      if (activeCategory && t.category !== activeCategory) return false;
      if (!q) return true;
      const haystack =
        `${t.name} ${t.description ?? ''} ${t.category ?? ''} ${t.yaml}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [templates, query, activeCategory]);

  return (
    <div>
      {/* Top toolbar — search + count */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground/70 pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={strings.searchPlaceholder}
            className="bg-card/60 border-border/70 text-foreground placeholder-muted-foreground/60 focus:border-primary/50 focus:ring-primary/20 h-11 w-full rounded-xl border pl-10 pr-10 text-sm transition-all focus:outline-none focus:ring-2"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-muted-foreground font-mono text-xs tabular-nums">
          <span className="text-primary font-semibold">{filtered.length}</span> / {templates.length}{' '}
          {strings.countLabel}
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-10 flex flex-wrap items-center gap-1.5">
        <CategoryChip
          label={strings.categoryAll}
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map(c => (
          <CategoryChip
            key={c}
            label={c}
            active={activeCategory === c}
            onClick={() => setActiveCategory(cur => (cur === c ? null : c))}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border-border/60 bg-card/20 text-muted-foreground rounded-xl border border-dashed p-12 text-center">
          {strings.noResults}
        </div>
      ) : (
        <div className="columns-1 gap-4 [column-fill:_balance] md:columns-2 lg:columns-3">
          {filtered.map((tpl, i) => (
            <RegistryCard key={tpl.slug} template={tpl} lang={lang} strings={strings} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold capitalize transition-all ${
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-primary/30 shadow-sm'
          : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30'
      }`}
    >
      {label}
    </button>
  );
}

function RegistryCard({
  template,
  lang,
  strings,
  index,
}: {
  template: TemplateMeta;
  lang: TemplateLang;
  strings: Strings;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const previewLines = template.yaml
    .split('\n')
    .filter(l => !l.startsWith('#') && l.trim().length > 0)
    .slice(0, 7);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 9) * 0.04 }}
      className="mb-4 break-inside-avoid"
    >
      <Link
        href={`/${lang}/templates/${template.slug}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="border-border/60 bg-card/40 hover:bg-card/60 hover:border-primary/40 hover:shadow-primary/5 group block overflow-hidden rounded-xl border transition-all hover:shadow-xl"
      >
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileCode className="text-primary/70 h-4 w-4 shrink-0" />
              <span className="text-muted-foreground truncate font-mono text-[10px] uppercase tracking-wider">
                {template.category ?? 'general'} · {template.stepCount} {strings.stepsLabel}
              </span>
            </div>
            <ArrowUpRight className="text-muted-foreground/50 group-hover:text-primary h-3.5 w-3.5 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <h3 className="text-foreground mb-2 text-base font-semibold leading-tight">
            {template.name}
          </h3>
          {template.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{template.description}</p>
          )}
        </div>

        <AnimatePresence initial={false}>
          {hover && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="border-border/40 bg-background/40 overflow-hidden border-t"
            >
              <div className="px-5 py-3">
                <div className="text-muted-foreground/70 mb-1.5 font-mono text-[9px] uppercase tracking-widest">
                  {strings.previewLabel}
                </div>
                <pre className="text-foreground/80 overflow-hidden whitespace-pre font-mono text-[11px] leading-relaxed">
                  {previewLines.join('\n')}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>
    </motion.div>
  );
}
