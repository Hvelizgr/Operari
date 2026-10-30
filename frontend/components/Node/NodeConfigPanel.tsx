'use client';

import type { Connection, WorkflowNode } from '@operari/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, KeyRound, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { RetryPolicy } from '@/utils/runbookYaml';

import ConditionalEditor from './ConditionalEditor';
import DynamicNodeForm from './DynamicNodeForm';
import { NODE_TYPES, NodeType } from './NodePalette';
import RetryPolicyEditor from './RetryPolicyEditor';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface NodeConfigPanelProps {
  node: WorkflowNode | null;
  nodeTypeDefinition?: NodeType;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onClose: () => void;
  lang: 'en' | 'es';
  nodes: WorkflowNode[];
}

export default function NodeConfigPanel({
  node,
  nodeTypeDefinition,
  onUpdate,
  onClose,
  lang,
  nodes,
}: NodeConfigPanelProps) {
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
      title: 'Configuration',
      nodeName: 'Label',
      nodeType: 'Type',
      settings: 'Properties',
      close: 'Close',
    },
    es: {
      title: 'Configuración',
      nodeName: 'Etiqueta',
      nodeType: 'Tipo',
      settings: 'Propiedades',
      close: 'Cerrar',
    },
  };

  const text = content[lang] || content['en'];

  if (!node) return null;

  return (
    <AnimatePresence>
      <motion.div
        // ... styles ...
        className="absolute bottom-4 right-4 top-4 z-40 flex w-[400px] flex-col shadow-[0_0_30px_rgba(0,0,0,0.5)]"
        initial={{ x: '120%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '120%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={
          {
            background: 'var(--box-background-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          } as React.CSSProperties
        }
        onWheel={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Header matching RunDialog style */}
        <div
          className="dialog_title"
          style={{
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)',
            borderBottom: '1px solid var(--border-color)',
            height: '40px',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '10px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'var(--highlight-color)',
            userSelect: 'none',
          }}
        >
          <span className="mr-2">
            <Settings size={16} />
          </span>
          {text.title}
          <div className="flex-1" />
          <div className="button icon" style={{ margin: '5px' }} onClick={onClose}>
            <X size={16} />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
          {/* Node Info Block */}
          <div className="mb-6 border-b border-[var(--border-color)] pb-4">
            <div className="mb-4">
              <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
                {text.nodeName}
              </label>
              <input
                type="text"
                value={localTitle}
                onChange={e => {
                  setLocalTitle(e.target.value);
                  if (node) onUpdate(node.id, { title: e.target.value });
                }}
                className="w-full rounded border border-[var(--border-color)] bg-black/20 p-2 text-sm text-[var(--body-text-color)] transition-colors focus:border-[var(--highlight-color)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
                {text.nodeType}
              </label>
              <div className="font-mono text-xs text-[var(--body-text-color)] opacity-70">
                {node.type}
              </div>
              {nodeDescription && (
                <p className="mt-2 text-[11px] italic leading-tight text-[var(--descriptor-color)]">
                  {nodeDescription}
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Settings */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase text-[var(--highlight-color)]">
              <span className="inline-block h-3 w-1 rounded-full bg-[var(--highlight-color)]"></span>
              {text.settings}
            </h3>

            <div className="space-y-4">
              <SettingsResolver
                node={node}
                localConfig={localConfig}
                setLocalConfig={setLocalConfig}
                onUpdate={onUpdate}
                nodeTypeDefinition={
                  nodeTypeDefinition || NODE_TYPES.find(t => t.type === node?.type)
                }
                lang={lang}
                nodes={nodes}
                connections={[]}
              />
            </div>
          </div>

          {/* Retry policy — cross-cutting, applies to every step type */}
          <div className="mt-6 border-t border-[var(--border-color)] pt-6">
            <RetryPolicyEditor
              lang={lang}
              value={localConfig._retry as RetryPolicy | undefined}
              onChange={retry => {
                const newConfig = { ...localConfig };
                if (retry) {
                  newConfig._retry = retry;
                } else {
                  delete newConfig._retry;
                }
                setLocalConfig(newConfig);
                onUpdate(node.id, { config: newConfig });
              }}
            />
          </div>

          {/* Conditional execution — runIf / skipIf */}
          <div className="mt-6 border-t border-[var(--border-color)] pt-6">
            <ConditionalEditor
              lang={lang}
              runIf={typeof localConfig._runIf === 'string' ? localConfig._runIf : undefined}
              skipIf={typeof localConfig._skipIf === 'string' ? localConfig._skipIf : undefined}
              onChange={({ runIf, skipIf }) => {
                const newConfig = { ...localConfig };
                if (runIf) newConfig._runIf = runIf;
                else delete newConfig._runIf;
                if (skipIf) newConfig._skipIf = skipIf;
                else delete newConfig._skipIf;
                setLocalConfig(newConfig);
                onUpdate(node.id, { config: newConfig });
              }}
            />
          </div>

          {/* Available secrets — quick reference + copy.
                        Cross-cutting because any text config field can
                        accept a {{secrets.<id>}} template; instead of
                        binding a SecretPicker per-field, this panel
                        lists what is available and copies the reference
                        for the operator to paste wherever they need it. */}
          <div className="mt-6 border-t border-[var(--border-color)] pt-6">
            <SecretsReferencePanel lang={lang} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface ConnectedAccountSummary {
  id: string;
  provider: string;
  displayName: string | null;
}

function SecretsReferencePanel({ lang }: { lang: 'en' | 'es' }) {
  const [accounts, setAccounts] = useState<ConnectedAccountSummary[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/connected-accounts`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(j => {
        const list = Array.isArray(j) ? j : (j.data ?? []);
        setAccounts(list);
      })
      .catch(() => setAccounts([]));
  }, []);

  const copy = (id: string) => {
    const ref = `{{secrets.${id}}}`;
    navigator.clipboard.writeText(ref).catch(() => {
      /* noop */
    });
    setCopiedId(id);
    setTimeout(() => setCopiedId(curr => (curr === id ? null : curr)), 1500);
  };

  const t =
    lang === 'es'
      ? {
          title: 'Secrets disponibles',
          hint: 'Copiá una referencia y pegala en cualquier campo de config (URL, body, command). Se resuelve a la credencial en runtime.',
          empty: 'No hay cuentas conectadas. Vinculá una desde Utilities → Connected accounts.',
        }
      : {
          title: 'Available secrets',
          hint: 'Copy a reference and paste it into any config field (URL, body, command). It resolves to the credential at run time.',
          empty: 'No connected accounts yet. Link one from Utilities → Connected accounts.',
        };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase text-[var(--highlight-color)]">
        <KeyRound size={12} />
        {t.title}
      </h3>
      <p className="mb-3 text-[10px] leading-tight text-[var(--descriptor-color)] opacity-70">
        {t.hint}
      </p>
      {accounts === null ? (
        <div className="text-[11px] text-[var(--descriptor-color)] opacity-70">…</div>
      ) : accounts.length === 0 ? (
        <div className="text-[11px] text-[var(--descriptor-color)] opacity-70">{t.empty}</div>
      ) : (
        <ul className="space-y-1">
          {accounts.map(a => {
            const ref = `{{secrets.${a.id}}}`;
            const isCopied = copiedId === a.id;
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded border border-[var(--border-color)] bg-black/20 px-2 py-1"
              >
                <code className="flex-1 truncate font-mono text-[10px] text-amber-300">{ref}</code>
                <span className="text-[9px] text-[var(--descriptor-color)] opacity-70">
                  {a.displayName ?? a.provider}
                </span>
                <button
                  onClick={() => copy(a.id)}
                  className="p-1 text-[var(--descriptor-color)] hover:text-white"
                  title="Copy reference"
                >
                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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

  // 1. Dynamic Form
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

  // 2. Specific Fallbacks
  if (node?.type === 'operari.httpRequest') {
    const urlValue = typeof localConfig.url === 'string' ? localConfig.url : '';
    const methodValue = typeof localConfig.method === 'string' ? localConfig.method : 'GET';
    return (
      <div className="space-y-4">
        <ConfigField label="URL" description="Endpoint URL">
          <input
            type="text"
            value={urlValue}
            onChange={e => handleConfigChange('url', e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </ConfigField>
        <ConfigField label="Method" description="HTTP Verb">
          <select
            value={methodValue}
            onChange={e => handleConfigChange('method', e.target.value)}
            className={inputClass}
          >
            {['GET', 'POST', 'PUT', 'DELETE'].map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </ConfigField>
      </div>
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
