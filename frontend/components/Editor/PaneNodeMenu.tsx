'use client';

import { useReactFlow } from '@xyflow/react';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { defaultConfigForType, NODE_CATALOG } from './canvas/catalog';

interface PaneNodeMenuProps {
  /** Screen-space pointer coords at which the menu opens. Converted
   *  to flow coords once a step type is picked. */
  screenX: number;
  screenY: number;
  /** Source node + handle the dropped edge came from. The new node's
   *  first input handle becomes the target. */
  sourceNodeId: string;
  sourceHandle: string | null;
  lang: 'en' | 'es';
  onClose: () => void;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The "drop a connection on empty canvas" menu — borrowed from
 * chaiNNer's PaneNodeSearchMenu pattern. When `onConnectEnd` reports
 * the user released the connection drag without landing on a target,
 * Canvas opens this menu at the pointer. The operator picks a step
 * type from the searchable list and we wire the new step at that flow
 * position with the original source handle pre-connected.
 *
 * Skips frame and note types — neither is a valid runbook step
 * downstream of an existing step.
 */
export default function PaneNodeMenu({
  screenX,
  screenY,
  sourceNodeId,
  sourceHandle,
  lang,
  onClose,
}: PaneNodeMenuProps) {
  const { screenToFlowPosition } = useReactFlow<RfNode, RfEdge>();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter the catalog by query; exclude frame and note (don't make
  // sense as the downstream step of a freshly drawn connection).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Array.from(NODE_CATALOG.values()).filter(
      def => def.type !== 'custom.frame' && def.type !== 'custom.note'
    );
    if (!q) return all;
    return all.filter(
      def =>
        def.label[lang].toLowerCase().includes(q) ||
        def.type.toLowerCase().includes(q) ||
        def.description?.[lang].toLowerCase().includes(q)
    );
  }, [query, lang]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Click-outside dismiss. Listening on `mousedown` (not click) so the
  // menu doesn't close mid-pointer-up if the operator drag-released
  // outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const create = useCallback(
    (type: string) => {
      const def = NODE_CATALOG.get(type);
      if (!def) return;
      const flowPos = screenToFlowPosition({ x: screenX, y: screenY });
      const id = newId();
      const newNode: RfNode = {
        id,
        type,
        position: flowPos,
        data: {
          workflow: {
            title: def.label[lang],
            enabled: true,
            config: defaultConfigForType(type),
          },
        },
        selected: true,
      };
      // Pre-wire the connection from the source handle to the new
      // node's first input. Goes through `onConnect` so cycle
      // validation + autosave run normally.
      const newEdge: RfEdge = {
        id: newId(),
        source: sourceNodeId,
        target: id,
        type: 'smart',
        ...(sourceHandle !== null ? { sourceHandle } : {}),
        targetHandle: '0',
        data: {},
      };
      const store = useEditorStore.getState();
      // Deselect previously-selected nodes so the freshly created step
      // is the lone selection (matches the post-drop expectation).
      useEditorStore.setState(s => ({
        nodes: [...s.nodes.map(n => (n.selected ? { ...n, selected: false } : n)), newNode],
        edges: [...s.edges, newEdge],
        status: 'dirty',
      }));
      void store; // silence unused-var if linting picks it up
      onClose();
    },
    [lang, onClose, screenToFlowPosition, screenX, screenY, sourceHandle, sourceNodeId]
  );

  const clampIdx = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, matches.length - 1)),
    [matches.length]
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
        if (match) create(match.type);
      }
    },
    [activeIdx, clampIdx, create, matches, onClose]
  );

  const placeholder = lang === 'es' ? 'Conectar a…' : 'Connect to…';
  const hint = matches.length === 0 ? (lang === 'es' ? 'Sin resultados' : 'No results') : null;

  return (
    <div
      ref={containerRef}
      className="bg-[color:var(--rb-node-bg)]/95 absolute z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[color:var(--rb-node-border)] shadow-2xl backdrop-blur"
      style={{ left: screenX, top: screenY }}
      // Stop pointer events from propagating to the canvas — RF would
      // otherwise interpret a click here as starting a marquee.
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Search size={12} className="text-[color:var(--rb-node-muted)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs text-[color:var(--rb-node-text)] placeholder:text-[color:var(--rb-node-muted)] focus:outline-none"
        />
      </div>

      <ul className="max-h-64 overflow-y-auto py-1 text-xs" role="listbox">
        {matches.map((def, idx) => (
          <li
            key={def.type}
            role="option"
            aria-selected={idx === activeIdx}
            onClick={() => create(def.type)}
            onMouseEnter={() => setActiveIdx(idx)}
            className={[
              'flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors',
              idx === activeIdx ? 'bg-white/10 text-white' : 'text-[color:var(--rb-node-text)]',
            ].join(' ')}
          >
            <span className="flex h-5 w-5 items-center justify-center">{def.icon}</span>
            <span className="flex-1 truncate font-medium">{def.label[lang]}</span>
          </li>
        ))}
        {hint ? <li className="px-3 py-2 text-[color:var(--rb-node-muted)]">{hint}</li> : null}
      </ul>
    </div>
  );
}
