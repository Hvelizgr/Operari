'use client';

import { Replace, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { defaultConfigForType, NODE_CATALOG } from './canvas/catalog';
import { rankByQuery } from './canvas/searchMatch';

interface ReplaceNodeMenuProps {
  targetId: string;
  lang: 'en' | 'es';
  onClose: () => void;
}

/**
 * Type-swap palette (n8n parity — keyboard `r` or context-menu
 * "Replace…"). The operator selects a target step and triggers
 * this menu; picking a new type calls `replaceNodeType` on the
 * editor store, which preserves edges, position, id, and any
 * config keys whose names also exist on the new type's defaults.
 *
 * Mounts as a positioned overlay anchored to the targeted node so
 * the swap reads as a focused operation rather than a generic
 * palette pop. Frame and note types are excluded — neither is a
 * valid replacement for a runbook step.
 */
export function ReplaceNodeMenu({ targetId, lang, onClose }: ReplaceNodeMenuProps) {
  const node = useEditorStore(s => s.nodes.find(n => n.id === targetId));
  const replaceNodeType = useEditorStore(s => s.replaceNodeType);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const matches = useMemo(() => {
    const all = Array.from(NODE_CATALOG.values()).filter(
      def => def.type !== 'custom.frame' && def.type !== 'custom.note' && def.type !== node?.type
    );
    if (!query.trim()) return all;
    return rankByQuery(
      query,
      all,
      def => `${def.label[lang]} ${def.type} ${def.description?.[lang] ?? ''}`
    ).map(r => r.item);
  }, [query, lang, node?.type]);

  if (!node) return null;

  const t =
    lang === 'es'
      ? {
          title: 'Reemplazar tipo de paso',
          subtitle: 'Conexiones, posición y campos comunes se preservan.',
          search: 'Buscar tipo…',
          empty: 'Sin coincidencias',
          cancel: 'Cancelar',
        }
      : {
          title: 'Replace step type',
          subtitle: 'Connections, position, and matching config keys are preserved.',
          search: 'Search type…',
          empty: 'No matches',
          cancel: 'Cancel',
        };

  const handlePick = (newType: string) => {
    const def = NODE_CATALOG.get(newType);
    replaceNodeType(targetId, newType, defaultConfigForType(newType), def?.label.en);
    onClose();
  };

  // Anchor near the target node when ReactFlow exposes its rendered
  // position. Falls back to centred if the node hasn't laid out yet.
  const anchor = (node.position ?? { x: 80, y: 80 }) as { x: number; y: number };

  return (
    <div
      className="absolute z-40 w-80 rounded-xl border border-white/10 bg-[#1a1a2e] text-white shadow-2xl"
      style={{
        // Position next to the node in canvas coordinates — the
        // ReactFlow viewport transform applies automatically because
        // this overlay lives outside the ReactFlow children but is
        // positioned via inline style relative to the canvas root.
        left: `min(calc(100vw - 22rem), ${anchor.x + 280}px)`,
        top: `${Math.max(0, anchor.y)}px`,
      }}
      role="dialog"
      aria-label={t.title}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Replace size={14} className="text-amber-400" />
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white">
            {t.title}
          </span>
          <span className="text-[10px] text-gray-400">{t.subtitle}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Search size={13} className="text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
            if (e.key === 'Enter' && matches.length > 0) {
              e.preventDefault();
              handlePick(matches[0].type);
            }
          }}
          placeholder={t.search}
          className="flex-1 bg-transparent text-sm placeholder:text-gray-500 focus:outline-none"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto py-1 text-sm" role="listbox">
        {matches.length === 0 ? (
          <li className="px-3 py-2 text-xs italic text-gray-500">{t.empty}</li>
        ) : (
          matches.map(def => (
            <li key={def.type}>
              <button
                type="button"
                onClick={() => handlePick(def.type)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white">
                  {def.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{def.label[lang]}</div>
                  {def.description?.[lang] ? (
                    <div className="truncate text-[10px] text-gray-400">
                      {def.description[lang]}
                    </div>
                  ) : null}
                </div>
                <span className="font-mono text-[9px] uppercase text-gray-500">{def.type}</span>
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex justify-end border-t border-white/10 px-3 py-1.5">
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-gray-400 transition-colors hover:text-white"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
