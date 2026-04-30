'use client';

import { Route, Spline, Trash2 } from 'lucide-react';

import type { RfEdgeData } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

const CONDITIONS: Array<{
  value: NonNullable<RfEdgeData['condition']>;
  label: { en: string; es: string };
}> = [
  { value: 'complete', label: { en: 'Always', es: 'Siempre' } },
  { value: 'success', label: { en: 'On success', es: 'En éxito' } },
  { value: 'error', label: { en: 'On error', es: 'En error' } },
  { value: 'warning', label: { en: 'On warning', es: 'En advertencia' } },
  { value: 'disabled', label: { en: 'Disabled', es: 'Desactivado' } },
];

interface EdgeContextMenuProps {
  edgeId: string;
  position: { x: number; y: number };
  lang: 'en' | 'es';
  onClose: () => void;
}

export function EdgeContextMenu({ edgeId, position, lang, onClose }: EdgeContextMenuProps) {
  const removeEdge = () => {
    useEditorStore.getState().onEdgesChange([{ id: edgeId, type: 'remove' }]);
    useEditorStore.getState().setStatus('dirty');
    onClose();
  };
  const setCondition = (condition: NonNullable<RfEdgeData['condition']>) => {
    useEditorStore.getState().updateEdgeData(edgeId, { condition });
    useEditorStore.getState().setStatus('dirty');
    onClose();
  };

  const setLineStyle = (lineStyle: NonNullable<RfEdgeData['lineStyle']>) => {
    useEditorStore.getState().updateEdgeData(edgeId, { lineStyle });
    useEditorStore.getState().setStatus('dirty');
    onClose();
  };

  const clearLineStyle = () => {
    useEditorStore.getState().updateEdgeData(edgeId, { lineStyle: undefined });
    useEditorStore.getState().setStatus('dirty');
    onClose();
  };

  return (
    <div
      className="absolute z-50 min-w-[180px] rounded-lg border border-white/10 bg-[#1a1a2e] py-1 text-sm text-white shadow-xl"
      style={{ left: position.x, top: position.y }}
      onContextMenu={e => e.preventDefault()}
    >
      <button
        onClick={removeEdge}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-300 transition-colors hover:bg-white/5"
      >
        <Trash2 size={14} />
        {lang === 'es' ? 'Eliminar' : 'Delete'}
      </button>
      <div className="my-1 border-t border-white/10" />
      <div className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-gray-500">
        {lang === 'es' ? 'Condición' : 'Condition'}
      </div>
      {CONDITIONS.map(c => (
        <button
          key={c.value}
          onClick={() => setCondition(c.value)}
          className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-white/5"
        >
          {c.label[lang]}
        </button>
      ))}
      <div className="my-1 border-t border-white/10" />
      <div className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-gray-500">
        {lang === 'es' ? 'Estilo de arista' : 'Line style'}
      </div>
      <button
        onClick={() => setLineStyle('smart')}
        className="flex w-full items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/5"
      >
        <Spline size={14} />
        {lang === 'es' ? 'Curva' : 'Curved'}
      </button>
      <button
        onClick={() => setLineStyle('step')}
        className="flex w-full items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/5"
      >
        <Route size={14} />
        {lang === 'es' ? 'Ortogonal' : 'Step'}
      </button>
      <button
        onClick={clearLineStyle}
        className="block w-full px-3 py-1.5 text-left text-xs text-gray-400 transition-colors hover:bg-white/5"
      >
        {lang === 'es' ? 'Usar estilo global' : 'Use global'}
      </button>
    </div>
  );
}
