'use client';

import { Panel, useReactFlow } from '@xyflow/react';
import { Crosshair } from 'lucide-react';
import { useMemo } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

export default function ZoomToRunning({ lang }: { lang: 'en' | 'es' }) {
  const nodes = useEditorStore(s => s.nodes);
  const { fitView } = useReactFlow<RfNode, RfEdge>();

  // Memo so the button only re-renders when the running set changes,
  // not on every drag tick.
  const runningId = useMemo(
    () => nodes.find(n => n.data.status === 'running')?.id ?? null,
    [nodes]
  );

  if (!runningId) return null;

  const label = lang === 'es' ? 'Centrar en paso en ejecución' : 'Center on running step';

  return (
    <Panel position="top-right">
      <button
        type="button"
        onClick={() => fitView({ nodes: [{ id: runningId }], duration: 400, padding: 0.4 })}
        aria-label={label}
        title={label}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold text-black shadow-lg transition-colors hover:brightness-110"
        style={{ background: 'var(--op-gold)' }}
      >
        <Crosshair size={14} />
        {lang === 'es' ? 'Paso activo' : 'Running step'}
      </button>
    </Panel>
  );
}
