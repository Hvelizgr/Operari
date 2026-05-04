'use client';

import { Pin, PinOff, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import DynamicNodeForm from '@/components/Node/DynamicNodeForm';
import { rfToWorkflow } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NODE_CATALOG } from './canvas/catalog';
import OpenInToolButton from './OpenInToolButton';
import { SpanTimeline } from './SpanTimeline';
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
        {target.data?.startedAt != null ? (
          <SpanTimeline
            startedAt={target.data.startedAt}
            durationMs={target.data.durationMs}
            lang={lang}
          />
        ) : null}
        {selectedStats && selectedStats.runs > 0 && (
          <StepDurationSparkline stats={selectedStats} lang={lang} />
        )}
        {target.type === 'operari.webhook' || target.type === 'Webhook' ? (
          <WebhookUrlPanel lang={lang} />
        ) : null}
        {target.type === 'operari.database' || target.type === 'operari.httpRequest' ? (
          <OpenInToolButton
            type={target.type as 'operari.database' | 'operari.httpRequest'}
            config={config}
            lang={lang}
          />
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
        <PinnedOutputPanel
          lang={lang}
          pinned={config.__pinnedOutput}
          onSave={value => handleConfigChange('__pinnedOutput', value)}
        />
      </div>
    </div>
  );
}

interface PinnedOutputPanelProps {
  lang: 'en' | 'es';
  pinned: unknown;
  onSave: (value: unknown) => void;
}

const PIN_STRINGS = {
  en: {
    title: 'Pinned output',
    hint: 'Freeze this step’s output. The engine returns the value below instead of running the executor — useful for iterating on downstream steps without spending API calls. Stripped from YAML round-trips.',
    placeholder: '{ "items": [1, 2, 3] }',
    setPin: 'Pin output',
    update: 'Update pin',
    clear: 'Clear pin',
    invalidJson: 'Not valid JSON',
    pinned: 'Pinned',
  },
  es: {
    title: 'Salida fijada',
    hint: 'Congelá la salida de este paso. El motor devuelve el valor de abajo en lugar de ejecutar el step — útil para iterar pasos downstream sin gastar llamadas a APIs. Se filtra del YAML round-trip.',
    placeholder: '{ "items": [1, 2, 3] }',
    setPin: 'Fijar salida',
    update: 'Actualizar pin',
    clear: 'Quitar pin',
    invalidJson: 'JSON inválido',
    pinned: 'Fijado',
  },
} as const;

/**
 * Pin-output editor (n8n parity). Operator pastes a JSON value;
 * once pinned, every run returns it instead of invoking the
 * executor for this step. Surfaces a chip in the read-only state
 * so the operator never forgets the step is short-circuited.
 */
function PinnedOutputPanel({ lang, pinned, onSave }: PinnedOutputPanelProps) {
  const t = PIN_STRINGS[lang] ?? PIN_STRINGS.en;
  const isPinned = pinned !== undefined;
  const [draft, setDraft] = useState<string>(() =>
    pinned === undefined ? '' : JSON.stringify(pinned, null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    if (!draft.trim()) {
      onSave(undefined);
      setError(null);
      return;
    }
    try {
      const value = JSON.parse(draft);
      onSave(value);
      setError(null);
    } catch {
      setError(t.invalidJson);
    }
  };

  const clear = () => {
    setDraft('');
    onSave(undefined);
    setError(null);
  };

  return (
    <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
      <div className="flex items-center gap-2">
        {isPinned ? (
          <Pin size={12} className="text-amber-400" />
        ) : (
          <PinOff size={12} className="text-gray-500" />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
          {t.title}
        </span>
        {isPinned ? (
          <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300">
            {t.pinned}
          </span>
        ) : null}
      </div>
      <p className="text-[10px] leading-snug text-gray-500">{t.hint}</p>
      <textarea
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        placeholder={t.placeholder}
        rows={5}
        className="w-full resize-y rounded border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-gray-200 outline-none focus:border-amber-500/50"
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          className="rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-300 transition-colors hover:border-amber-400 hover:text-amber-200"
        >
          {isPinned ? t.update : t.setPin}
        </button>
        {isPinned ? (
          <button
            type="button"
            onClick={clear}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-gray-400 transition-colors hover:text-white"
          >
            {t.clear}
          </button>
        ) : null}
        {error ? <span className="text-[10px] text-rose-400">{error}</span> : null}
      </div>
    </div>
  );
}
