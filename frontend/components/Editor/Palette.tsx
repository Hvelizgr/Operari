'use client';

import type { NodeType } from '@/components/Node/NodePalette';
import { useFavorites } from '@/hooks/useFavorites';
import { Panel } from '@xyflow/react';
import { ChevronDown, ChevronRight, Search, Star, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

import { NODE_CATALOG } from './canvas/catalog';
import { dragChannel } from './canvas/dragChannel';
import { rankByQuery } from './canvas/searchMatch';

interface PaletteProps {
  lang: 'en' | 'es';
}

// Categories defined here so the palette has its own ordering and
// doesn't need to import them from the legacy V1 NodePalette. The
// `id` matches `NodeType.category` values from the catalog.
const CATEGORIES: Array<{ id: string; label: { en: string; es: string } }> = [
  { id: 'devops', label: { en: 'Runbook core', es: 'Runbook core' } },
  { id: 'triggers', label: { en: 'Triggers', es: 'Triggers' } },
  { id: 'core', label: { en: 'Core', es: 'Core' } },
  { id: 'organization', label: { en: 'Organization', es: 'Organización' } },
];

const TEXT = {
  en: {
    title: 'Steps',
    subtitle: 'Drag to canvas',
    toggleOpen: 'Add step',
    toggleClose: 'Close',
    search: 'Search steps…',
    favorites: 'Favorites',
    noResults: 'No steps found',
  },
  es: {
    title: 'Pasos',
    subtitle: 'Arrastrá al canvas',
    toggleOpen: 'Agregar paso',
    toggleClose: 'Cerrar',
    search: 'Buscar pasos…',
    favorites: 'Favoritos',
    noResults: 'Sin resultados',
  },
} as const;

function PaletteRow({
  def,
  lang,
  isFavorite,
  onToggleFav,
}: {
  def: NodeType;
  lang: 'en' | 'es';
  isFavorite: boolean;
  onToggleFav: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => dragChannel.set(def.type)}
      className="group flex cursor-move items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-[color:var(--rb-node-border)] hover:bg-white/5"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white shadow-sm ${def.color}`}
      >
        {def.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[color:var(--rb-node-text)]">
          {def.label[lang]}
        </div>
        {def.description ? (
          <div className="truncate text-[11px] text-[color:var(--rb-node-muted)]">
            {def.description[lang]}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onToggleFav();
        }}
        aria-label={isFavorite ? 'Unpin favorite' : 'Pin as favorite'}
        title={isFavorite ? 'Unpin favorite' : 'Pin as favorite'}
        className={`flex h-6 w-6 items-center justify-center rounded transition-opacity ${
          isFavorite
            ? 'text-[color:var(--op-gold)] opacity-100'
            : 'text-[color:var(--rb-node-muted)] opacity-0 hover:text-[color:var(--op-gold)] group-hover:opacity-100'
        }`}
      >
        <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

/**
 * Native V2 palette: replaces the V1 NodePalette wrapper that pulled
 * Tailwind-hex colors and missed the new chrome (favorites, brand
 * tokens, n-gram ranking).
 *
 * Drag-drop still goes through `dragChannel` (module-scoped side
 * channel) because RF's `onDrop` reads from a separate event handler
 * and HTML5 `DataTransfer` would force a parallel string format.
 *
 * Layout: floating panel top-left under the UndoRedo + selection
 * pills. Open/close button at the top mirrors V1's UX.
 */
export default function Palette({ lang }: PaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['devops', 'triggers']));
  const { favorites, isFavorite, toggle: toggleFav } = useFavorites();
  const t = TEXT[lang];

  const allTypes = useMemo(() => Array.from(NODE_CATALOG.values()), []);

  // Result organisation:
  //   - With a query: ranked flat list (n-gram).
  //   - Empty query: favorites section + per-category accordion.
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return rankByQuery(
      q,
      allTypes,
      def => `${def.label[lang]} ${def.type} ${def.description?.[lang] ?? ''}`
    ).map(r => r.item);
  }, [query, allTypes, lang]);

  const favoritesList = useMemo(
    () => allTypes.filter(d => favorites.has(d.type)),
    [allTypes, favorites]
  );

  const byCategory = useMemo(() => {
    const grouped: Record<string, NodeType[]> = {};
    for (const cat of CATEGORIES) grouped[cat.id] = [];
    for (const def of allTypes) {
      const bucket = grouped[def.category];
      if (bucket) bucket.push(def);
    }
    return grouped;
  }, [allTypes]);

  const toggleCategory = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Panel position="top-left" className="ml-1 mt-24">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          className="flex items-center gap-2 self-start rounded-lg bg-[color:var(--op-moss)] px-3 py-1.5 text-sm font-semibold text-black shadow-lg transition-colors hover:brightness-110"
        >
          <Zap size={14} />
          {isOpen ? t.toggleClose : t.toggleOpen}
        </button>

        {isOpen ? (
          <div className="bg-[color:var(--rb-node-bg)]/95 w-72 overflow-hidden rounded-xl border border-[color:var(--rb-node-border)] shadow-2xl backdrop-blur">
            <div className="border-b border-white/10 px-3 py-2">
              <div className="text-sm font-bold text-[color:var(--rb-node-text)]">{t.title}</div>
              <div className="text-[11px] text-[color:var(--rb-node-muted)]">{t.subtitle}</div>
            </div>

            <div className="border-b border-white/10 p-2">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--rb-node-muted)]"
                />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t.search}
                  className="focus:ring-[color:var(--op-moss)]/40 w-full rounded border border-white/10 bg-black/30 py-1.5 pl-7 pr-7 text-xs text-[color:var(--rb-node-text)] placeholder:text-[color:var(--rb-node-muted)] focus:border-[color:var(--op-moss)] focus:outline-none focus:ring-1"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--rb-node-muted)] hover:text-[color:var(--rb-node-text)]"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-1">
              {filtered ? (
                filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[color:var(--rb-node-muted)]">
                    {t.noResults}
                  </div>
                ) : (
                  <div>
                    {filtered.map(def => (
                      <PaletteRow
                        key={def.type}
                        def={def}
                        lang={lang}
                        isFavorite={isFavorite(def.type)}
                        onToggleFav={() => toggleFav(def.type)}
                      />
                    ))}
                  </div>
                )
              ) : (
                <>
                  {favoritesList.length > 0 ? (
                    <section className="mb-2 border-b border-white/5 pb-2">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--op-gold)]">
                        {t.favorites}
                      </div>
                      {favoritesList.map(def => (
                        <PaletteRow
                          key={`fav-${def.type}`}
                          def={def}
                          lang={lang}
                          isFavorite
                          onToggleFav={() => toggleFav(def.type)}
                        />
                      ))}
                    </section>
                  ) : null}
                  {CATEGORIES.map(cat => {
                    const items = byCategory[cat.id] ?? [];
                    if (items.length === 0) return null;
                    const isExpanded = expanded.has(cat.id);
                    return (
                      <section key={cat.id} className="border-b border-white/5 last:border-0">
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--rb-node-muted)]">
                            {cat.label[lang]}
                          </span>
                          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-[color:var(--rb-node-muted)]">
                            {items.length}
                          </span>
                        </button>
                        {isExpanded ? (
                          <div className="pb-1">
                            {items.map(def => (
                              <PaletteRow
                                key={def.type}
                                def={def}
                                lang={lang}
                                isFavorite={isFavorite(def.type)}
                                onToggleFav={() => toggleFav(def.type)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
