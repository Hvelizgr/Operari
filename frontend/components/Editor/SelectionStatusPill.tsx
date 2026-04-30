'use client';

import { Panel } from '@xyflow/react';
import { useMemo } from 'react';

import { useEditorStore } from '@/state/editorStore';

interface SelectionStatusPillProps {
  lang: 'en' | 'es';
}

/**
 * Floating "X selected" pill in the top-left, surfacing only when the
 * operator has a non-trivial multi-selection. The numbers (selected
 * count, how many are connected to the rest of the graph, how many are
 * disabled) are the operational signals an SRE wants when validating
 * what they're about to bulk-edit or duplicate.
 *
 * Lives inside its own `<Panel>` so RF positions it correctly even
 * with the UndoRedo panel already in `top-left` — both are siblings
 * and RF stacks them vertically.
 */
export default function SelectionStatusPill({ lang }: SelectionStatusPillProps) {
  const stats = useEditorStore(s => {
    const selected = s.nodes.filter(n => n.selected);
    if (selected.length < 2) return null;
    const ids = new Set(selected.map(n => n.id));
    let connected = 0;
    let disabled = 0;
    for (const n of selected) {
      if (n.data.workflow.enabled === false) disabled += 1;
      const isConnected = s.edges.some(
        e => (e.source === n.id && ids.has(e.target)) || (e.target === n.id && ids.has(e.source))
      );
      if (isConnected) connected += 1;
    }
    return { count: selected.length, connected, disabled };
  });

  const labels = useMemo(
    () =>
      lang === 'es'
        ? { selected: 'seleccionados', connected: 'conectados', disabled: 'desactivados' }
        : { selected: 'selected', connected: 'connected', disabled: 'disabled' },
    [lang]
  );

  if (!stats) return null;

  return (
    <Panel
      position="top-left"
      className="bg-[color:var(--rb-node-bg)]/90 ml-1 mt-12 flex items-center gap-3 rounded-md border border-[color:var(--rb-node-border)] px-3 py-1.5 text-xs text-[color:var(--rb-node-text)] shadow-lg backdrop-blur"
    >
      <span className="font-semibold" style={{ color: 'var(--op-moss)' }}>
        {stats.count} {labels.selected}
      </span>
      <span className="text-[color:var(--rb-node-muted)]">
        {stats.connected} {labels.connected}
      </span>
      {stats.disabled > 0 ? (
        <span style={{ color: 'var(--op-sunset)' }}>
          {stats.disabled} {labels.disabled}
        </span>
      ) : null}
    </Panel>
  );
}
