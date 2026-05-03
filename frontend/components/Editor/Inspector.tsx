'use client';

import { X } from 'lucide-react';
import { useMemo } from 'react';

import DynamicNodeForm from '@/components/Node/DynamicNodeForm';
import { rfToWorkflow } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NODE_CATALOG } from './canvas/catalog';
import { StepDurationSparkline } from './StepDurationSparkline';

export default function Inspector({ lang }: { lang: 'en' | 'es' }) {
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const updateNodeData = useEditorStore(s => s.updateNodeData);
  const stepStats = useEditorStore(s => s.stepStats);

  const selected = useMemo(() => nodes.find(n => n.selected), [nodes]);
  const workflowSnapshot = useMemo(() => rfToWorkflow(nodes, edges), [nodes, edges]);

  if (!selected) return null;
  const selectedStats = stepStats[selected.id];

  const def = NODE_CATALOG.get(selected.type ?? '');
  const workflow = selected.data.workflow;
  const config = (workflow.config ?? {}) as Record<string, unknown>;

  const handleConfigChange = (key: string, value: unknown) => {
    updateNodeData(selected.id, {
      workflow: { ...workflow, config: { ...config, [key]: value } },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  const handleTitleChange = (next: string) => {
    updateNodeData(selected.id, { workflow: { ...workflow, title: next } });
    useEditorStore.getState().setStatus('dirty');
  };

  const handleEnabledToggle = () => {
    updateNodeData(selected.id, {
      workflow: { ...workflow, enabled: workflow.enabled === false ? true : false },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  const handleClose = () => {
    useEditorStore.setState(s => ({
      nodes: s.nodes.map(n => (n.id === selected.id ? { ...n, selected: false } : n)),
    }));
  };

  const labels = {
    en: { title: 'Step', name: 'Name', enabled: 'Enabled', disabled: 'Disabled' },
    es: { title: 'Paso', name: 'Nombre', enabled: 'Activo', disabled: 'Desactivado' },
  } as const;
  const t = labels[lang];

  return (
    <div className="absolute bottom-4 right-4 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#1a1a2e] text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">{t.title}</span>
          <span className="text-sm font-semibold">{def?.label[lang] ?? selected.type}</span>
        </div>
        <button
          onClick={handleClose}
          aria-label="close inspector"
          className="rounded p-1 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div>
          <label className="text-[11px] font-bold uppercase text-gray-400">{t.name}</label>
          <input
            value={workflow.title ?? ''}
            onChange={e => handleTitleChange(e.target.value)}
            className="focus:border-primary mt-1 w-full rounded border border-white/10 bg-black/30 p-2 text-sm focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={workflow.enabled !== false}
            onChange={handleEnabledToggle}
          />
          <span>{workflow.enabled === false ? t.disabled : t.enabled}</span>
        </label>
        {selectedStats && selectedStats.runs > 0 && (
          <StepDurationSparkline stats={selectedStats} lang={lang} />
        )}
      </div>

      <div className="max-h-[50vh] overflow-y-auto border-t border-white/10 px-4 py-3">
        {def?.properties && def.properties.length > 0 ? (
          <DynamicNodeForm
            properties={def.properties}
            values={config}
            onChange={handleConfigChange}
            nodes={workflowSnapshot.nodes}
            connections={workflowSnapshot.connections}
            lang={lang}
          />
        ) : (
          <p className="text-xs italic text-gray-500">No configurable properties.</p>
        )}
      </div>
    </div>
  );
}
