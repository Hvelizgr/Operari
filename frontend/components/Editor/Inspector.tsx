'use client';

import { X } from 'lucide-react';
import { useMemo } from 'react';

import DynamicNodeForm from '@/components/Node/DynamicNodeForm';
import { rfToWorkflow } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NODE_CATALOG } from './canvas/catalog';
import { StepDurationSparkline } from './StepDurationSparkline';
import { WebhookUrlPanel } from './WebhookUrlPanel';

export default function Inspector({ lang }: { lang: 'en' | 'es' }) {
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const updateNodeData = useEditorStore(s => s.updateNodeData);
  const stepStats = useEditorStore(s => s.stepStats);
  // Inspector is now driven by the dedicated `inspectorNodeId` flag
  // set on `onNodeDoubleClick`. Single-click still selects a node
  // for keyboard ops (delete, duplicate) but no longer pops this
  // panel — operators kept losing focus on the canvas every time
  // they bumped a node by accident.
  const inspectorNodeId = useEditorStore(s => s.inspectorNodeId);
  const closeInspector = useEditorStore(s => s.closeInspector);

  const target = useMemo(
    () => (inspectorNodeId ? (nodes.find(n => n.id === inspectorNodeId) ?? null) : null),
    [nodes, inspectorNodeId]
  );
  const workflowSnapshot = useMemo(() => rfToWorkflow(nodes, edges), [nodes, edges]);

  if (!target) return null;
  const selectedStats = stepStats[target.id];

  const def = NODE_CATALOG.get(target.type ?? '');
  const workflow = target.data.workflow;
  const config = (workflow.config ?? {}) as Record<string, unknown>;

  const handleConfigChange = (key: string, value: unknown) => {
    updateNodeData(target.id, {
      workflow: { ...workflow, config: { ...config, [key]: value } },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  const handleTitleChange = (next: string) => {
    updateNodeData(target.id, { workflow: { ...workflow, title: next } });
    useEditorStore.getState().setStatus('dirty');
  };

  const handleEnabledToggle = () => {
    updateNodeData(target.id, {
      workflow: { ...workflow, enabled: workflow.enabled === false ? true : false },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  // Close the panel without touching the node's `selected` flag —
  // keyboard ops (Backspace to delete, ⌘D to duplicate) should still
  // act on the node the operator was inspecting.
  const handleClose = () => {
    closeInspector();
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
          <span className="text-sm font-semibold">{def?.label[lang] ?? target.type}</span>
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
        {target.type === 'operari.webhook' || target.type === 'Webhook' ? (
          <WebhookUrlPanel lang={lang} />
        ) : null}
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
