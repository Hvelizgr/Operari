'use client';

import { Panel } from '@xyflow/react';
import { Redo2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useEditorStore } from '@/state/editorStore';

const buttonClass =
  'flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30';

export default function UndoRedoPanel({ lang }: { lang: 'en' | 'es' }) {
  // zundo's `temporal` store exposes pastStates / futureStates arrays;
  // subscribe so the buttons disable when there's nothing to undo or
  // redo. The selector is shallow because we only need the lengths.
  const [counts, setCounts] = useState({ past: 0, future: 0 });

  useEffect(() => {
    const update = () => {
      const t = useEditorStore.temporal.getState();
      setCounts({ past: t.pastStates.length, future: t.futureStates.length });
    };
    update();
    const unsub = useEditorStore.temporal.subscribe(update);
    return unsub;
  }, []);

  const t = useEditorStore.temporal.getState();
  const undoTitle = lang === 'es' ? 'Deshacer (Ctrl+Z)' : 'Undo (Ctrl+Z)';
  const redoTitle = lang === 'es' ? 'Rehacer (Ctrl+Y)' : 'Redo (Ctrl+Y)';

  return (
    <Panel
      position="top-left"
      className="bg-[color:var(--rb-node-bg)]/85 flex items-center gap-1 rounded-lg border border-[color:var(--rb-node-border)] p-1 shadow-xl backdrop-blur"
    >
      <button
        type="button"
        onClick={() => t.undo()}
        disabled={counts.past === 0}
        aria-label={undoTitle}
        title={undoTitle}
        className={buttonClass}
      >
        <Undo2 size={14} />
      </button>
      <button
        type="button"
        onClick={() => t.redo()}
        disabled={counts.future === 0}
        aria-label={redoTitle}
        title={redoTitle}
        className={buttonClass}
      >
        <Redo2 size={14} />
      </button>
    </Panel>
  );
}
