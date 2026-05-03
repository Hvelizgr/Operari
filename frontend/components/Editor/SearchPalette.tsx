'use client';

import { Panel, useReactFlow } from '@xyflow/react';
import { Command } from 'cmdk';
import { Search, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFavorites } from '@/hooks/useFavorites';
import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { searchNodes } from './canvas/searchMatch';

interface SearchPaletteProps {
  lang: 'en' | 'es';
  open: boolean;
  onClose: () => void;
}

/**
 * Cmd+K quick-find. Substring search over node titles, primary config
 * previews, and type IDs. Arrow up/down to navigate; Enter to fitView
 * the match and pulse it; Esc to close.
 *
 * Match-pulse uses the existing `selected` flag (RF's own selection
 * machinery animates around it) plus a brief `data._pulseUntil` mark
 * we drop into node data and clear after PULSE_MS. The pulse class is
 * defined in globals.css so the animation runs without a React tick.
 */
export default function SearchPalette({ lang, open, onClose }: SearchPaletteProps) {
  const { fitView } = useReactFlow<RfNode, RfEdge>();
  const nodes = useEditorStore(s => s.nodes);
  const { favorites, isFavorite } = useFavorites();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Favorited step types pin to the top of the matches list so an
  // operator's most-used steps are always one keystroke away,
  // mirroring the palette and PaneNodeMenu behavior. cmdk handles
  // the keyboard navigation + filtering chrome; we still own the
  // ranking so favorites bubble up.
  const matches = useMemo(() => {
    const all = searchNodes(query, nodes);
    if (favorites.size === 0) return all;
    const favs = all.filter(m => favorites.has(m.type));
    const rest = all.filter(m => !favorites.has(m.type));
    return [...favs, ...rest];
  }, [query, nodes, favorites]);

  // Reset state on each open so the previous query doesn't bleed in.
  useEffect(() => {
    if (open) {
      setQuery('');
      // Defer focus to next paint so the input exists in the DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const jumpTo = useCallback(
    (id: string) => {
      // Mark the node as both selected (visible accent) and emit a
      // short pulse via data. The selected flag is reactive through
      // the store's `setNodes`-driven action.
      useEditorStore.setState(s => ({
        nodes: s.nodes.map(n =>
          n.id === id ? { ...n, selected: true } : n.selected ? { ...n, selected: false } : n
        ),
      }));
      fitView({ nodes: [{ id }], padding: 0.4, duration: 400 });
      onClose();
    },
    [fitView, onClose]
  );

  if (!open) return null;

  const placeholder = lang === 'es' ? 'Buscar pasos…' : 'Search steps…';
  const emptyHint = lang === 'es' ? 'Sin resultados' : 'No results';

  return (
    <Panel
      position="top-center"
      className="bg-[color:var(--rb-node-bg)]/95 z-50 w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[color:var(--rb-node-border)] shadow-2xl backdrop-blur"
    >
      <Command
        loop
        // We pre-rank `matches` (favorites bubble first) and let our
        // own `searchNodes` handle the filter — disable cmdk's built-in
        // filter so it doesn't re-sort our ordered list.
        shouldFilter={false}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search size={14} className="text-[color:var(--rb-node-muted)]" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-[color:var(--rb-node-text)] placeholder:text-[color:var(--rb-node-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded p-1 text-[color:var(--rb-node-muted)] transition-colors hover:bg-white/5 hover:text-[color:var(--rb-node-text)]"
          >
            <X size={14} />
          </button>
        </div>

        <Command.List className="max-h-72 overflow-y-auto py-1 text-sm">
          <Command.Empty className="px-3 py-2 text-[color:var(--rb-node-muted)]">
            {emptyHint}
          </Command.Empty>
          {matches.map(match => {
            const fav = isFavorite(match.type);
            return (
              <Command.Item
                key={match.id}
                value={`${match.title ?? ''} ${match.type} ${match.preview ?? ''} ${match.id}`}
                onSelect={() => jumpTo(match.id)}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[color:var(--rb-node-text)] transition-colors data-[selected=true]:bg-white/10 data-[selected=true]:text-white"
              >
                {fav ? (
                  <Star
                    size={11}
                    fill="currentColor"
                    className="shrink-0 text-[color:var(--op-gold)]"
                    aria-label="favorite"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{match.title || match.type}</div>
                  {match.preview ? (
                    <div className="truncate font-mono text-[11px] text-[color:var(--rb-node-muted)]">
                      {match.preview}
                    </div>
                  ) : null}
                </div>
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </Panel>
  );
}
