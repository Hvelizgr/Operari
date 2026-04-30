'use client';

import { Panel, useReactFlow } from '@xyflow/react';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => searchNodes(query, nodes), [query, nodes]);

  // Reset state on each open so the previous query doesn't bleed in.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Defer focus to next paint so the input exists in the DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const clampIdx = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, matches.length - 1)),
    [matches.length]
  );

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(idx => clampIdx(idx + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(idx => clampIdx(idx - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const match = matches[activeIdx];
        if (match) jumpTo(match.id);
      }
    },
    [activeIdx, clampIdx, jumpTo, matches, onClose]
  );

  if (!open) return null;

  const placeholder = lang === 'es' ? 'Buscar pasos…' : 'Search steps…';
  const hint =
    matches.length === 0 && query.length > 0
      ? lang === 'es'
        ? 'Sin resultados'
        : 'No results'
      : null;

  return (
    <Panel
      position="top-center"
      className="bg-[color:var(--rb-node-bg)]/95 z-50 w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[color:var(--rb-node-border)] shadow-2xl backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Search size={14} className="text-[color:var(--rb-node-muted)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={handleKeyDown}
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

      <ul className="max-h-72 overflow-y-auto py-1 text-sm" role="listbox">
        {matches.map((match, idx) => (
          <li
            key={match.id}
            role="option"
            aria-selected={idx === activeIdx}
            onClick={() => jumpTo(match.id)}
            onMouseEnter={() => setActiveIdx(idx)}
            className={[
              'cursor-pointer px-3 py-1.5 transition-colors',
              idx === activeIdx ? 'bg-white/10 text-white' : 'text-[color:var(--rb-node-text)]',
            ].join(' ')}
          >
            <div className="truncate font-medium">{match.title || match.type}</div>
            {match.preview ? (
              <div className="truncate font-mono text-[11px] text-[color:var(--rb-node-muted)]">
                {match.preview}
              </div>
            ) : null}
          </li>
        ))}
        {hint ? <li className="px-3 py-2 text-[color:var(--rb-node-muted)]">{hint}</li> : null}
      </ul>
    </Panel>
  );
}
