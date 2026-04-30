'use client';

import { useReactFlow } from '@xyflow/react';
import { Crosshair } from 'lucide-react';
import { useMemo } from 'react';

import type { RfEdge, RfNode } from '@/lib/canvas/v2/adapter';
import { useEditorStoreV2 } from '@/state/editorStoreV2';

export default function ZoomToRunning({ lang }: { lang: 'en' | 'es' }) {
  const nodes = useEditorStoreV2(s => s.nodes);
  const { fitView } = useReactFlow<RfNode, RfEdge>();

  // Memo so the button only re-renders when running set changes, not on
  // every drag tick.
  const runningId = useMemo(
    () => nodes.find(n => n.data.status === 'running')?.id ?? null,
    [nodes]
  );

  if (!runningId) return null;

  const label = lang === 'es' ? 'Centrar en paso en ejecución' : 'Center on running step';

  return (
    <button
      type="button"
      onClick={() => {
        fitView({ nodes: [{ id: runningId }], duration: 400, padding: 0.4 });
      }}
      aria-label={label}
      title={label}
      className="absolute right-4 top-14 z-30 flex items-center gap-2 rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black shadow-lg transition-colors hover:bg-amber-400"
    >
      <Crosshair size={14} />
      {lang === 'es' ? 'Paso activo' : 'Running step'}
    </button>
  );
}
