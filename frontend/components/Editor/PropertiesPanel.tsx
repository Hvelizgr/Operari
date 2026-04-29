'use client';

import type { Connection, WorkflowNode } from '@operari/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, GitBranch, RotateCw, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { NodeTypeRegistry } from '../../lib/canvas/node-type-registry';
import DynamicNodeForm from '../Node/DynamicNodeForm';
import { NODE_TYPES, NodeType } from '../Node/NodePalette';
import TriggerModifiersSection, {
  DEFAULT_TRIGGER_MODIFIERS,
} from '../Node/TriggerModifiersSection';

// Default trigger/org type sets — used when no registry is provided.
const DEFAULT_TRIGGER_TYPES = new Set([
  'operari.webhook',
  'operari.cron',
  'operari.scheduleTrigger',
  'operari.manualTrigger',
  'Webhook',
  'Trigger',
  'Schedule',
]);
const DEFAULT_ORG_TYPES = new Set(['custom.frame', 'custom.note']);

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  nodeTypeDefinition?: NodeType;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onClose: () => void;
  lang: 'en' | 'es';
  nodes: WorkflowNode[];
  connections: Connection[];
  registry?: NodeTypeRegistry;
}

export default function PropertiesPanel({
  node,
  nodeTypeDefinition,
  onUpdate,
  onClose,
  lang,
  nodes,
  connections,
  registry,
}: PropertiesPanelProps) {
  const triggerTypes = registry?.triggerTypes ?? DEFAULT_TRIGGER_TYPES;
  const orgTypes = registry?.organizationTypes ?? DEFAULT_ORG_TYPES;
  const [localTitle, setLocalTitle] = useState('');
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});

  const nodeTypeInfo = node ? NODE_TYPES.find(t => t.type === node.type) : null;
  const nodeDescription = nodeTypeInfo?.description?.[lang];

  useEffect(() => {
    if (node) {
      setLocalTitle(node.title);
      setLocalConfig((node.config as Record<string, unknown>) || {});
    }
  }, [node]);

  const content = {
    en: {
      title: 'Properties',
      nodeName: 'Label',
      nodeType: 'Type',
      settings: 'Settings',
      close: 'Close',
    },
    es: {
      title: 'Propiedades',
      nodeName: 'Etiqueta',
      nodeType: 'Tipo',
      settings: 'Ajustes',
      close: 'Cerrar',
    },
  };

  const text = content[lang] || content['en'];

  if (!node) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="absolute bottom-0 right-0 top-0 z-40 flex w-80 flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
        initial={{ x: '100%', opacity: 1 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        style={{
          background: 'var(--box-background-color)',
          borderLeft: '1px solid var(--border-color)',
        }}
        onWheel={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Settings size={16} />
            {text.title}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
          {/* Node Label */}
          <div className="mb-6 space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                {text.nodeName}
              </label>
              <input
                type="text"
                value={localTitle}
                onChange={e => {
                  setLocalTitle(e.target.value);
                  if (node) onUpdate(node.id, { title: e.target.value });
                }}
                className="focus:border-primary w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 transition-colors focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                  {text.nodeType}
                </label>
                <span className="inline-block rounded bg-slate-950 px-2 py-1 font-mono text-xs text-slate-400">
                  {node.type.split('.').pop()}
                </span>
              </div>
            </div>

            {nodeDescription && (
              <p className="border-l-2 border-slate-700 pl-2 text-xs italic leading-relaxed text-slate-500">
                {nodeDescription}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-slate-700" />

          {/* Settings */}
          <div>
            <h3 className="text-primary/70 mb-4 flex items-center gap-2 text-xs font-bold uppercase">
              {text.settings}
            </h3>

            <SettingsResolver
              node={node}
              localConfig={localConfig}
              setLocalConfig={setLocalConfig}
              onUpdate={onUpdate}
              nodeTypeDefinition={nodeTypeDefinition || NODE_TYPES.find(t => t.type === node?.type)}
              lang={lang}
              nodes={nodes}
              connections={connections}
            />
          </div>

          {/* Retry Policy — available on all step nodes (not triggers/org) */}
          {!triggerTypes.has(node.type) && !orgTypes.has(node.type) && (
            <>
              <div className="my-4 h-px bg-slate-700" />
              <RetryPolicySection
                retry={localConfig._retry as RetryPolicy | undefined}
                onChange={retry => {
                  const newConfig = { ...localConfig, _retry: retry };
                  setLocalConfig(newConfig);
                  onUpdate(node.id, { config: newConfig });
                }}
                lang={lang}
              />
            </>
          )}

          {/* Conditional Gates — available on all step nodes */}
          {!triggerTypes.has(node.type) && !orgTypes.has(node.type) && (
            <>
              <div className="my-4 h-px bg-slate-700" />
              <ConditionalGatesSection
                runIf={typeof localConfig._runIf === 'string' ? localConfig._runIf : undefined}
                skipIf={typeof localConfig._skipIf === 'string' ? localConfig._skipIf : undefined}
                onChange={(runIf, skipIf) => {
                  const newConfig = { ...localConfig, _runIf: runIf, _skipIf: skipIf };
                  setLocalConfig(newConfig);
                  onUpdate(node.id, { config: newConfig });
                }}
                lang={lang}
              />
            </>
          )}

          {/* Trigger Modifiers - Only show for trigger nodes */}
          {triggerTypes.has(node.type) && (
            <>
              <div className="my-4 h-px bg-slate-700" />
              <TriggerModifiersSection
                modifiers={
                  (localConfig.triggerModifiers as
                    | React.ComponentProps<typeof TriggerModifiersSection>['modifiers']
                    | undefined) || DEFAULT_TRIGGER_MODIFIERS
                }
                onChange={modifiers => {
                  const newConfig = { ...localConfig, triggerModifiers: modifiers };
                  setLocalConfig(newConfig);
                  onUpdate(node.id, { config: newConfig });
                }}
                lang={lang}
              />
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface SettingsResolverProps {
  node: WorkflowNode | null;
  localConfig: Record<string, unknown>;
  setLocalConfig: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  nodeTypeDefinition?: NodeType;
  lang: 'en' | 'es';
  nodes: WorkflowNode[];
  connections: Connection[];
}

// Helper to keep main component clean
function SettingsResolver({
  node,
  localConfig,
  setLocalConfig,
  onUpdate,
  nodeTypeDefinition,
  lang,
  nodes,
  connections,
}: SettingsResolverProps) {
  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    if (node) {
      onUpdate(node.id, { config: newConfig });
    }
  };

  // ConfigField Helper
  const ConfigField = ({
    label,
    description,
    children,
  }: {
    label: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
        {label}
      </label>
      {children}
      {description && (
        <p className="text-[10px] leading-tight text-[var(--descriptor-color)] opacity-70">
          {description}
        </p>
      )}
    </div>
  );

  // Input Style
  const inputClass =
    'w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors font-mono';

  // Auto-generated form from the node type's property manifest. Built-
  // in types ship their manifest via the prisma seed; tenant-owned
  // plugin types ship theirs via the SDK install path. Both flow
  // through DynamicNodeForm, so the editor renders a real form
  // instead of a raw JSON textarea for every step the catalog knows
  // about.
  if (nodeTypeDefinition?.properties && nodeTypeDefinition.properties.length > 0) {
    return (
      <DynamicNodeForm
        properties={nodeTypeDefinition.properties}
        values={localConfig}
        onChange={(key, val) => handleConfigChange(key, val)}
        nodes={nodes}
        connections={connections}
        lang={lang}
      />
    );
  }

  // Default JSON editor for unknown types
  return (
    <ConfigField label="Raw Configuration (JSON)" description="Edit properties directly">
      <textarea
        value={JSON.stringify(localConfig, null, 2)}
        onChange={e => {
          try {
            const parsed = JSON.parse(e.target.value);
            setLocalConfig(parsed);
            if (node) onUpdate(node.id, { config: parsed });
          } catch {}
        }}
        rows={15}
        className={inputClass}
      />
    </ConfigField>
  );
}

// ---------------------------------------------------------------------------
// Retry Policy Section
// ---------------------------------------------------------------------------

interface RetryPolicy {
  count: number;
  backoff: 'fixed' | 'exponential';
  delayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryPolicy = { count: 0, backoff: 'fixed', delayMs: 1000, maxDelayMs: 30000 };

function RetryPolicySection({
  retry,
  onChange,
  lang,
}: {
  retry?: RetryPolicy;
  onChange: (retry: RetryPolicy | undefined) => void;
  lang: 'en' | 'es';
}) {
  const [isOpen, setIsOpen] = useState(!!retry?.count);
  const policy = retry ?? DEFAULT_RETRY;

  const text =
    lang === 'es'
      ? {
          title: 'Política de reintento',
          enabled: 'Reintentar en fallo',
          count: 'Intentos',
          backoff: 'Backoff',
          delay: 'Delay (ms)',
          maxDelay: 'Max delay (ms)',
          fixed: 'Fijo',
          exponential: 'Exponencial',
        }
      : {
          title: 'Retry policy',
          enabled: 'Retry on failure',
          count: 'Attempts',
          backoff: 'Backoff',
          delay: 'Delay (ms)',
          maxDelay: 'Max delay (ms)',
          fixed: 'Fixed',
          exponential: 'Exponential',
        };

  const inputClass =
    'w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-primary transition-colors';
  const labelClass = 'text-[11px] font-bold uppercase text-slate-500';

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-3 flex w-full items-center gap-2 text-xs font-bold uppercase text-amber-400 transition-colors hover:text-amber-300"
      >
        <RotateCw size={14} />
        {text.title}
        <ChevronDown
          size={12}
          className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="space-y-3 pl-1">
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={policy.count > 0}
                onChange={e => {
                  if (e.target.checked) {
                    onChange({ ...policy, count: policy.count || 3 });
                  } else {
                    onChange(undefined);
                  }
                }}
              />
              <div
                className={`h-5 w-9 rounded-full shadow-inner transition-colors ${policy.count > 0 ? 'bg-amber-500' : 'bg-slate-800'}`}
              />
              <div
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${policy.count > 0 ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </div>
            <span className="text-xs text-slate-300">{text.enabled}</span>
          </label>

          {policy.count > 0 && (
            <>
              <div>
                <label className={labelClass}>{text.count}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={policy.count}
                  onChange={e =>
                    onChange({ ...policy, count: Math.max(1, Number(e.target.value)) })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{text.backoff}</label>
                <select
                  value={policy.backoff}
                  onChange={e =>
                    onChange({ ...policy, backoff: e.target.value as 'fixed' | 'exponential' })
                  }
                  className={`${inputClass} appearance-none`}
                >
                  <option value="fixed">{text.fixed}</option>
                  <option value="exponential">{text.exponential}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>{text.delay}</label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={policy.delayMs}
                    onChange={e => onChange({ ...policy, delayMs: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                {policy.backoff === 'exponential' && (
                  <div>
                    <label className={labelClass}>{text.maxDelay}</label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={policy.maxDelayMs}
                      onChange={e => onChange({ ...policy, maxDelayMs: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conditional Gates Section
// ---------------------------------------------------------------------------

function ConditionalGatesSection({
  runIf,
  skipIf,
  onChange,
  lang,
}: {
  runIf?: string;
  skipIf?: string;
  onChange: (runIf: string | undefined, skipIf: string | undefined) => void;
  lang: 'en' | 'es';
}) {
  const [isOpen, setIsOpen] = useState(!!(runIf || skipIf));

  const text =
    lang === 'es'
      ? {
          title: 'Condiciones',
          runIf: 'Ejecutar si (runIf)',
          skipIf: 'Saltar si (skipIf)',
          runIfHelp:
            'Expresión que debe ser truthy para ejecutar este paso. Vacío = siempre ejecutar.',
          skipIfHelp: 'Expresión que debe ser truthy para saltar este paso.',
          placeholder: '{{steps.check.output.status}} === "ready"',
        }
      : {
          title: 'Conditions',
          runIf: 'Run if (runIf)',
          skipIf: 'Skip if (skipIf)',
          runIfHelp: 'Expression that must be truthy to execute this step. Empty = always run.',
          skipIfHelp: 'Expression that must be truthy to skip this step.',
          placeholder: '{{steps.check.output.status}} === "ready"',
        };

  const inputClass =
    'w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-primary transition-colors font-mono';
  const labelClass = 'text-[11px] font-bold uppercase text-slate-500';

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-primary/70 hover:text-primary/40 mb-3 flex w-full items-center gap-2 text-xs font-bold uppercase transition-colors"
      >
        <GitBranch size={14} />
        {text.title}
        <ChevronDown
          size={12}
          className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="space-y-4 pl-1">
          <div>
            <label className={labelClass}>{text.runIf}</label>
            <textarea
              value={runIf || ''}
              onChange={e => onChange(e.target.value || undefined, skipIf)}
              className={inputClass}
              rows={2}
              placeholder={text.placeholder}
            />
            <p className="mt-1 text-[10px] leading-tight text-slate-500">{text.runIfHelp}</p>
          </div>
          <div>
            <label className={labelClass}>{text.skipIf}</label>
            <textarea
              value={skipIf || ''}
              onChange={e => onChange(runIf, e.target.value || undefined)}
              className={inputClass}
              rows={2}
              placeholder={text.placeholder}
            />
            <p className="mt-1 text-[10px] leading-tight text-slate-500">{text.skipIfHelp}</p>
          </div>
        </div>
      )}
    </div>
  );
}
